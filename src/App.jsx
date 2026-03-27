import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';
import './App.css';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import KanbanBoard from './components/KanbanBoard';
import ChatOmni from './components/ChatOmni';
import AIAgentConfig from './components/AIAgentConfig';
import Login from './components/Login';
import { supabase, checkConnection } from './lib/supabase';
import { startAIEngine } from './lib/ai-engine';
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
        // Verificar conexão mínima
        const conn = await checkConnection();
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
    let aiChannel;
    if (session) {
      aiChannel = startAIEngine();
    }
    return () => {
      // Cleanup para evitar listeners duplicados
      if (aiChannel) supabase.removeChannel(aiChannel);
    };
  }, [session]);

  const getPageInfo = () => {
    if (currentView === 'kanban') {
      return { title: 'Kanban Pipeline', subtitle: 'Gestão de leads: Venda, Locação e Captação' };
    }
    if (currentView === 'ai-config') {
      return { title: 'Agente Virtual IA', subtitle: 'Treinamento, configurações e chaves de API do Cérebro (Gemini)' };
    }
    return { title: 'Chat Omnichannel', subtitle: 'Orquestração de contatos e IA' };
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
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
