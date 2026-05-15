import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Bot, 
  Share2, 
  Shield, 
  Bell, 
  Palette, 
  CreditCard,
  ChevronRight,
  Database,
  Smartphone
} from 'lucide-react';
import AIAgentConfig from './AIAgentConfig';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [qrCodeData, setQrCodeData] = useState(null);
  const [waStatus, setWaStatus] = useState('DISCONNECTED');

  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io('http://localhost:3001', {
      reconnectionAttempts: 5,
      timeout: 3000,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('status', (status) => {
      setWaStatus(status);
      if (status === 'CONNECTED') setQrCodeData(null);
    });

    socket.on('qr', (qr) => {
      setQrCodeData(qr);
    });

    socket.on('connect_error', () => {
      setWaStatus('DISCONNECTED');
      setQrCodeData(null);
    });

    return () => socket.disconnect();
  }, []);

  const handleDisconnect = () => {
    if (socketRef.current) socketRef.current.emit('disconnect_whatsapp');
    setQrCodeData(null);
  };

  const handleRestart = () => {
    if (socketRef.current) socketRef.current.emit('restart_whatsapp');
  };

  const tabs = [
    { id: 'profile', name: 'Perfil do Usuário', icon: User, description: 'Gerencie seus dados e senha' },
    { id: 'ai', name: 'Agente IA & Cérebro', icon: Bot, description: 'Configurações de treinamento e API' },
    { id: 'channels', name: 'Canais & Integrações', icon: Share2, description: 'WhatsApp, Instagram e Site' },
    { id: 'security', name: 'Segurança & Permissões', icon: Shield, description: 'Controle de acesso e LGPD' },
    { id: 'notifications', name: 'Notificações', icon: Bell, description: 'Alertas de novos leads e chat' },
    { id: 'appearance', name: 'Aparência', icon: Palette, description: 'Cores e temas do sistema' },
    { id: 'billing', name: 'Plano & Cobrança', icon: CreditCard, description: 'Gerencie sua assinatura' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'ai':
        return <AIAgentConfig />;
      case 'profile':
        return (
          <div className="settings-tab-content">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={24} color="var(--accent-primary)" /> Perfil do Usuário
            </h3>
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  HV
                </div>
                <div>
                  <h4 style={{ margin: 0 }}>Hugo Vilhena</h4>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0' }}>Administrador (Dono)</p>
                  <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Trocar Foto</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" className="form-input" defaultValue="Hugo Vilhena" />
                </div>
                <div className="form-group">
                  <label>E-mail Principal</label>
                  <input type="email" className="form-input" defaultValue="contato@hugovilhena.com" />
                </div>
                <div className="form-group">
                  <label>Cargo / Função</label>
                  <input type="text" className="form-input" defaultValue="Diretor Comercial" />
                </div>
                <div className="form-group">
                  <label>Telefone / WhatsApp</label>
                  <input type="text" className="form-input" defaultValue="+55 62 99999-9999" />
                </div>
              </div>

              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <button className="btn-primary">Salvar Alterações</button>
              </div>
            </div>
          </div>
        );
      case 'channels':
        return (
          <div className="settings-tab-content">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Share2 size={24} color="var(--accent-primary)" /> Canais & Integrações
            </h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(37, 211, 102, 0.1)', color: '#25D366' }}>
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0 }}>WhatsApp (QR Code)</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {waStatus === 'CONNECTED' ? 'Dispositivo conectado!' : 'Escaneie o QR Code para conectar'}
                      </p>
                    </div>
                  </div>
                  {waStatus === 'CONNECTED' ? (
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <span className="badge success">ATIVO</span>
                      <button onClick={handleDisconnect} className="btn-secondary" style={{padding: '4px 10px', fontSize: '0.75rem', borderColor: '#ef4444', color: '#ef4444'}}>Desconectar</button>
                    </div>
                  ) : waStatus === 'WAITING_FOR_QR_SCAN' ? (
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>AGUARDANDO QR</span>
                      <button onClick={handleRestart} className="btn-secondary" style={{padding: '4px 10px', fontSize: '0.75rem'}}>Gerar Novo</button>
                    </div>
                  ) : (
                     <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>DESCONECTADO</span>
                      <button onClick={handleRestart} className="btn-secondary" style={{padding: '4px 10px', fontSize: '0.75rem'}}>Conectar</button>
                    </div>
                  )}
                </div>
                
                {qrCodeData && waStatus !== 'CONNECTED' && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', alignSelf: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                    <QRCodeSVG value={qrCodeData} size={220} />
                  </div>
                )}
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(255, 0, 105, 0.1)', color: '#FF0069' }}>
                    <Share2 size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0 }}>Instagram Direct</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Responda comentários e DMs via IA</p>
                  </div>
                </div>
                <button className="btn-secondary">Conectar</button>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
                    <Database size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0 }}>Integração CRM (Supabase)</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sincronismo de leads em tempo real</p>
                  </div>
                </div>
                <span className="badge success">CONECTADO</span>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Em breve: Componentes de {activeTab} em construção...</p>
          </div>
        );
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <div style={{ padding: '0 1rem 1.5rem 1rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Configurações</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ajuste o ImobAI ao seu negócio</p>
        </div>
        
        <div className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="nav-item-icon">
                <tab.icon size={20} />
              </div>
              <div className="nav-item-info">
                <span className="nav-item-name">{tab.name}</span>
                <span className="nav-item-desc">{tab.description}</span>
              </div>
              {activeTab === tab.id && <ChevronRight size={16} className="active-arrow" />}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-content">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .settings-container {
          display: grid;
          grid-template-columns: 280px 1fr;
          height: calc(100vh - 140px);
          overflow: hidden;
          background-color: var(--bg-secondary);
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        .settings-sidebar {
          background-color: rgba(255, 255, 255, 0.02);
          border-right: 1px solid var(--border-color);
          padding: 1.5rem 0;
          overflow-y: auto;
        }

        .settings-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .settings-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 1.5rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          position: relative;
        }

        .settings-nav-item:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }

        .settings-nav-item.active {
          background-color: rgba(124, 58, 237, 0.1);
          color: var(--accent-primary);
        }

        .settings-nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background-color: var(--accent-primary);
        }

        .nav-item-icon {
          flex-shrink: 0;
        }

        .nav-item-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .nav-item-name {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .nav-item-desc {
          font-size: 0.7rem;
          opacity: 0.7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .active-arrow {
          margin-left: auto;
        }

        .settings-content {
          padding: 2rem;
          overflow-y: auto;
          background-color: var(--bg-main);
        }

        .settings-tab-content {
          max-width: 800px;
          margin: 0 auto;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-main);
        }

        .form-input {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-secondary);
          color: var(--text-main);
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          border-color: var(--accent-primary);
        }

        .btn-primary {
          background-color: var(--accent-primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .btn-secondary {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
          border: 1px solid var(--border-color);
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .badge.success {
          background-color: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
      `}} />
    </div>
  );
}
