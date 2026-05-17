# Relatório ImobAI — 17/05/2026 (revisão final)

> **Propósito deste arquivo:** memória técnica permanente. Consultar ANTES de qualquer alteração nos módulos listados para não regredir correções já estabilizadas.

---

## Infraestrutura

- [x] Vite dev server — `http://localhost:5173`
- [x] WhatsApp service — `http://localhost:3001` (nodemon, auto-restart ao salvar `index.js`)
- [x] Supabase conectado (Realtime ativo)
- [x] Chrome path: `C:/Program Files/Google/Chrome/Application/chrome.exe`
- [x] Sessão WA persistida em `.wwebjs_auth/` (ignorada pelo nodemon)

---

## Estado atual — o que está funcionando

### Dashboard `/kanban`
- Cards de métricas, % conversão, pipeline por coluna, atividade recente, Realtime

### CRM `/crm`
- 5 colunas kanban, abas Vendas/Locação/Captação, drag & drop, busca, Realtime

### Chat Omnichannel `/omni`
- Lista de contatos com telefone formatado
- Badge não-lido, notificação de browser
- Enviar mensagem → WhatsApp real
- Botão "Assumir" (desativa IA) / "Simular" (força resposta IA)
- Scroll automático para última mensagem
- Realtime via Supabase + Socket.IO

### Atendimentos `/atendimentos`
- Grid completo, busca, stats, Realtime
- Botão "Corrigir" (editar telefone manual)
- Botão "Resolver IDs" (tenta resolver LIDs via API WA)

### Contas de WhatsApp `/whatsapp`
- QR Code gerado ao iniciar / ao clicar Conectar
- Status: ATIVO / AGUARDANDO QR / AUTENTICANDO / DESCONECTADO
- Spinner imediato ao clicar Conectar (antes do QR chegar)
- Botão "Testar Conexão" (apenas quando CONNECTED)
- Painel colapsável de IDs mapeados
- Auto-reconexão com sessão salva (sem QR)

### Motor de IA (Lisa)
- Gemini 2.5 Flash via fetch do browser
- Configuração em `localStorage` (`imobai_ai_config`)
- Fallback simulação quando sem API Key
- Dedup: evita duplo processamento (socket + Realtime)
- Instrução automática para pedir telefone quando contato tem LID

---

## Arquivos críticos — inventário e estado atual

### `whatsapp-service/index.js`

**Variáveis de estado (módulo):**
```js
let qrCodeData = null;
let connectionStatus = 'DISCONNECTED';
let connectedNumber = null;
let isInitializing = false;
let client = null;
let forceNewSession = false; // sinaliza sessão nova explícita pelo usuário
const phoneToChatId = new Map(); // phone/LID → chatId completo (@c.us ou @lid)
```

**Funções principais e invariantes críticos:**

#### `deleteSessionFiles()`
```js
async function deleteSessionFiles() {
    try { fs.rmSync('./.wwebjs_auth',  { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync('./.wwebjs_cache', { recursive: true, force: true }); } catch (e) {}
}
```
- Chamada APENAS de dentro de `safeInitialize()` quando `forceNewSession=true`
- **NÃO chamar com delay assíncrono de outro contexto** — causa race condition

#### `safeInitialize()`
```js
async function safeInitialize() {
    if (isInitializing) { return; } // guard: evita execução concorrente
    isInitializing = true;
    qrCodeData = null;

    // INVARIANTE: setar AUTHENTICATING ANTES de qualquer destroy()
    // Isso protege o handler disconnected de interferir
    connectionStatus = 'AUTHENTICATING';
    io.emit('status', connectionStatus);

    if (client) {
        await client.destroy(); // dispara disconnected no cliente antigo
        // disconnected é ignorado pois connectionStatus === 'AUTHENTICATING'
        client = null;
        await new Promise(r => setTimeout(r, 1500));
    }

    if (forceNewSession) {
        forceNewSession = false;
        await new Promise(r => setTimeout(r, 2000)); // Chrome precisa sair no Windows
        await deleteSessionFiles();
    }

    client = createWhatsAppClient();
    try { await client.initialize(); }
    catch (err) {
        isInitializing = false;
        connectionStatus = 'DISCONNECTED';
        io.emit('status', connectionStatus);
    }
}
```
- **REGRA 1:** `connectionStatus = 'AUTHENTICATING'` deve ser setado ANTES de `client.destroy()`
- **REGRA 2:** Não chamar `deleteSessionFiles()` com delay de outro handler assíncrono
- **REGRA 3:** `forceNewSession` só é setado pelo `restart_whatsapp` handler

