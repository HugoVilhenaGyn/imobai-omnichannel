-- Estrutura Inicial do Banco de Dados ImobAI - Omnichannel (PostgreSQL / Supabase)
-- Copie este código e cole no SQL Editor do seu projeto Supabase para rodar

-- 0. Limpeza de resquícios (Garante que não haverá erro de "Already Exists" caso você rode 2 vezes ou tenha códigos antigos)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;

DROP TYPE IF EXISTS channel_type CASCADE;
DROP TYPE IF EXISTS contact_status CASCADE; q
DROP TYPE IF EXISTS department_type CASCADE;

-- 1. Habilitar a extensão UUID (vital para segurança dos IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enums para organização estrita (Tipagem forte no banco)
CREATE TYPE channel_type AS ENUM ('whatsapp', 'website', 'email', 'instagram');

-- O Kanban reflete este status de pipeline
CREATE TYPE contact_status AS ENUM (
  'novo_contato',       -- Acabou de chegar, IA atende / recepciona
  'triagem_ia',         -- IA está conversando ativamente
  'novo_lead',          -- Identificado como lead real (coluna 'Novo')
  'contatado',          -- Corretor Humano já assumiu/falou (coluna 'Contatado')
  'qualificado',        -- Lead qualificado (coluna 'Qualificado')
  'negociacao_visita',  -- Em visita/negociando (coluna 'Negociação')
  'ganho_fechado',      -- Contrato fechado ('Ganho')
  'perdido'             -- Não rolou negócio
);

-- Os departamentos que a IA vai direcionar
CREATE TYPE department_type AS ENUM ('vendas', 'locacao', 'captacao', 'suporte', 'geral', 'nao_direcionado');

-- 3. Tabela Central de Contatos/Leads (A que vai abastecer o Kanban)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  original_channel channel_type NOT NULL DEFAULT 'whatsapp',
  status contact_status NOT NULL DEFAULT 'novo_contato',
  intent department_type NOT NULL DEFAULT 'nao_direcionado',
  handled_by_ai BOOLEAN DEFAULT true, -- Flag "Sendo atendido pela IA" x "Humano assumiu"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Mensagens Omnichannel (A que vai abastecer a tela de Chat)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('user', 'ai_agent', 'human_agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Agentes/Corretores (Para gerenciar quem está online)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE, -- Link para auth.users (Tabela de usuários do próprio Supabase)
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'corretor',
  department department_type
);

-- 6. Segurança (Row Level Security - RLS)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Para facilitar os testes iniciais e a visualização no Front-end, liberamos o acesso público
-- (Antes de publicar o app em produção, mudaremos `USING (true)` para `USING (auth.role() = 'authenticated')`)
CREATE POLICY "Public access to contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Public access to messages" ON messages FOR ALL USING (true);
CREATE POLICY "Public access to agents" ON agents FOR ALL USING (true);

-- 7. Trigger para atualizar sempre a coluna 'updated_at' do contato
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
