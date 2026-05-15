import React from 'react';
import {
  LayoutDashboard, Smartphone, Users, GitBranch, MessageSquare,
  Headphones, BarChart2, FileText, Calendar, Megaphone, RotateCcw,
  Contact, Users2, ChevronDown, Moon, Sun, Settings, LogOut, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const mainNav = [
  { id: 'kanban',        label: 'Dashboard',           icon: LayoutDashboard },
  { id: 'whatsapp',      label: 'Contas de WhatsApp',  icon: Smartphone },
  { id: 'agentes',       label: 'Agentes',             icon: Users,         disabled: true },
  { id: 'flow',          label: 'Flow Builder',        icon: GitBranch,     disabled: true },
  { id: 'omni',          label: 'Chat',                icon: MessageSquare },
  { id: 'atendimentos',  label: 'Atendimentos',        icon: Headphones,    disabled: true },
  { id: 'crm',           label: 'CRM',                 icon: BarChart2,     disabled: true, chevron: true },
  { id: 'templates',     label: 'Templates',           icon: FileText,      disabled: true },
  { id: 'agendamentos',  label: 'Agendamentos',        icon: Calendar,      disabled: true },
  { id: 'campanhas',     label: 'Campanhas',           icon: Megaphone,     disabled: true },
  { id: 'remarketing',   label: 'Remarketing',         icon: RotateCcw,     disabled: true },
  { id: 'contatos',      label: 'Contatos',            icon: Contact,       disabled: true },
  { id: 'equipe',        label: 'Equipe',              icon: Users2,        disabled: true },
];

export default function Sidebar({ theme, toggleTheme, currentView, setCurrentView }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Sparkles size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span className="sidebar-logo-text">ImobAI</span>
      </div>

      <div className="sidebar-nav">
        {mainNav.map(({ id, label, icon: Icon, disabled, chevron }) => (
          <button
            key={id}
            className={`nav-item${currentView === id ? ' active' : ''}${disabled ? ' nav-disabled' : ''}`}
            onClick={() => !disabled && setCurrentView(id)}
            title={disabled ? 'Em breve' : label}
          >
            <Icon size={18} />
            <span>{label}</span>
            {chevron && <ChevronDown size={14} className="nav-chevron" />}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
        <button
          className={`nav-item${currentView === 'settings' ? ' active' : ''}`}
          onClick={() => setCurrentView('settings')}
        >
          <Settings size={18} />
          <span>Configurações</span>
        </button>
        <button className="nav-item nav-logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </div>
    </nav>
  );
}