#### `c.on('disconnected')` — INVARIANTE MAIS CRÍTICO
```js
c.on('disconnected', (reason) => {
    clearAuthTimer();
    connectedNumber = null;
    io.emit('my_number', null);

    // SE connectionStatus === 'AUTHENTICATING':
    // safeInitialize() está no meio de uma reinicialização intencional.
    // O destroy() do cliente antigo dispara este evento — NÃO interferir.
    // O novo cliente vai emitir os status corretos.
    if (connectionStatus === 'AUTHENTICATING') {
        return; // ← NÃO REMOVER esta guarda
    }

    connectionStatus = 'DISCONNECTED';
    isInitializing = false;
    io.emit('status', connectionStatus);
});
```
- **NUNCA remover o guard `if (connectionStatus === 'AUTHENTICATING') return`**
- Sem ele: `client.destroy()` emite DISCONNECTED → frontend congela em branco → QR nunca aparece

#### `socket.on('disconnect_whatsapp')`
```js
socket.on('disconnect_whatsapp', async () => {
    try { await client?.logout(); } catch (e) {} // invalida sessão no servidor WA
    try { await client?.destroy(); } catch (e) {}
    client = null;
    isInitializing = false;
    qrCodeData = null;
    connectedNumber = null;
    connectionStatus = 'DISCONNECTED';
    io.emit('status', connectionStatus);
    io.emit('my_number', null);
    // NÃO fazer deleteSessionFiles() aqui com delay assíncrono
    // Motivo: se o usuário clicar Conectar antes do timer expirar,
    // os arquivos do novo cliente seriam apagados → Chrome crasha → sem QR
});
```
- `logout()` invalida a sessão no servidor WA (garante que arquivos antigos sejam inúteis mesmo que não deletados)
- **SEM delay de deleção aqui** — a deleção fica em `safeInitialize()` via `forceNewSession`

#### `socket.on('restart_whatsapp')`
```js
socket.on('restart_whatsapp', async () => {
    isInitializing = false;
    forceNewSession = true; // garante limpeza de sessão antes de iniciar
    await safeInitialize();
});
```

#### `isRealPhone` — filtro de LID
```js
const isRealPhone = (n) => n && n.length >= 8 && n.length <= 13;
```
- Números reais: 8–13 dígitos
- LIDs do WhatsApp: 14–15 dígitos — **não são telefones, não armazenar como phone**

#### Extração de telefone do texto da mensagem
Quando `contact.phone` tem 14+ dígitos (LID), o serviço tenta extrair telefone real da mensagem:
```js
if (/^\d{14,}$/.test(contact.phone)) {
    // tenta: número puro, com DDI 55, ou regex de telefone no texto livre
    // se encontrar: atualiza DB + phoneToChatId
}
```

---

### `src/lib/ai-engine.js`

**Variáveis:**
```js
const _processing = new Map(); // dedup: contact_id:content → timestamp
const waSocket = io('http://localhost:3001', { autoConnect: true });
```

**Dedup de mensagens:**
```js
const dedupKey = `${newMessage.contact_id}:${newMessage.content}`;
const lastTs = _processing.get(dedupKey);
if (lastTs && Date.now() - lastTs < 30000) return;
_processing.set(dedupKey, Date.now());
```
- Evita duplo processamento: socket (`wa_message_for_ai`) + Realtime fallback (2s delay)
- Dedup key deletada no `catch` para permitir retry pelo fallback

