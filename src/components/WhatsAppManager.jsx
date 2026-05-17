import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, RefreshCw, WifiOff, Hash, Loader2, FlaskConical, CheckCircle, XCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { formatPhone } from '../lib/formatPhone';

const WA_SERVICE_URL = 'http://localhost:3001';

export default function WhatsAppManager() {
  const [qrCodeData, setQrCodeData]   = useState(null);
  const [waStatus, setWaStatus]       = useState('DISCONNECTED');
  const [myNumber, setMyNumber]       = useState(null);
  const [connecting, setConnecting]   = useState(false);
  const [socketOk, setSocketOk]       = useState(false);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState(null);
  const [loadingPct, setLoadingPct]   = useState(null);
  const [phoneMap, setPhoneMap]       = useState([]);   // [[phone, chatId], ...]
  const [showMap, setShowMap]         = useState(false);
  const socketRef        = useRef(null);
  const connectTimeoutRef = useRef(null);

  const clearConnecting = useCallback(() => {
    setConnecting(false);
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const socket = io(WA_SERVICE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketOk(true);
      socket.emit('request_status');
    });

    socket.on('disconnect', () => {
      setSocketOk(false);
    });

    socket.on('connect_error', () => {
      setSocketOk(false);
      setWaStatus('DISCONNECTED');
    });

    socket.on('status', (status) => {
      setWaStatus(status);
      if (status === 'CONNECTED') {
        setQrCodeData(null);
        setLoadingPct(null);
        clearConnecting();
      }
      if (status === 'WAITING_FOR_QR_SCAN') { setLoadingPct(null); clearConnecting(); }
      if (status === 'AUTHENTICATING')      clearConnecting();
      if (status === 'DISCONNECTED')        { setLoadingPct(null); clearConnecting(); }
    });

    socket.on('loading_progress', ({ percent }) => {
      setLoadingPct(percent);
    });

    socket.on('qr', (qr) => {
      setQrCodeData(qr);
      clearConnecting();
    });

    socket.on('my_number', (num) => setMyNumber(num));

    socket.on('phone_map_update', (entries) => setPhoneMap(entries || []));

    socket.on('test_result', (result) => {
      setTesting(false);
      setTestResult(result);
    });

    return () => {
      socket.disconnect();
    };
  }, [clearConnecting]);

  const handleConectar = () => {
    if (!socketRef.current) return;
    setConnecting(true);
    setQrCodeData(null);
    // Safety timeout: clear spinner after 90s if nothing responds
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => setConnecting(false), 90000);
    socketRef.current.emit('restart_whatsapp');
  };

  const handleDesconectar = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('disconnect_whatsapp');
    setQrCodeData(null);
    setMyNumber(null);
    setTestResult(null);
  };

  const handleTestarConexao = () => {
    if (!socketRef.current) return;
    setTesting(true);
    setTestResult(null);
    socketRef.current.emit('test_connection');
  };

  /* ──────────────── helpers de UI ──────────────── */
  const STATUS_MAP = {
    CONNECTED:           { label: 'ATIVO',           color: '#10b981' },
    WAITING_FOR_QR_SCAN: { label: 'AGUARDANDO QR',   color: '#f59e0b' },
    AUTHENTICATING:      { label: 'AUTENTICANDO...', color: '#f59e0b' },
    DISCONNECTED:        { label: 'DESCONECTADO',    color: '#ef4444' },
  };
  const { label: statusLabel, color: statusColor } = STATUS_MAP[waStatus] || STATUS_MAP.DISCONNECTED;

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 8, fontSize: '0.875rem',
    fontWeight: 600, cursor: 'pointer', border: '1px solid',
    transition: 'opacity 0.15s',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.25rem' }}>
          <Smartphone size={22} color="var(--accent-primary)" />
          Contas de WhatsApp
        </h2>
      </div>

      {/* Card principal */}
      <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* ícone WA */}
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'rgba(37,211,102,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#25D366',
            }}>
              <Smartphone size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {(connecting || waStatus === 'AUTHENTICATING') ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
                ) : (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                )}
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: statusColor }}>{statusLabel}</span>
              </div>

              {waStatus === 'CONNECTED' && myNumber ? (
                <p style={{ margin: 0, fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                  {formatPhone(myNumber)}
                </p>
              ) : waStatus === 'AUTHENTICATING' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {loadingPct != null ? `Carregando WhatsApp Web... ${loadingPct}%` : 'Finalizando autenticação...'}
                  </p>
                  {loadingPct != null && (
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${loadingPct}%`, background: '#f59e0b', transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {connecting ? 'Aguarde, iniciando...' : 'Nenhum número conectado'}
                </p>
              )}
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

            {/* Gerar QR — visível sempre que não está CONNECTED */}
            {waStatus !== 'CONNECTED' && (
              <button
                onClick={handleConectar}
                disabled={connecting || !socketOk}
                style={{ ...btnBase, borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(124,58,237,0.08)', opacity: (connecting || !socketOk) ? 0.5 : 1 }}
              >
                {connecting
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <RefreshCw size={14} />}
                {connecting ? 'Gerando QR...' : waStatus === 'DISCONNECTED' ? 'Conectar' : 'Novo QR'}
              </button>
            )}

            {/* Testar Conexão — apenas quando CONNECTED */}
            {waStatus === 'CONNECTED' && (
              <button
                onClick={handleTestarConexao}
                disabled={testing}
                style={{ ...btnBase, borderColor: '#10b981', color: '#10b981', background: 'rgba(16,185,129,0.07)', opacity: testing ? 0.5 : 1 }}
              >
                {testing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <FlaskConical size={14} />}
                {testing ? 'Testando...' : 'Testar Conexão'}
              </button>
            )}

            {/* Desconectar — quando não está DISCONNECTED */}
            {waStatus !== 'DISCONNECTED' && (
              <button
                onClick={handleDesconectar}
                style={{ ...btnBase, borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
              >
                <WifiOff size={14} /> Desconectar
              </button>
            )}

          </div>
        </div>

        {/* QR Code — ou placeholder de carregamento enquanto QR não chega */}
        {waStatus !== 'CONNECTED' && (
          qrCodeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Abra o WhatsApp → <strong>Dispositivos Conectados</strong> → <strong>Conectar Dispositivo</strong> → escaneie o QR abaixo
              </p>
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
                <QRCodeSVG value={qrCodeData} size={220} />
              </div>
            </div>
          ) : (connecting || waStatus === 'AUTHENTICATING' || waStatus === 'WAITING_FOR_QR_SCAN') ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)', opacity: 0.7 }} />
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {waStatus === 'WAITING_FOR_QR_SCAN' ? 'Carregando QR Code...' : 'Iniciando Chrome... aguardando QR Code'}
              </p>
            </div>
          ) : null
        )}

        {/* ID de sessão */}
        {myNumber && (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <Hash size={13} />
            <span>ID de sessão:</span>
            <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', color: 'var(--text-main)' }}>
              {myNumber}
            </code>
          </div>
        )}
      </div>

      {/* Resultado do teste de conexão */}
      {testResult && (
        <div className="glass-panel" style={{
          padding: '1rem 1.25rem',
          borderColor: testResult.success ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
          display: 'flex', flexDirection: 'column', gap: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {testResult.success
              ? <CheckCircle size={16} color="#10b981" />
              : <XCircle size={16} color="#ef4444" />}
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: testResult.success ? '#10b981' : '#ef4444' }}>
              {testResult.success ? 'Conexão OK — mensagem de teste enviada!' : 'Falha no teste de conexão'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {testResult.state && (
              <span>Estado do cliente: <code style={{ color: 'var(--text-main)' }}>{testResult.state}</code></span>
            )}
            {testResult.connectedNumber && (
              <span>Número: <code style={{ color: 'var(--text-main)' }}>{testResult.connectedNumber}</code></span>
            )}
            {typeof testResult.phoneToChatIdSize === 'number' && (
              <span>Contatos mapeados: <code style={{ color: 'var(--text-main)' }}>{testResult.phoneToChatIdSize}</code></span>
            )}
            {testResult.sendError && (
              <span style={{ color: '#ef4444' }}>Erro no envio: {testResult.sendError}</span>
            )}
            {testResult.error && (
              <span style={{ color: '#ef4444' }}>{testResult.error}</span>
            )}
          </div>
          {testResult.success && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Verifique seu WhatsApp — você receberá uma mensagem de teste de si mesmo.
            </p>
          )}
        </div>
      )}

      {/* Mapeamento técnico de IDs WhatsApp */}
      {phoneMap.length > 0 && (
        <div className="glass-panel" style={{ padding: '0' }}>
          <button
            onClick={() => setShowMap(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={13} />
              IDs de WhatsApp mapeados ({phoneMap.length})
            </span>
            {showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showMap && (
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Cada linha mostra o <strong>número de telefone</strong> resolvido e o <strong>ID interno</strong> do WhatsApp (usado para envio).
              </p>
              {phoneMap.map(([phone, chatId]) => (
                <div key={chatId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.77rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#10b981', fontWeight: 600, minWidth: 140 }}>{formatPhone(phone)}</span>
                  <span style={{ opacity: 0.4 }}>→</span>
                  <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 5, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{chatId}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Banner quando serviço offline */}
      {!socketOk && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(239,68,68,0.3)' }}>
          <WifiOff size={18} color="#ef4444" />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Serviço WhatsApp offline. Verifique se o <code>whatsapp-service</code> está rodando na porta <strong>3001</strong>.
          </span>
        </div>
      )}

      {/* Banner desconectado + aguardando ação */}
      {socketOk && waStatus === 'DISCONNECTED' && !connecting && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Clique em <strong>Conectar</strong> para gerar o QR Code e vincular seu WhatsApp.
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}
