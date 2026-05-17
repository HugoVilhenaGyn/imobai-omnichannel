require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

let qrCodeData = null;
let connectionStatus = 'DISCONNECTED';
let connectedNumber = null;
let isInitializing = false;
let client = null;
let forceNewSession = false; // sinaliza que o usuário quer nova sessão (apaga arquivos antes de iniciar)

// Mapa phone → chatId completo (ex: '184125281595582' → '184125281595582@lid')
const phoneToChatId = new Map();

function createWhatsAppClient() {
    const c = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--no-first-run', '--disable-dev-shm-usage']
        }
    });

    // Timeout de autenticação: se demorar mais de 90s no AUTHENTICATING, reinicia
    let authTimer = null;
    const clearAuthTimer = () => { if (authTimer) { clearTimeout(authTimer); authTimer = null; } };

    c.on('qr', (qr) => {
        clearAuthTimer();
        qrCodeData = qr;
        connectionStatus = 'WAITING_FOR_QR_SCAN';
        io.emit('qr', qrCodeData);
        io.emit('status', connectionStatus);
    });

    c.on('authenticated', () => {
        console.log('✅ QR escaneado! Carregando WhatsApp Web...');
        qrCodeData = null;
        connectionStatus = 'AUTHENTICATING';
        io.emit('status', connectionStatus);

        // Se em 90s o ready não disparar, reinicia automaticamente
        clearAuthTimer();
        authTimer = setTimeout(async () => {
            if (connectionStatus === 'AUTHENTICATING') {
                console.error('⚠️ Timeout de autenticação (90s). Reiniciando cliente...');
                isInitializing = false;
                try { await c.destroy(); } catch (_) {}
                await safeInitialize();
            }
        }, 90000);
    });

    c.on('auth_failure', msg => {
        clearAuthTimer();
        console.error('❌ Falha na autenticação:', msg);
        connectionStatus = 'DISCONNECTED';
        isInitializing = false;
        io.emit('status', connectionStatus);
    });

    c.on('loading_screen', (percent, message) => {
        console.log(`⏳ Carregando WhatsApp Web... ${percent}% — ${message}`);
        // Emite progresso para o frontend mostrar barra de carregamento
        io.emit('loading_progress', { percent, message });
    });

    c.on('ready', () => {
        clearAuthTimer();
        console.log('📱 WhatsApp conectado e pronto!');
        qrCodeData = null;
        connectionStatus = 'CONNECTED';
        connectedNumber = c.info?.wid?.user || null;
        isInitializing = false;
        io.emit('status', connectionStatus);
        io.emit('my_number', connectedNumber);
        console.log(`📞 Número conectado: ${connectedNumber}`);
        // Resolver LIDs salvos no banco automaticamente após 5s
        setTimeout(() => autoResolveLidContacts(c), 5000);
    });

    c.on('disconnected', (reason) => {
        clearAuthTimer();
        console.log('❌ WhatsApp desconectado:', reason);
        connectedNumber = null;
        io.emit('my_number', null);

        // Se connectionStatus já é AUTHENTICATING, significa que safeInitialize() chamou
        // client.destroy() intencionalmente para criar um novo cliente.
        // Não sobrescrever o status nem resetar isInitializing — o novo cliente cuida disso.
        if (connectionStatus === 'AUTHENTICATING') {
            console.log('🔄 Disconnect durante reinicialização — ignorado.');
            return;
        }

        connectionStatus = 'DISCONNECTED';
        isInitializing = false;
        io.emit('status', connectionStatus);
    });

    // ESCUTANDO MENSAGENS DO WHATSAPP (E SALVANDO NO SUPABASE)
    // message_create fires for ALL messages (sent + received); used only for populating the map
    c.on('message_create', (msg) => {
        if (!msg.id.fromMe) return; // received messages handled by 'message' below
        const phone = msg.to?.replace('@c.us', '').replace('@lid', '');
        if (phone && msg.to) phoneToChatId.set(phone, msg.to);
    });

    c.on('message', async msg => {
        try {
            console.log(`📩 Nova mensagem de ${msg.from}: "${msg.body}" | tipo: ${msg.type}`);

            // Ignora status, grupos, broadcasts e mensagens vazias
            if (msg.isStatus) return;
            if (msg.from.includes('@g.us')) return;
            if (msg.from.includes('@broadcast')) return;
            if (!msg.body || !msg.body.trim()) return;

            // Aceita tanto @c.us (formato antigo) quanto @lid (formato novo do WhatsApp)
            const isValidContact = msg.from.includes('@c.us') || msg.from.includes('@lid');
            if (!isValidContact) {
                console.log(`⚠️ Formato de contato não suportado: ${msg.from}`);
                return;
            }

            const chatId   = msg.from;
            const lidPhone = msg.from.replace('@c.us', '').replace('@lid', '');
            const contactName = msg._data?.notifyName || msg._data?.pushname || lidPhone;

            // Resolve o número real de telefone (LIDs são IDs internos, não números de telefone)
            // Número real: 8–13 dígitos. LID: 14+ dígitos — não é telefone, não deve ser armazenado.
            const isRealPhone = (n) => n && n.length >= 8 && n.length <= 13;
            let phone = lidPhone;
            try {
                const waContact = await msg.getContact();
                if (isRealPhone(waContact?.number)) {
                    phone = waContact.number;
                    console.log(`📞 Número real resolvido: LID ${lidPhone} → ${phone}`);
                } else if (waContact?.number) {
                    console.log(`⚠️ getContact() retornou valor inválido (LID?): ${waContact.number}`);
                }
            } catch (e) {
                console.log(`⚠️ getContact() falhou para ${lidPhone}: ${e.message}`);
            }

            console.log(`✅ Processando mensagem de: ${contactName} (${phone}) [${chatId}]`);

            // Mapeia phone real → chatId E o LID → chatId (retrocompat. para envios)
            phoneToChatId.set(phone, chatId);
            if (phone !== lidPhone) phoneToChatId.set(lidPhone, chatId);

            // Emite mapa atualizado para o frontend (WhatsApp Manager)
            io.emit('phone_map_update', Array.from(phoneToChatId.entries()));

            // 1. Procurar contato por número real OU por LID (caso já exista com LID)
            const searchPhones = phone !== lidPhone ? [phone, lidPhone] : [phone];
            let { data: contacts } = await supabase
                .from('contacts')
                .select('*')
                .in('phone', searchPhones);

            let contactId;
            let contact;

            if (!contacts || contacts.length === 0) {
                console.log(`👤 Criando novo contato: ${contactName} (${phone})`);
                const { data: newContact, error: insertError } = await supabase
                    .from('contacts')
                    .insert([{
                        name: contactName,
                        phone: phone,
                        status: 'novo_contato',
                        handled_by_ai: true,
                        original_channel: 'whatsapp'
                    }])
                    .select();

                if (insertError) throw insertError;
                contact = newContact[0];
                contactId = contact.id;
            } else {
                contact = contacts[0];
                contactId = contact.id;
                // Se o contato estava salvo com LID, atualiza para o número real
                if (contact.phone !== phone && phone !== lidPhone) {
                    console.log(`📱 Corrigindo phone do contato ${contactId}: "${contact.phone}" → "${phone}"`);
                    await supabase.from('contacts').update({ phone }).eq('id', contactId);
                    contact.phone = phone;
                }
                await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', contactId);
            }

            // 1b. Se contato ainda tem LID como phone, tentar extrair número real do texto da mensagem
            // (ocorre quando o cliente responde com seu número após a IA pedir)
            if (/^\d{14,}$/.test(contact.phone)) {
                const cleanedMsg = msg.body.replace(/[\s\-().+]/g, '');
                let resolvedPhone = null;
                // Mensagem é somente um número (ex: "62999991111" ou "5562999991111")
                if (/^55\d{10,11}$/.test(cleanedMsg)) {
                    resolvedPhone = cleanedMsg;
                } else if (/^\d{10,11}$/.test(cleanedMsg)) {
                    resolvedPhone = cleanedMsg;
                } else {
                    // Busca padrão de telefone dentro de texto livre
                    const m = msg.body.match(/(?:\+?55[\s.-]?)?[\(]?[1-9][1-9][\)]?[\s.-]?(?:9[\s.-]?\d{4}|\d{4})[\s.-]?\d{4}/);
                    if (m) resolvedPhone = m[0].replace(/\D/g, '');
                }
                if (resolvedPhone && resolvedPhone.length >= 10 && resolvedPhone !== contact.phone) {
                    console.log(`📱 Número extraído da mensagem: "${contact.phone}" → "${resolvedPhone}"`);
                    await supabase.from('contacts').update({ phone: resolvedPhone }).eq('id', contactId);
                    phoneToChatId.set(resolvedPhone, chatId);
                    contact.phone = resolvedPhone;
                    io.emit('phone_map_update', Array.from(phoneToChatId.entries()));
                }
            }

            // 2. Salvar a mensagem recebida no Supabase
            const { data: savedMsg, error: msgError } = await supabase
                .from('messages')
                .insert([{
                    contact_id: contactId,
                    sender_type: 'user',
                    content: msg.body
                }])
                .select();

            if (msgError) {
                console.error(`❌ Supabase insert erro:`, JSON.stringify(msgError));
                throw msgError;
            }

            console.log(`✅ Mensagem de ${phone} salva no banco.`);

            // 3. Avisar o frontend em tempo real via Socket.io
            io.emit('new_whatsapp_message', {
                contact: contact,
                message: savedMsg ? savedMsg[0] : null,
                phone: phone,
                chatId: chatId
            });

            // 4. Disparo direto do motor de IA (não depende do Supabase Realtime)
            if (savedMsg && savedMsg[0]) {
                io.emit('wa_message_for_ai', savedMsg[0]);
                console.log(`🤖 Disparando IA para mensagem ${savedMsg[0].id}`);
            }
        } catch (err) {
            console.error('❌ Erro ao processar mensagem recebida:', err);
        }
    });

    return c;
}