**`phonePending` — IA pede telefone quando LID:**
```js
const phonePending = Boolean(contact.phone && /^\d{14,}$/.test(contact.phone));
```
- Quando `true`: injeta instrução no system prompt para pedir número de forma natural
- IA não repete o pedido se histórico já tiver número

**Envio via WhatsApp:**
```js
if (contact.original_channel === 'whatsapp' && contact.phone) {
    waSocket.emit('send_whatsapp_message', { phone: contact.phone, message: respostaIA });
}
```

---

### `src/components/WhatsAppManager.jsx`

**Estados:**
```js
const [qrCodeData, setQrCodeData]   = useState(null);
const [waStatus, setWaStatus]       = useState('DISCONNECTED');
const [myNumber, setMyNumber]       = useState(null);
const [connecting, setConnecting]   = useState(false);
const [socketOk, setSocketOk]       = useState(false);
```

**Lógica de botões:**
- `Conectar` → visível quando `DISCONNECTED`
- `Novo QR` → visível em qualquer estado não-CONNECTED
- Ambos emitem `restart_whatsapp` e setam `forceNewSession=true` no backend
- `Testar Conexão` → **apenas quando `waStatus === 'CONNECTED'`** (não alterar)
- `Desconectar` → quando `waStatus !== 'DISCONNECTED'`

**Área do QR — lógica de renderização:**
```jsx
{waStatus !== 'CONNECTED' && (
  qrCodeData
    ? <QRCodeSVG value={qrCodeData} size={220} />
    : (connecting || waStatus === 'AUTHENTICATING' || waStatus === 'WAITING_FOR_QR_SCAN')
      ? <Loader2 /> // spinner "Iniciando Chrome..."
      : null
)}
```
- `WAITING_FOR_QR_SCAN` sem `qrCodeData`: janela de transição → spinner (não deixar blank)

**Handler de status — clearConnecting:**
```js
if (status === 'DISCONNECTED') { setLoadingPct(null); clearConnecting(); }
```
- `clearConnecting()` em DISCONNECTED é necessário para limpar o spinner do botão quando WA cai

---

### `src/lib/formatPhone.js`

```js
export function isLidPhone(phone) {
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 14; // LID = 14+ dígitos
}

export function formatPhone(raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 14) return raw; // LID — não formatar
    // ... formatação brasileira +55 XX XXXXX-XXXX
}
```
- Usado em: `ChatOmni.jsx`, `WhatsAppManager.jsx`, `KanbanBoard.jsx`, `Atendimentos.jsx`

---

### `src/components/ChatOmni.jsx`

**Padrão `activeContactRef`:**
```js
const activeContactRef = useRef(null);
useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);
```
- **Obrigatório** para closures do Realtime/socket terem o contato atual sem stale closure
- **NUNCA** ler `activeContact` dentro de callbacks do Supabase — usar `activeContactRef.current`

**Realtime de mensagens:**
```js
.on('postgres_changes', { event: 'INSERT', table: 'messages' }, (payload) => {
    const current = activeContactRef.current;
    if (current && payload.new.contact_id === current.id) {
        fetchMessagesLocal(current.id);
    }
})
```
- Antes era `prev[0].contact_id` dentro de `setMessages` — causava freeze quando array vazio

**Click no mesmo contato:**
```js
const handleContactClick = (c) => {
    setLoadingMessages(true);
    if (activeContact?.id === c.id) {
        fetchMessagesLocal(c.id); // mesma conversa: recarrega direto
    } else {
        setMessages([]);
        setActiveContact(c); // troca: limpa e deixa useEffect buscar
    }
};
```
- Antes: click no mesmo contato travava em "Carregando..." para sempre

---

## Histórico de bugs corrigidos

