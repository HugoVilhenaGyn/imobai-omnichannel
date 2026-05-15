import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, RefreshCw, WifiOff, Hash } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { formatPhone } from '../lib/formatPhone';

export default function WhatsAppManager() {
  const [qrCodeData, setQrCodeData] = useState(null);
  const [waStatus, setWaStatus] = useState('DISCONNECTED');
  const [myNumber, setMyNumber] = useState(null);
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

    socket.on('qr', (qr) => setQrCodeData(qr));

    socket.on('my_number', (num) => setMyNumber(num));

    socket.on('connect_error', () => {
      setWaStatus('DISCONNECTED');
      setQrCodeData(null);
      setMyNumber(null);
    });

    return () => socket.disconnect();
  }, []);

  const handleDisconnect = () => {
    if (socketRef.current) socketRef.current.emit('disconnect_whatsapp');
    setQrCodeData(null);
    setMyNumber(null);
  };

  const handleRestart = () => {
    if (socketRef.current) socketRef.current.emit('restart_whatsapp');
  };

  const statusColor = {
    CONNECTED: '#10b981',
    WAITING_FOR_QR_SCAN: '#f59e0b',
    AUTHENTICATING: '#f59e0b',
    DISCONNECTED: '#ef4444',
  }[waStatus] || '#ef4444';

  const statusLabel = {
    CONNECTED: 'ATIVO',
    WAITING_FOR_QR_SCAN: 'AGUARDANDO QR',
    AUTHENTICATING: 'AUTENTICANDO...',
    DISCONNECTED: 'DESCONECTADO',
  }[waStatus] || 'DESCONECTADO';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.3rem' }}>
        <Smartphone size={24} color="var(--accent-primary)" />
        WhatsApp
      </h2>

      {/* Card principal */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Status + número conectado */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: 'rgba(37, 211, 102, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#25D366', flexShrink: 0
            }}>
              <Smartphone size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: statusColor }}>{statusLabel}</span>
              </div>
              {waStatus === 'CONNECTED' && myNumber ? (
                <p style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                  {formatPhone(myNumber)}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {waStatus === 'CONNECTED' ? 'Carregando número...' : 'Nenhum número conectado'}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {waStatus === 'CONNECTED' ? (
              <button
                onClick={handleDisconnect}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', borderColor: '#ef4444', color: '#ef4444' }}
              >
                <WifiOff size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Desconectar
              </button>
            ) : (
              <button
                onClick={handleRestart}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {waStatus === 'WAITING_FOR_QR_SCAN' ? 'Gerar Novo QR' : 'Conectar'}
              </button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {qrCodeData && waStatus !== 'CONNECTED' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Abra o WhatsApp no seu celular → Dispositivos Conectados → Conectar Dispositivo
            </p>
            <div style={{
              backgroundColor: '#fff', borderRadius: 16, padding: '1.5rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)'
            }}>
              <QRCodeSVG value={qrCodeData} size={220} />
            </div>
          </div>
        )}

        {/* ID de sessão */}
        {myNumber && (
          <div style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '1rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.78rem', color: 'var(--text-muted)'
          }}>
            <Hash size={13} />
            <span>ID de sessão:</span>
            <code style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              padding: '2px 8px', borderRadius: 6,
              fontFamily: 'monospace', letterSpacing: '0.03em',
              color: 'var(--text-main)'
            }}>{myNumber}</code>
          </div>
        )}
      </div>

      {/* Instrução quando desconectado */}
      {waStatus === 'DISCONNECTED' && !qrCodeData && (
        <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Clique em <strong>Conectar</strong> para gerar o QR Code e vincular o seu WhatsApp.
        </div>
      )}
    </motion.div>
  );
}
