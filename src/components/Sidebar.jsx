import React from 'react';
import { Moon, Sun, MessageSquare, LayoutDashboard, Settings, Sparkles, LogOut, Bot } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Sidebar({ theme, toggleTheme, currentView, setCurrentView }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="glass-panel sidebar">
      <div className="logo-area">
        <div className="logo-mark">
          <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
          ImobAI
        </div>
      </div>
      
      <div className="nav-links">
        <button 
          className={`nav-item ${currentView === 'kanban' ? 'active' : ''}`}
          onClick={() => setCurrentView('kanban')}
        >
          <LayoutDashboard size={20} />
          <span>Kanban Pipeline</span>
        </button>
        <button 
          className={`nav-item ${currentView === 'omni' ? 'active' : ''}`}
          onClick={() => setCurrentView('omni')}
        >
          <MessageSquare size={20} />
          <span>Chat Omnichannel</span>
        </button>
        <button 
          className={`nav-item ${currentView === 'ai-config' ? 'active' : ''}`}
          onClick={() => setCurrentView('ai-config')}
        >
          <Bot size={20} />
          <span>Agente Virtual IA</span>
        </button>
      </div>

      <div className="nav-footer">
        <button className="nav-item" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
        <button className="nav-item">
          <Settings size={20} />
          <span>Configurações</span>
        </button>
        <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--text-muted)' }}>
          <LogOut size={20} />
          <span>Sair (Logout)</span>
        </button>
      </div>
    </nav>
  );
}