async function deleteSessionFiles() {
    try { fs.rmSync('./.wwebjs_auth',  { recursive: true, force: true }); } catch (e) { console.log('⚠️ rmSync auth:', e.message); }
    try { fs.rmSync('./.wwebjs_cache', { recursive: true, force: true }); } catch (e) {}
}

async function safeInitialize() {
    if (isInitializing) {
        console.log('⚠️ Já existe uma inicialização em andamento. Ignorando.');
        return;
    }
    isInitializing = true;
    qrCodeData = null;

    // Feedback imediato ao frontend — mostra spinner enquanto Chrome sobe
    connectionStatus = 'AUTHENTICATING';
    io.emit('status', connectionStatus);

    // Destruir cliente ativo se existir (ex.: Novo QR enquanto já está em WAITING_FOR_QR_SCAN)
    if (client) {
        try { await client.destroy(); } catch (e) {}
        client = null;
        await new Promise(r => setTimeout(r, 1500));
    }

    // Usuário pediu nova sessão (via restart_whatsapp após Desconectar):
    // Aguarda 2s para o Chrome do destroy() sair completamente no Windows,
    // depois deleta os arquivos de sessão para forçar geração de novo QR.
    if (forceNewSession) {
        forceNewSession = false;
        console.log('⏳ Aguardando Chrome encerrar para limpar sessão...');
        await new Promise(r => setTimeout(r, 2000));
        await deleteSessionFiles();
        console.log('🗑️ Sessão limpa — novo QR será gerado.');
    }

    client = createWhatsAppClient();

    try {
        await client.initialize();
    } catch (err) {
        console.error('❌ Erro ao inicializar cliente:', err.message);
        isInitializing = false;
        connectionStatus = 'DISCONNECTED';
        io.emit('status', connectionStatus);
    }
}

