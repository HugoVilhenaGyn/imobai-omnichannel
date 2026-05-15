# CHANGELOG — ImobAI Omnichannel

> Histórico de desenvolvimento e correções por sessão de trabalho.

---

## Sessão — 2026-05-14

### 1. Formatação de número de telefone nos tickets

**Problema:** O campo `contacts.phone` era armazenado em formato bruto (ex: `5562999991111`), aparecendo como um ID numérico nos cards do KanbanBoard e na lista do ChatOmni.

**Solução:**
- Criado `src/lib/formatPhone.js` — função `formatPhone(raw)` que detecta o formato brasileiro (DDI 55 + DDD 2 dígitos + 8 ou 9 dígitos) e retorna o número formatado: `+55 62 9999-1111`.
- Aplicado em `src/components/KanbanBoard.jsx` (card do ticket).
- Aplicado em `src/components/ChatOmni.jsx` (lista de contatos e cabeçalho do chat ativo — mostra `+55 62 9999-1111 · Sendo atendido pela IA`).

**Arquivos alterados:**
- `src/lib/formatPhone.js` *(novo)*
- `src/components/KanbanBoard.jsx`
- `src/components/ChatOmni.jsx`

---

### 2. Novo menu: Contas de WhatsApp

**Motivação:** O usuário pediu um item dedicado no menu principal para gerenciar a conexão WhatsApp da conta (uma por conta), onde informações técnicas como o ID de sessão ficam visíveis — separando isso das Configurações gerais.

**Solução:**
- Criado `src/components/WhatsAppManager.jsx` com:
  - Número conectado exibido formatado (`+55 62 9999-0001`).
  - Badge de status colorido (ATIVO / AGUARDANDO QR / DESCONECTADO).
  - QR Code via `qrcode.react` quando necessário.
  - ID de sessão técnico (`wid.user`) visível com estilo `monospace`.
  - Botões: Conectar / Desconectar / Gerar Novo QR.
  - Conexão Socket.IO própria com `http://localhost:3001`.
- Adicionado item **"Contas de WhatsApp"** (`Smartphone` icon) no `src/components/Sidebar.jsx`.
- Adicionado roteamento `'whatsapp'` em `src/App.jsx`.

**Arquivos alterados:**
- `src/components/WhatsAppManager.jsx` *(novo)*
- `src/components/Sidebar.jsx`
- `src/App.jsx`

---

### 3. whatsapp-service: emissão do número conectado

**Motivação:** O frontend não sabia qual número de telefone estava conectado ao WhatsApp — exibia apenas "Dispositivo conectado!".

**Solução:**
- No evento `ready` do cliente WhatsApp (`whatsapp-service/index.js`): lê `client.info.wid.user` e emite evento `my_number` via Socket.IO para todos os clientes conectados.
- Também emite ao reconectar um cliente Socket.IO já com sessão ativa.
- No evento `disconnected`: emite `my_number: null`.
- Adicionada variável global `connectedNumber` para manter o estado entre conexões.

**Arquivo alterado:**
- `whatsapp-service/index.js`

---

### 4. Correção crítica: respostas da IA não voltavam ao WhatsApp

**Problema:** O fluxo estava incompleto. Quando uma mensagem chegava via WhatsApp:
1. O serviço recebia e salvava no Supabase ✅
2. O AI Engine processava e salvava a resposta no Supabase ✅
3. **A resposta da IA nunca era enviada de volta ao WhatsApp do cliente** ❌

**Solução:**
- Em `src/lib/ai-engine.js`: adicionada conexão Socket.IO persistente (`waSocket`).
- Após salvar a resposta da IA no Supabase, se `contact.original_channel === 'whatsapp'`, emite `send_whatsapp_message` via socket com `{ phone, message }`.
- O fluxo completo agora é: **WhatsApp → Service → Supabase → AI Engine → Socket → Service → WhatsApp** ✅

**Arquivo alterado:**
- `src/lib/ai-engine.js`

---

### 5. Correção: fallback @lid / @c.us no envio de mensagens

