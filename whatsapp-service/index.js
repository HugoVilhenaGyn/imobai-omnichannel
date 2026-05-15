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

// Mapa phone → chatId completo (ex: '184125281595582' → '184125281595582@lid')
const phoneToChatId = new Map();

function createWhatsAppClient() {
    const c = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
    });

    c.on('qr', (qr) => {
        console.log('🔄 Novo QR Code gerado.');
        qrCodeData = qr;
        connectionStatus = 'WAITING_FOR_QR_SCAN';
        io.emit('qr', qrCodeData);
        io.emit('status', connectionStatus);
    });

    c.on('authenticated', () => {
        console.log('✅ QR Code Escaneado! Autenticando...');
        connectionStatus = 'AUTHENTICATING';
        io.emit('status', connectionStatus);
    });

    c.on('auth_failure', msg => {
        console.error('❌ Falha na autenticação:', msg);
        connectionStatus = 'DISCONNECTED';
        isInitializing = false;
        io.emit('status', connectionStatus);
    });

    c.on('loading_screen', (percent, message) => {
        console.log('⏳ Carregando WhatsApp...', percent, message);
    });

    c.on('ready', () => {
        console.log('📱 Cliente WhatsApp conectado e pronto!');
        qrCodeData = null;
        connectionStatus = 'CONNECTED';
        connectedNumber = c.info?.wid?.user || null;
        isInitializing = false;
        io.emit('status', connectionStatus);
        io.emit('my_number', connectedNumber);
        console.log(`📞 Número conectado: ${connectedNumber}`);
    });

    c.on('disconnected', (reason) => {
        console.log('❌ WhatsApp desconectado:', reason);
        connectionStatus = 'DISCONNECTED';
        connectedNumber = null;
        isInitializing = false;
        io.emit('status', connectionStatus);
        io.emit('my_number', null);
    });

    // ESCUTANDO MENSAGENS DO WHATSAPP (E SALVANDO NO SUPABASE)
    c.on('message', async msg => {
        try {
            console.log(`📩 Nova mensagem de ${msg.from}: ${msg.body}`);

            // Ignora status, grupos, broadcasts e mensagens vazias
            if (msg.isStatus) return;
            if (msg.from.includes('@g.us')) return;
            if (msg.from.includes('@broadcast')) return;
            if (!msg.body || !msg.body.trim()) return;

            // Aceita tanto @c.us (formato antigo) quanto @lid (formato novo do WhatsApp)
            const isValidContact = msg.from.includes('@c.us') || msg.from.includes('@lid');
            if (!isValidContact) return;

            const phone = msg.from.replace('@c.us', '').replace('@lid', '');
            const contactName = msg._data.notifyName || phone;
            
            const chatId = msg.from;
            console.log(`✅ Processando mensagem válida de: ${contactName} (${phone}) [${chatId}]`);

            // Salvar mapeamento phone → chatId para usar na resposta
            phoneToChatId.set(phone, chatId);

            // 1. Procurar ou criar o contato no Supabase
            let { data: contacts } = await supabase
                .from('contacts')
                .select('*')
                .eq('phone', phone);

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
                // Atualizar updated_at para o contato subir na lista
                await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', contactId);
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

            if (msgError) throw msgError;

            console.log(`✅ Mensagem de ${phone} salva no banco.`);

            // 3. Avisar o frontend em tempo real via Socket.io
            io.emit('new_whatsapp_message', {
                contact: contact,
                message: savedMsg ? savedMsg[0] : null,
                phone: phone,
                chatId: chatId // Inclui o ID completo para responder corretamente
            });
        } catch (err) {
            console.error('❌ Erro ao processar mensagem recebida:', err);
        }
    });

    return c;
}

async function safeInitialize() {
    if (isInitializing) {
        console.log('⚠️ Já existe uma inicialização em andamento. Ignorando.');
        return;
    }
    isInitializing = true;
    qrCodeData = null;
    connectionStatus = 'DISCONNECTED';
    io.emit('status', connectionStatus);

    // Destruir o cliente anterior se existir
    if (client) {
        try { await client.destroy(); } catch (e) {}
        client = null;
    }

    // Aguardar um pouco para o Puppeteer liberar os recursos
    await new Promise(r => setTimeout(r, 1500));

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
        try { await client.destroy(); } catch (e) {}
        client = null;
        isInitializing = false;

        // Limpar cache da sessão
        try { fs.rmSync('./.wwebjs_auth', { recursive: true, force: true }); } catch (e) {}
        try { fs.rmSync('./.wwebjs_cache', { recursive: true, force: true }); } catch (e) {}

        qrCodeData = null;
        connectionStatus = 'DISCONNECTED';
        io.emit('status', connectionStatus);
        console.log('✅ Sessão limpa. Pronto para reconectar.');
    });

    // Reconectar (gerar novo QR)
    socket.on('restart_whatsapp', async () => {
        console.log('🔄 Reconectando WhatsApp...');
        await safeInitialize();
    });
});

// Capturar erros não tratados para evitar crash do processo
process.on('uncaughtException', (err) => {
    console.error('⚠️ Erro não capturado (ignorado):', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Promise rejeitada (ignorada):', reason?.message || reason);
});

app.get('/', (req, res) => res.send({ status: 'WhatsApp Service Running', connectionStatus }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 WhatsApp Microservice rodando na porta ${PORT}`));