// Resolve LIDs salvos no banco para números reais (chamado após WhatsApp conectar)
async function autoResolveLidContacts(waClient) {
    try {
        const { data: rows } = await supabase.from('contacts').select('id, phone').not('phone', 'is', null);
        const lids = (rows || []).filter(r => r.phone && /^\d{14,}$/.test(r.phone));
        if (lids.length === 0) { console.log('✅ Nenhum LID no banco.'); return; }
        console.log(`🔄 Auto-resolvendo ${lids.length} LID(s)...`);

        // Busca todos os contatos do WhatsApp de uma só vez (mais eficiente)
        let allWaContacts = [];
        try { allWaContacts = await waClient.getContacts(); } catch (_) {}

        let resolved = 0;
        for (const row of lids) {
            const lidJid = row.phone + '@lid';
            // Procura pelo JID exato na lista de contatos
            const match = allWaContacts.find(c => c.id?._serialized === lidJid);
            const realPhone = match?.number;
            if (realPhone && realPhone.length >= 8) {
                await supabase.from('contacts').update({ phone: realPhone }).eq('id', row.id);
                phoneToChatId.set(realPhone, lidJid);
                phoneToChatId.set(row.phone, lidJid);
                console.log(`  ✅ ${row.phone} → ${realPhone}`);
                resolved++;
            } else {
                // Fallback: getContactById
                try {
                    const c2 = await waClient.getContactById(lidJid);
                    if (c2?.number && c2.number.length >= 8) {
                        await supabase.from('contacts').update({ phone: c2.number }).eq('id', row.id);
                        phoneToChatId.set(c2.number, lidJid);
                        phoneToChatId.set(row.phone, lidJid);
                        console.log(`  ✅ ${row.phone} → ${c2.number} (fallback)`);
                        resolved++;
                    } else {
                        console.log(`  ⚠️ Sem número para LID ${row.phone}`);
                    }
                } catch (e) {
                    console.log(`  ⚠️ getContactById falhou para ${lidJid}: ${e.message}`);
                }
            }
        }
        if (resolved > 0) io.emit('phone_map_update', Array.from(phoneToChatId.entries()));
        console.log(`✅ ${resolved}/${lids.length} LIDs resolvidos.`);
    } catch (err) {
        console.error('⚠️ autoResolveLidContacts erro:', err.message);
    }
}

