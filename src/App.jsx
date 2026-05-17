import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import './App.css';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import KanbanBoard from './components/KanbanBoard';
import Dashboard from './components/Dashboard';
import ChatOmni from './components/ChatOmni';
import AIAgentConfig from './components/AIAgentConfig';
import Settings from './components/Settings';
import WhatsAppManager from './components/WhatsAppManager';
import Atendimentos from './components/Atendimentos';
import Login from './components/Login';
import { supabase, checkConnection } from './lib/supabase';
import { startAIEngine, processAILogic } from './lib/ai-engine';
import { io as socketIO } from 'socket.io-client';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [currentView, setCurrentView] = useState('kanban');
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Tema
  useEffect(() => {
    const savedTheme = localStorage.getItem('imobai-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(isSystemDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('imobai-theme', theme);
  }, [theme]);

  // Autenticação Supabase e Checagem de Conexão
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log("Iniciando initApp...");
        // Verificar conexão mínima
        const conn = await checkConnection();
        console.log("Conexão Supabase:", conn);
        if (!conn.ok) {
          setConnectionError(conn.error);
        }

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (err) {
        console.error("Erro na inicialização:", err);
        setConnectionError(err.message);
      } finally {
        setLoadingAuth(false);
      }
    };

    initApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Iniciar Motor de IA do ImobAI quando houver sessão ativa
  useEffect(() => {
    if (!session) return;
    startAIEngine();
  }, [session]);

  // Listener direto: dispara IA quando mensagem WhatsApp chega (sem depender do Supabase Realtime)
  useEffect(() => {
    if (!session) return;
    const socket = socketIO('http://localhost:3001', { transports: ['websocket', 'polling'] });

    socket.on('wa_message_for_ai', (message) => {
      console.log('🤖 App.jsx recebeu wa_message_for_ai:', message);
      processAILogic(message);
    });

    return () => {
      socket.off('wa_message_for_ai');
      socket.disconnect();
    };
  }, [session]);

  // Fallback Realtime: garante que mensagens não sejam perdidas se o socket falhar durante restart
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel('ai_realtime_fallback')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new?.sender_type === 'user') {
          // Delay de 2s: dá tempo ao socket disparar primeiro; dedup no ai-engine evita duplo processamento
          setTimeout(() => processAILogic(payload.new), 2000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const getPageInfo = () => {
    const map = {
      kanban:        { title: 'Dashboard',            subtitle: 'Visão geral: métricas, pipeline e atividade recente' },
      crm:           { title: 'CRM',                  subtitle: 'Pipeline Kanban — Vendas, Locação e Captação' },
      omni:          { title: 'Chat',                 subtitle: 'Orquestração de contatos e atendimento por IA' },
      whatsapp:      { title: 'Contas de WhatsApp',   subtitle: 'Conexão e gerenciamento do número WhatsApp da conta' },
      atendimentos:  { title: 'Atendimentos',          subtitle: 'Todos os contatos com telefone, ID WhatsApp e status de atendimento' },
      'ai-config':   { title: 'Agente Virtual IA',    subtitle: 'Treinamento, configurações e chaves de API do Cérebro (Gemini)' },
      settings:      { title: 'Configurações',        subtitle: 'Gerencie sua conta, integrações, canais e preferências' },
    };
    return map[currentView] || { title: 'Em breve', subtitle: 'Este módulo está em desenvolvimento' };
  };

  const { title, subtitle } = getPageInfo();

  if (loadingAuth) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', flexDirection: 'column', gap: '1rem' }}>
        <RefreshCw className="animate-spin" size={32} />
        <p>Iniciando o ImobAI...</p>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', padding: '2rem', textAlign: 'center' }}>
        <div className="glass-panel" style={{ maxWidth: '400px', padding: '2rem', border: '1px solid var(--accent-primary)' }}>
          <AlertCircle size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '1rem' }}>Erro de Conexão</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Não foi possível conectar ao banco de dados Supabase. Verifique sua conexão com a internet e se as credenciais no arquivo .env estão corretas.
          </p>
          <pre style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', overflow: 'auto', marginBottom: '1.5rem' }}>
            {connectionError}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se o corretor não estiver logado, exibe a tela SignIn
  if (!session) {
    return <Login />;
  }

  // Se logado, exibe o painel principal
  return (
    <div className="app-container">
      <Sidebar 
        theme={theme} 
        toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      <main className="main-content">
        <Topbar title={title} subtitle={subtitle} />
        
        <div className="content-area">
          <AnimatePresence mode="wait">
            {currentView === 'kanban' && (
              <motion.div
                key="kanban-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <Dashboard />
              </motion.div>
            )}

            {currentView === 'crm' && (
              <motion.div
                key="crm-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <KanbanBoard />
              </motion.div>
            )}

            {currentView === 'omni' && (
              <motion.div 
                key="omni-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <ChatOmni />
              </motion.div>
            )}

            {currentView === 'ai-config' && (
              <motion.div 
                key="ai-config-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
              >
                <AIAgentConfig />
              </motion.div>
            )}
            {currentView === 'settings' && (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <Settings />
              </motion.div>
            )}
            {currentView === 'whatsapp' && (
              <motion.div
                key="whatsapp-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', overflowY: 'auto', padding: '1.5rem' }}
              >
                <WhatsAppManager />
              </motion.div>
            )}
            {currentView === 'atendimentos' && (
              <motion.div
                key="atendimentos-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', overflow: 'hidden' }}
              >
                <Atendimentos />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
