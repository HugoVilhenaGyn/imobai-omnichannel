import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Key, FileText, ToggleLeft, ToggleRight, Save, CheckCircle2, AlertTriangle, Sparkles, ExternalLink, BookOpen, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do PDF.js de forma garantida buscando da mesma versão
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function AIAgentConfig() {
  const [active, setActive] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [agentName, setAgentName] = useState('Corretor Virtual ImobAI');
  const [prompt, setPrompt] = useState(`Você é um corretor virtual simpático e extremamente prestativo da ImobAI. Sua função é responder clientes, descobrir o que eles querem e qualificar o contato para os corretores humanos. Seja gentil, persuasivo, ágil e use emojis.
MUITO IMPORTANTE: Não invente dados de imóveis, apenas faça triagem.`);
  const [policies, setPolicies] = useState(`1. Nunca invente informações. Se não souber, diga: "Vou solicitar a um de nossos corretores para verificar essa informação específica para você."
2. Nosso horário de atendimento comercial é de Segunda a Sexta, das 09h às 18h.
3. Não passamos descontos diretamente no chat, informe que o corretor avaliará a proposta.`);
  const [catalog, setCatalog] = useState(`- Apartamento Vila Mariana: 2 Quartos, Suíte, Varanda Gourmet. Valor: R$ 850.000,00. Código: AP850.
- Casa Condomínio Fechado Alphaville: 4 Quartos, Piscina, 3 Vagas. Valor: R$ 3.200.000. Código: CA32M.`);
  const [contextDocs, setContextDocs] = useState(`- Somos uma imobiliária digital inovadora.
- Documentação necessária para locar: RG, CPF, Comprovante de Renda (3x o valor do aluguel).
- Formas de garantia: Caução ou Seguro Fiança.`);
  const [saved, setSaved] = useState(false);
  const [isExtractingFile, setIsExtractingFile] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Por favor, anexe apenas arquivos PDF.");
      return;
    }

    setIsExtractingFile(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = `\n--- Importado do arquivo: ${file.name} ---\n`;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStrings = textContent.items.map(item => item.str);
        fullText += pageStrings.join(' ') + '\n';
      }
      
      setContextDocs(prev => prev + '\n' + fullText);
      
    } catch (err) {
      console.error("Erro ao processar PDF:", err);
      alert("Não foi possível ler o texto deste PDF.");
    } finally {
      setIsExtractingFile(false);
      e.target.value = null; // Limpa input
    }
  };

  useEffect(() => {
    // Carregar configurações locais se existirem
    const savedConfig = localStorage.getItem('imobai_ai_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setActive(parsed.active !== undefined ? parsed.active : true);
        setApiKey(parsed.apiKey || '');
        setAgentName(parsed.agentName || 'Corretor Virtual ImobAI');
        setPrompt(parsed.prompt || prompt);
        setPolicies(parsed.policies || policies);
        setCatalog(parsed.catalog || catalog);
        setContextDocs(parsed.contextDocs || contextDocs);
      } catch (e) {
        console.error('Erro ao ler config do localStorage', e);
      }
    }
  }, []);

  const handleSave = () => {
    const config = { active, apiKey, agentName, prompt, policies, catalog, contextDocs };
    localStorage.setItem('imobai_ai_config', JSON.stringify(config));

    // Mostra feedback visual
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          <Bot size={28} color="var(--accent-primary)" /> Configuração da Inteligência Artificial
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>
          Gerencie o cérebro que orquestra o seu Omnichannel. Conecte sua chave de API e treine o comportamento da sua IA para automatizar o funil de vendas.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Toggle de Ativação e Status Pulsante */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0 }}>Cérebro da IA</h3>
              
              {/* Badge Pulsante de Status Constante */}
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, 
                padding: '4px 10px', borderRadius: '12px', 
                backgroundColor: active ? (apiKey.length > 5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)') : 'rgba(239, 68, 68, 0.1)', 
                color: active ? (apiKey.length > 5 ? '#10b981' : '#f59e0b') : '#ef4444',
                border: `1px solid ${active ? (apiKey.length > 5 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)') : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                <motion.div 
                  animate={ active && apiKey.length > 5 ? { scale: [1, 1.8, 1], opacity: [1, 0.4, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  style={{ 
                    width: '8px', height: '8px', borderRadius: '50%', 
                    backgroundColor: active ? (apiKey.length > 5 ? '#10b981' : '#f59e0b') : '#ef4444',
                    boxShadow: active && apiKey.length > 5 ? '0 0 8px #10b981' : 'none'
                  }}
                />
                {active ? (apiKey.length > 5 ? 'ONLINE (GEMINI)' : 'AGUARDANDO CHAVE') : 'OFFLINE'}
              </div>

            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              {active ? (apiKey.length > 5 ? 'A Inteligência está conectada e habilitada para interagir.' : 'Preencha a chave API Google para ativar.') : 'Cérebro desligado. O bot não responderá clientes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActive(!active)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: active ? '#10b981' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600,
              transition: 'all 0.3s'
            }}
          >
            {active ? 'DESLIGAR' : 'LIGAR IA'}
            {active ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
          </button>
        </div>

        {/* API Key */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
              <Key size={18} color="var(--accent-primary)" /> Chave API (Google Gemini)
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none' }}
            >
              Obter chave Gratuita <ExternalLink size={14} />
            </a>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Cole sua chave gerada no Google AI Studio (Gemini 2.5 Flash). Sem essa chave, o Bot rodará em modo simulação offline.
          </p>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem'
            }}
          />
        </div>

        {/* Informações de Perfil */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
            <Sparkles size={18} color="var(--accent-primary)" /> Nome do Assistente Virtual
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Ex: Ana - Inteligência ImobAI"
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem'
            }}
          />
        </div>

        {/* Prompt Base */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
            <FileText size={18} color="var(--accent-primary)" /> Instrução Base (Prompt do Agente)
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Descreva detalhadamente como a IA deve agir, falar e quais regras ela deve seguir ao falar com clientes da imobiliária.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '6px', color: '#eab308' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
              <strong>Anti-Alucinação Base:</strong> Instruções mais fortes e limitações de modelo serão injetadas sistemicamente na API.
            </span>
          </div>
        </div>

        {/* Políticas de Atendimento (Memória de Contexto Fixo) */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
            <AlertTriangle size={18} color="var(--accent-primary)" /> Regras e Trava Anti-Alucinação (Políticas)
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Defina estritamente o que a IA não pode fazer e não deve inventar. Coloque restrições de horários, regras de negócio ou comandos diretos de comportamento. As melhores práticas dizem para usar regras numeradas.
          </p>
          <textarea
            value={policies}
            onChange={(e) => setPolicies(e.target.value)}
            rows={4}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
            }}
          />
        </div>

        {/* Contexto e Documentos Institucionais */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <BookOpen size={18} color="var(--accent-primary)" /> Contexto e FAQ (Documentos de Consulta)
              </label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Cole aqui a história da imobiliária ou perguntas frequentes. Você também pode importar um arquivo PDF inteiro para o robô ler nativamente e jogar na caixa abaixo de forma mágica.
              </p>
            </div>
            <div>
              <input 
                type="file" 
                accept=".pdf" 
                id="pdf-upload" 
                style={{ display: 'none' }} 
                onChange={handleFileUpload} 
              />
              <label 
                htmlFor="pdf-upload" 
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600,
                  backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px 12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', cursor: 'pointer',
                  opacity: isExtractingFile ? 0.6 : 1, pointerEvents: isExtractingFile ? 'none' : 'auto',
                  whiteSpace: 'nowrap', marginTop: '4px'
                }}
              >
                <Upload size={14} />
                {isExtractingFile ? 'EXTRAINDO...' : 'IMPORTAR PDF'}
              </label>
            </div>
          </div>
          <textarea
            value={contextDocs}
            onChange={(e) => setContextDocs(e.target.value)}
            rows={5}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
            }}
          />
        </div>

        {/* Catálogo de Imóveis (Micro-RAG Manual) */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>
            <FileText size={18} color="var(--accent-primary)" /> Catálogo de Treinamento (Imóveis e Dados)
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Cole aqui a lista de imóveis ou textos sobre os quais a IA tem permissão de buscar. Se perguntarem algo fora desta lista, a Política bloqueia a IA de inventar.
          </p>
          <textarea
            value={catalog}
            onChange={(e) => setCatalog(e.target.value)}
            rows={6}
            style={{
              width: '100%', padding: '0.875rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)', outline: 'none', fontSize: '0.95rem',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
            }}
          />
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', marginRight: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
              <CheckCircle2 size={18} /> Configurações Salvas!
            </span>
          )}
          <button
            onClick={handleSave}
            style={{
              backgroundColor: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '0.75rem 1.5rem',
              fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'opacity 0.2s',
            }}
          >
            <Save size={18} /> Salvar e Aplicar no Cérebro IA
          </button>
        </div>

      </div>
    </div>
  );
}