// Primeira inicialização
safeInitialize();

// SOCKET (FRONTEND)
io.on('connection', (socket) => {
    console.log('🔗 Frontend conectado:', socket.id);

    socket.emit('status', connectionStatus);
    socket.emit('my_number', connectedNumber);
    if (qrCodeData) socket.emit('qr', qrCodeData);

    socket.on('request_status', () => {
        socket.emit('status', connectionStatus);
        if (qrCodeData) socket.emit('qr', qrCodeData);
        socket.emit('phone_map_update', Array.from(phoneToChatId.entries()));
    });

    // Enviar mensagem via WhatsApp
    socket.on('send_whatsapp_message', async (data) => {
        try {
            if (!client || connectionStatus !== 'CONNECTED') {
                console.log('⚠️ WhatsApp não está conectado. Mensagem não enviada.');
                return;
            }
            const { phone, message } = data;

            // Usa o chatId já mapeado; se não existir (ex: reinício do serviço),
            // tenta @lid (formato novo) e @c.us (formato antigo) na sequência
            const knownId = phoneToChatId.get(phone);
            if (knownId) {
                console.log(`📤 Enviando para ${knownId}: ${message}`);
                await client.sendMessage(knownId, message);
            } else {
                let sent = false;
                for (const suffix of ['@lid', '@c.us']) {
                    try {
                        const candidateId = `${phone}${suffix}`;
                        console.log(`📤 Tentando ${candidateId}...`);
                        await client.sendMessage(candidateId, message);
                        phoneToChatId.set(phone, candidateId); // cacheia para as próximas
                        sent = true;
                        break;
                    } catch (_) {
                        // tenta o próximo formato
                    }
                }
                if (!sent) throw new Error(`Nenhum chatId válido encontrado para ${phone}`);
            }
            console.log('✅ Mensagem enviada pelo WhatsApp!');
        } catch (err) {
            console.error('❌ Erro ao enviar mensagem:', err);
        }
    });

    // Desconectar e limpar sessão
    socket.on('disconnect_whatsapp', async () => {
        console.log('🛑 Desconectando WhatsApp...');
        // logout() invalida a sessão no servidor WA — mesmo que os arquivos locais sobrevivam,
        // o próximo initialize() não conseguirá autenticar e vai gerar novo QR
        try { await client?.logout(); } catch (e) { console.log('⚠️ logout:', e.message); }
        try { await client?.destroy(); } catch (e) {}
        client = null;
        isInitializing = false;
        qrCodeData = null;
        connectedNumber = null;
        connectionStatus = 'DISCONNECTED';
        io.emit('status', connectionStatus);
        io.emit('my_number', null);
        // NÃO fazemos file deletion aqui com delay — causaria race condition se o usuário
        // clicar Conectar antes do timer expirar (deletaria arquivos do novo cliente)
        console.log('✅ Desconectado. Clique Conectar para gerar novo QR.');
    });

    // Gerar novo QR — força reinício mesmo se já estava inicializando
    socket.on('restart_whatsapp', async () => {
        console.log('🔄 Gerando novo QR (pedido do usuário)...');
        isInitializing = false;
        forceNewSession = true;
        await safeInitialize();
    });

    // Teste de conexão: verifica estado do cliente e envia mensagem para si mesmo
    socket.on('test_connection', async () => {
        console.log('🔬 Teste de conexão solicitado...');
        try {
            if (!client || connectionStatus !== 'CONNECTED') {
                socket.emit('test_result', { success: false, error: 'WhatsApp não conectado' });
                return;
            }

            const state = await client.getState();
            let messageSent = false;
            let sendError = null;

            if (connectedNumber) {
                // Tenta enviar para si mesmo — testa o caminho de envio completo
                for (const suffix of ['@c.us', '@lid']) {
                    try {
                        const selfId = `${connectedNumber}${suffix}`;
                        const testMsg = `🔬 Teste ImobAI — ${new Date().toLocaleTimeString('pt-BR')} — conexão OK!`;
                        await client.sendMessage(selfId, testMsg);
                        phoneToChatId.set(connectedNumber, selfId);
                        messageSent = true;
                        console.log(`✅ Mensagem de teste enviada para ${selfId}`);
                        break;
                    } catch (e) {
                        sendError = e.message;
                    }
                }
            }

            socket.emit('test_result', {
                success: messageSent,
                state,
                connectedNumber,
                phoneToChatIdSize: phoneToChatId.size,
                messageSent,
                sendError: messageSent ? null : sendError,
            });
        } catch (err) {
            console.error('❌ Erro no teste de conexão:', err);
            socket.emit('test_result', { success: false, error: err.message });
        }
    });

    // Resolver LIDs manualmente (pedido da view Atendimentos)
    socket.on('resolve_lids', async (contacts) => {
        console.log(`🔍 resolve_lids: ${contacts?.length} contatos solicitados`);
        if (!client || connectionStatus !== 'CONNECTED') {
            socket.emit('resolve_lids_result', (contacts || []).map(c => ({ ...c, error: 'WhatsApp não conectado' })));
            return;
        }
        const results = [];
        // Busca todos os contatos do WhatsApp de uma só vez
        let allWaContacts = [];
        try { allWaContacts = await client.getContacts(); } catch (_) {}

        for (const { id, phone } of (contacts || [])) {
            const lidJid = phone + '@lid';
            let resolved = false;

            // Tenta pela lista completa de contatos
            const match = allWaContacts.find(c => c.id?._serialized === lidJid);
            if (match?.number && match.number.length >= 8) {
                phoneToChatId.set(match.number, lidJid);
                phoneToChatId.set(phone, lidJid);
                results.push({ id, oldPhone: phone, newPhone: match.number });
                console.log(`  ✅ ${phone} → ${match.number}`);
                resolved = true;
            }

            if (!resolved) {
                // Fallback: getContactById
                try {
                    const c2 = await client.getContactById(lidJid);
                    if (c2?.number && c2.number.length >= 8) {
                        phoneToChatId.set(c2.number, lidJid);
                        phoneToChatId.set(phone, lidJid);
                        results.push({ id, oldPhone: phone, newPhone: c2.number });
                        console.log(`  ✅ ${phone} → ${c2.number} (fallback)`);
                        resolved = true;
                    }
                } catch (_) {}
            }

            if (!resolved) {
                results.push({ id, oldPhone: phone, error: 'Número não encontrado' });
                console.log(`  ⚠️ Não resolvido: ${phone}`);
            }
        }
        io.emit('phone_map_update', Array.from(phoneToChatId.entries()));
        socket.emit('resolve_lids_result', results);
    });
});

// Capturar erros não tratados para evitar crash do processo
process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro não capturado (ignorado):', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Promise rejeitada (ignorada):', reason?.message || reason);
});

app.get('/', (_req, res) => res.send({ status: 'WhatsApp Service Running', connectionStatus }));

app.get('/api/debug', (_req, res) => {
    res.json({
        connectionStatus,
        connectedNumber,
        isInitializing,
        clientReady: !!client,
        phoneToChatIdSize: phoneToChatId.size,
        phoneToChatIdEntries: Array.from(phoneToChatId.entries()).slice(0, 10),
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 WhatsApp Microservice rodando na porta ${PORT}`));