### Bug 1 — IA não respondia
- **Causa:** dedup via socket + Realtime disparavam dois processamentos; Gemini retornava erro silencioso
- **Fix:** `Map` de dedup com janela de 30s; fallback Realtime com delay de 2s
- **Arquivo:** `src/lib/ai-engine.js`

### Bug 2 — Scroll não mostrava última mensagem
- **Causa:** `scrollToBottom()` com setTimeout era cancelado por re-render
- **Fix:** `useEffect` em `[messages]` com `scrollIntoView()`
- **Arquivo:** `src/components/ChatOmni.jsx`

### Bug 3 — Click no contato travava em "Carregando..."
- **Causa:** segundo click no mesmo contato não re-disparava o `useEffect` (mesma referência)
- **Fix:** `handleContactClick` chama `fetchMessagesLocal` diretamente para mesmo contato
- **Arquivo:** `src/components/ChatOmni.jsx`

### Bug 4 — Mensagens não chegavam após excluir contato
- **Causa:** Realtime usava `prev[0].contact_id` dentro de `setMessages` — falha quando array vazio
- **Fix:** `activeContactRef.current` para leitura do contato ativo em closures
- **Arquivo:** `src/components/ChatOmni.jsx`

### Bug 5 — Telefone do WhatsApp aparecia como ID de 15 dígitos (LID)
- **Causa:** WhatsApp Privacy — `@lid` format não expõe número real. `msg.getContact()` retornava o próprio LID (14+ dígitos) como `number`
- **Fix:** `isRealPhone = (n) => n.length >= 8 && n.length <= 13` — rejeita LIDs
- **Fix UI:** `isLidPhone()` → exibe "⚠ ID interno WA" em âmbar em vez do número bruto
- **Arquivo:** `whatsapp-service/index.js`, `src/lib/formatPhone.js`, `src/components/ChatOmni.jsx`

### Bug 6 — IA não pedia o número e não atualizava automaticamente
- **Causa:** IA não tinha instrução para pedir telefone; serviço não extraía telefone do texto
- **Fix:** `phonePending` flag → injeta instrução no system prompt do Gemini
- **Fix:** extração via regex do corpo da mensagem quando contato tem LID
- **Arquivo:** `src/lib/ai-engine.js`, `whatsapp-service/index.js`

### Bug 7 — QR não aparecia imediatamente após Desconectar → Conectar (tentativa 1)
- **Causa:** `safeInitialize()` não emitia status ao iniciar; delay de 1500ms mesmo com `client=null`
- **Fix:** emite `AUTHENTICATING` imediatamente; spinner no frontend durante aguardo
- **Arquivo:** `whatsapp-service/index.js`, `src/components/WhatsAppManager.jsx`

### Bug 8 — Race condition: `disconnect_whatsapp` apagava arquivos do novo cliente
- **Causa:** handler `disconnect_whatsapp` tinha `await 2000ms → deleteFiles()` em background. Se usuário clicasse Conectar antes, o timer apagava `.wwebjs_auth` do Chrome novo → crash sem QR
- **Fix:** retirado delay de deleção do `disconnect_whatsapp`. Deleção movida para `safeInitialize()` via `forceNewSession`. `client.logout()` invalida sessão no servidor WA como camada extra de segurança
- **Arquivo:** `whatsapp-service/index.js`

### Bug 9 — QR sumia ao clicar "Novo QR" e não voltava (BUG PRINCIPAL)
- **Causa raiz:** `client.destroy()` dentro de `safeInitialize()` disparava o evento `disconnected` do cliente antigo. O handler `disconnected` executava `connectionStatus = 'DISCONNECTED'` e `io.emit('status', 'DISCONNECTED')` → frontend recebia DISCONNECTED → limpava estado → tela em branco. O novo Chrome continuava iniciando mas o frontend não sabia
- **Fix:** guard no handler `disconnected`:
  ```js
  if (connectionStatus === 'AUTHENTICATING') { return; }
  ```
  `safeInitialize()` seta `AUTHENTICATING` ANTES do `destroy()`. Assim o disconnect do cliente antigo é ignorado. Apenas disconnects inesperados (quando status não é AUTHENTICATING) atualizam o estado
