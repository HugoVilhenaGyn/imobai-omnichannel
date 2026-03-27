import React, { useState, useEffect } from 'react';
import { Bot, Key, FileText, ToggleLeft, ToggleRight, Save, CheckCircle2, AlertTriangle, Sparkles, ExternalLink } from 'lucide-react';

export default function AIAgentConfig() {
  const [active, setActive] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [agentName, setAgentName] = useState('Corretor Virtual ImobAI');
  const [prompt, setPrompt] = useState(`Você é um corretor virtual simpático e extremamente prestativo da ImobAI. Sua função é responder clientes, descobrir o que eles querem e qualificar o contato para os corretores humanos. Seja gentil, persuasivo, ágil e use emojis.
MUITO IMPORTANTE: Não invente dados de imóveis, apenas faça triagem.`);
  const [saved, setSaved] = useState(false);

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
      } catch (e) {
        console.error('Erro ao ler config do localStorage', e);
      }
    }
  }, []);

  const handleSave = () => {
    const config = { active, apiKey, agentName, prompt };
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
        
        {/* Toggle de Ativação */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '4px' }}>Status do Agente Virtual</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ativa ou desativa a triagem automática no chat.</p>
          </div>
          <button 
            type="button"
            onClick={() => setActive(!active)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: active ? '#10b981' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 600
            }}
          >
            {active ? 'ATIVADO' : 'DESATIVADO'}
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
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }}/>
            <span style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
              <strong>Atenção:</strong> O sistema injetará automaticamente as instruções estruturais JSON no final deste prompt para garantir a orquestração do Kanban. Evite pedir formatações estranhas aqui.
            </span>
          </div>
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
