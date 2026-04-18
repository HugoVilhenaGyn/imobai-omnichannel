# ImobAI - Omnichannel CRM 🤖🏢

O **ImobAI** é uma plataforma inovadora de CRM Omnichannel desenhada especificamente para o setor Imobiliário. A aplicação combina a gestão de leads (em formato Kanban) ao atendimento integrado via chat, permitindo transições fluidas entre o atendimento realizado por uma Inteligência Artificial avançada (Google Gemini) e corretores humanos.

## ✨ O que foi desenvolvido

Até o momento, a aplicação conta com uma infraestrutura sólida de front-end dinâmico e integração com o Backend como Serviço (Supabase). Abaixo estão os principais módulos desenvolvidos:

### 1. 📊 Kanban Board (Gestão de Pipeline)
- Pipeline visual das etapas de venda/locação/captação.
- Permite arrastar os leads pelas fases: *Novo Contato, Triagem IA, Novo Lead, Contatado, Qualificado, Negociação/Visita, Ganho/Fechado, Perdido*.
- Integração em tempo real com o banco de dados de contatos.

### 2. 💬 Chat Omnichannel (Orquestração Humano x IA)
- Interface de chat em tempo real onde o contato conversa naturalmente com o agente.
- O sistema mostra se a conversa está sendo comandada pela IA ou pelo Humano.
- Organização de fila de contatos lateral, segmentação por departamentos (Vendas, Locação, Captação) e canais (WhatsApp, Website, etc.).

### 3. 🧠 Configuração do Agente de IA (Cérebro Gemini)
- Painel para configurar o comportamento da IA (Nome, Persona, Nível de Criatividade/Temperatura).
- Gestão e inserção das Chaves de API necessárias para conectar ao LLM.
- Campo longo de "Prompt Base" (Treinamento) para definir as diretrizes que a IA deve seguir ao recepcionar os clientes.

### 4. 🔒 Autenticação e UX
- Tela de **Login** segura (E-mail/Senha) conectada à infraestrutura do Supabase Auth.
- Temas **Dark Mode** e **Light Mode**, com preferência salva localmente.
- Layout de painel estilo "Dashboard", com barra lateral retrátil (Sidebar) e Topbar contextual.

---

## 🛠️ Stack Tecnológica

O projeto foi construído focando em uma estética moderna, usando tecnologias ágeis:
- **React (v19) + Vite:** Base do Frontend (Single Page Application rápida).
- **Framer Motion:** Responsável pelas micro-animações, transições de páginas e efeitos visuais imersivos que dão a cara de app premium.
- **Lucide React:** Biblioteca de ícones harmônicos e profissionais.
- **Supabase (PostgreSQL):** Banco de dados relacional forte, Auth e comunicação Realtime para mensagens e status dos leads.
- **Vanilla CSS:** Utilizando variáveis CSS fortes (`index.css` e `App.css`) para gerir paletas de cores, temas escuros/claros e *Glassmorphism*.

---

## 🗄️ Estrutura do Banco de Dados

O script `supabase_setup.sql` gerou o esquema transacional principal:
1. **`contacts`**: A central de clientes, onde se define o estágio no funil (`contact_status`), canal de origem e departamento intenção.
2. **`messages`**: Histórico detalhado de fluxos de chat, contendo a flag que diferencia se foi enviada pelo Contato, IA, ou Corretor humano.
3. **`agents`**: Mapeamento dos usuários master (corretores) da imobiliária.

---

## 🚀 Como Rodar o Projeto (Ambiente de Desenvolvimento)

### 1. Variáveis de Ambiente
O projeto exige as variáveis de conexão com o banco e possivelmente com a IA em um arquivo `.env` na raiz:
```env
VITE_SUPABASE_URL=seu_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

### 2. Comandos

Instalar as dependências:
```bash
npm install
```

Iniciar o servidor de desenvolvimento:
```bash
npm run dev
```
*(Alternativamente, pode usar o arquivo utilitário `INICIAR_SISTEMA.bat` caso esteja no Windows)*

Construir a versão de Produção:
```bash
npm run build
```