- **Arquivo:** `whatsapp-service/index.js` — `c.on('disconnected', ...)` dentro de `createWhatsAppClient()`

---

## Regras que NÃO devem ser alteradas (risco de regressão)

| # | Regra | Arquivo | Linha approx. |
|---|---|---|---|
| 1 | `if (connectionStatus === 'AUTHENTICATING') return` no handler `disconnected` | `index.js` | `c.on('disconnected')` |
| 2 | `connectionStatus = 'AUTHENTICATING'` ANTES de `client.destroy()` em `safeInitialize()` | `index.js` | `safeInitialize()` |
| 3 | `deleteSessionFiles()` NUNCA com delay em handler separado | `index.js` | `disconnect_whatsapp` |
| 4 | `activeContactRef.current` em closures do Realtime (nunca `activeContact` direto) | `ChatOmni.jsx` | Realtime subscription |
| 5 | `isRealPhone = n.length <= 13` (rejeita LIDs de 14+ dígitos) | `index.js` | handler `message` |
| 6 | `Testar Conexão` só visível quando `waStatus === 'CONNECTED'` | `WhatsAppManager.jsx` | botões |
| 7 | Dedup de IA: chave deletada no `catch` para permitir retry | `ai-engine.js` | `processAILogic` |
| 8 | `handleContactClick` mesmo contato → `fetchMessagesLocal` direto | `ChatOmni.jsx` | `handleContactClick` |

---

## Fluxo completo: Conectar WhatsApp (do zero)

```
1. Serviço inicia → safeInitialize()
   → connectionStatus = 'AUTHENTICATING' (emite ao frontend)
   → createWhatsAppClient() → client.initialize()
   → Chrome abre (~10s)
   → evento 'qr' → connectionStatus = 'WAITING_FOR_QR_SCAN' → emite QR

2. Frontend exibe QR code (via QRCodeSVG)
   → usuário escaneia com WhatsApp no celular

3. evento 'authenticated' → connectionStatus = 'AUTHENTICATING'
   → loading_screen events (0% → 100%) → barra de progresso no frontend

4. evento 'ready' → connectionStatus = 'CONNECTED'
   → isInitializing = false
   → connectedNumber = c.info.wid.user
   → autoResolveLidContacts() em 5s
```

## Fluxo: Desconectar → Conectar

```
1. Usuário clica Desconectar
   → frontend emite 'disconnect_whatsapp'
   → backend: logout() + destroy() + status=DISCONNECTED emitido

2. Usuário clica Conectar
   → frontend: setConnecting(true), setQrCodeData(null), emite 'restart_whatsapp'
   → backend: forceNewSession=true, safeInitialize()

3. safeInitialize():
   → connectionStatus = 'AUTHENTICATING' (emite — spinner no frontend)
   → client é null (já destruído) → sem destroy adicional
   → forceNewSession=true → aguarda 2s → deleteSessionFiles()
   → createWhatsAppClient() → client.initialize()
   → Chrome inicia (~10s) → QR gerado → frontend exibe QR
```

## Fluxo: LID → Telefone real

```
1. Mensagem chega de @lid (WhatsApp Privacy)
   → msg.getContact() → LID retornado (não é telefone)
   → isRealPhone() rejeita (14+ dígitos)
   → contato salvo com phone = "184125281595582" (LID)

2. IA responde: "Poderia me informar seu número de WhatsApp?"
   (phonePending=true injeta essa instrução no system prompt)

3. Usuário responde "62999991111"
   → serviço detecta: contact.phone é LID (14+ dígitos)
   → regex extrai telefone da mensagem
   → atualiza contacts.phone + phoneToChatId
   → próximas mensagens vão para o número real
```

---

*Gerado em 17/05/2026 — ImobAI Omnichannel — revisão final*