**Problema:** O mapa `phoneToChatId` (phone → chatId completo com sufixo `@lid` ou `@c.us`) é armazenado em memória. Ao reiniciar o `whatsapp-service`, o mapa é zerado. O fallback anterior era sempre `@c.us`, que falha para contatos no formato `@lid` (WhatsApp novo), causando falha silenciosa no envio.

**Solução:**
- Quando o mapa está vazio (sem registro para o phone), tenta enviar com `@lid` primeiro e depois `@c.us`.
- Ao encontrar o formato que funciona, registra no mapa para reutilização nas próximas mensagens do mesmo contato.

**Arquivo alterado:**
- `whatsapp-service/index.js`

---

### 6. Correção: updated_at do contato ao responder como corretor

**Problema:** Quando o corretor enviava uma mensagem via ChatOmni, o `updated_at` do contato não era atualizado — fazendo o contato perder a posição no topo da lista (ordenada por `updated_at DESC`).

**Solução:**
- Após salvar a mensagem com sucesso no Supabase, executa `supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', activeContact.id)`.

**Arquivo alterado:**
- `src/components/ChatOmni.jsx`

---

### 7. Redesign completo da Sidebar

**Motivação:** O menu lateral não seguia o padrão visual de referência fornecido pelo usuário — ícone desproporcional, layout com glass-effect e margem flutuante, apenas 3 itens, sem os módulos futuros.

**Solução — Sidebar.jsx:**
- Removida classe `glass-panel` da nav; sidebar agora usa CSS próprio sem blur/glass.
- Adicionados todos os itens do modelo de referência:

| Item | View | Status |
|---|---|---|
| Dashboard | `kanban` | ✅ funcional |
| Contas de WhatsApp | `whatsapp` | ✅ funcional |
| Agentes | — | 🔒 em breve |
| Flow Builder | — | 🔒 em breve |
| Chat | `omni` | ✅ funcional |
| Atendimentos | — | 🔒 em breve |
| CRM | — | 🔒 em breve (com chevron ▾) |
| Templates | — | 🔒 em breve |
| Agendamentos | — | 🔒 em breve |
| Campanhas | — | 🔒 em breve |
| Remarketing | — | 🔒 em breve |
| Contatos | — | 🔒 em breve |
| Equipe | — | 🔒 em breve |

- Itens desabilitados: opacidade 45%, cursor padrão, tooltip "Em breve", sem hover ativo.
- Rodapé: Tema, Configurações, Sair — com hover vermelho no Sair.
- Removido item "Agente Virtual IA" do menu principal (permanece em Configurações > Agente IA & Cérebro).

**Solução — App.css:**
- Sidebar: `width: 230px`, flush (sem margin), `background-color: var(--bg-secondary)`, `border-right`, scroll oculto.
- `.nav-item`: `font-size: 0.875rem`, `padding: 0.55rem 0.75rem`, `border-radius: 8px`, `gap: 0.65rem`.
- `.nav-item svg`: `flex-shrink: 0` — corrige ícone encolhendo em flex com texto longo.
- `.nav-item span`: `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`.
- `.nav-item.active`: fundo roxo translúcido `rgba(124,58,237,0.15)` sem `border-left`.
- `.nav-disabled`: opacidade reduzida, sem hover ativo.
- `.nav-logout`: hover vermelho suave.

**Arquivos alterados:**
- `src/components/Sidebar.jsx`
- `src/App.css`
- `src/App.jsx` (getPageInfo atualizado: Kanban → Dashboard, novo mapa de títulos)

---

## Stack de referência

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite |
| Animações | Framer Motion |
| Ícones | Lucide React ^1.7.0 |
| Banco / Auth / Realtime | Supabase (PostgreSQL) |
| IA Generativa | Google Gemini 2.5 Flash |
| WhatsApp Client | whatsapp-web.js (Puppeteer) |
| Comunicação Realtime | Socket.IO (frontend ↔ whatsapp-service) |
| CSS | Vanilla CSS com variáveis (glassmorphism + temas) |

---

## Arquivos criados nesta sessão

| Arquivo | Descrição |
|---|---|
| `src/lib/formatPhone.js` | Utilitário de formatação de telefone brasileiro |
| `src/components/WhatsAppManager.jsx` | Painel de gerenciamento da conexão WhatsApp |
| `CHANGELOG.md` | Este arquivo |
