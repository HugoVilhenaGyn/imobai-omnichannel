import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Trash2, UserPlus, X, Phone, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { io } from 'socket.io-client';
import { formatPhone, isLidPhone } from '../lib/formatPhone';
import './ChatOmni.css';

const socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });

export default function ChatOmni() {
  const [contacts, setContacts]           = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages]           = useState([]);
  const [newMessage, setNewMessage]       = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unread, setUnread]               = useState({});       // { contactId: count }
  const [myNumber, setMyNumber]           = useState(null);     // número WA conectado
  const [searchTerm, setSearchTerm]       = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);     // contactId aguardando confirm
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactForm, setNewContactForm] = useState({ name: '', phone: '' });
  const [savingContact, setSavingContact] = useState(false);

  const messagesEndRef    = useRef(null);
  const activeContactRef  = useRef(null);

  // Mantém ref sincronizada com state (evita stale closure nos listeners)
  useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);

  // Pedir permissão para notificações do navegador
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Inicialização: busca contatos + inscrições realtime
  useEffect(() => {
    fetchContacts();

    // Supabase Realtime — fallback caso o socket falhe
    const channel = supabase
      .channel('omni_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchContacts)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // Usa ref (sempre atual) em vez de ler prev dentro de setMessages (anti-pattern)
        const current = activeContactRef.current;
        if (current && payload.new.contact_id === current.id) {
          fetchMessagesLocal(current.id);
        }
      })
      .subscribe();

    // Socket.IO — caminho principal (mais rápido que Realtime)
    socket.on('my_number', (num) => setMyNumber(num));
    socket.emit('request_status'); // pede o número conectado imediatamente

    socket.on('new_whatsapp_message', (data) => {
      // Sempre atualiza lista de contatos (garante novo contato aparecer mesmo após delete)
      fetchContacts();
      const current = activeContactRef.current;
      if (current && data.contact && current.id === data.contact.id) {
        // Chat aberto: atualiza mensagens imediatamente
        fetchMessagesLocal(current.id);
      } else {
        // Chat diferente ou fechado: badge + notificação
        if (data.contact?.id) {
          setUnread(prev => ({ ...prev, [data.contact.id]: (prev[data.contact.id] || 0) + 1 }));
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          const title = data.contact?.name || formatPhone(data.phone) || 'Nova mensagem';
          const body  = data.message?.content || '(mensagem recebida)';
          try {
            const notif = new Notification(`💬 ${title}`, { body, icon: '/favicon.ico', tag: data.contact?.id });
            notif.onclick = () => { window.focus(); notif.close(); };
          } catch (_) {}
        }
      }
    });

    return () => {
      supabase.removeChannel(channel);
      socket.off('new_whatsapp_message');
      socket.off('my_number');
    };
  }, []);

  // Busca mensagens quando troca de contato ativo
  useEffect(() => {
    if (activeContact) fetchMessagesLocal(activeContact.id);
    else setMessages([]);
  }, [activeContact?.id]);

  // Scroll automático confiável: dispara após React terminar de renderizar as mensagens
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessagesLocal = async (contactId) => {
    if (!contactId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleContactClick = (c) => {
    setUnread(prev => ({ ...prev, [c.id]: 0 }));
    setDeleteConfirm(null);
    setLoadingMessages(true);
    if (activeContact?.id === c.id) {
      // Mesmo contato: useEffect não dispara (ID inalterado), chama fetch direto
      fetchMessagesLocal(c.id);
    } else {
      // Novo contato: limpa mensagens antigas imediatamente para não piscar conteúdo antigo
      setMessages([]);
      setActiveContact(c);
    }
  };

  const handleDeleteContact = async (contactId) => {
    await supabase.from('messages').delete().eq('contact_id', contactId);
    await supabase.from('contacts').delete().eq('id', contactId);
    if (activeContact?.id === contactId) setActiveContact(null);
    setDeleteConfirm(null);
    fetchContacts();
  };

  const handleDeleteMessage = async (msgId) => {
    await supabase.from('messages').delete().eq('id', msgId);
    fetchMessagesLocal(activeContact.id);
  };

  const handleSaveNewContact = async () => {
    if (!newContactForm.name && !newContactForm.phone) return;
    setSavingContact(true);
    try {
      const phone = newContactForm.phone.replace(/\D/g, '');
      await supabase.from('contacts').insert([{
        name: newContactForm.name || phone,
        phone: phone || null,
        status: 'novo_contato',
        handled_by_ai: false,
        original_channel: 'manual',
      }]);
      setNewContactForm({ name: '', phone: '' });
      setShowNewContact(false);
      fetchContacts();
    } catch (err) {
      console.error('Erro ao criar contato:', err);
    } finally {
      setSavingContact(false);
    }
  };

  const handleSendMessage = async (e, senderType = 'human_agent') => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeContact) return;
    const sentText = newMessage.trim();
    setNewMessage('');

    // Otimista: mostra antes de salvar
    const tempMsg = {
      id: `temp-${Date.now()}`,
      contact_id: activeContact.id,
      sender_type: senderType,
      content: sentText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    const { error } = await supabase.from('messages').insert([{
      contact_id: activeContact.id,
      sender_type: senderType,
      content: sentText,
    }]);

    if (error) {
      console.error('Erro ao enviar:', error);
      fetchMessagesLocal(activeContact.id);
      return;
    }

    fetchMessagesLocal(activeContact.id);
    supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', activeContact.id);

    // Envia pelo WhatsApp se for humano e canal WhatsApp
    if (senderType === 'human_agent' && activeContact.original_channel === 'whatsapp' && activeContact.phone) {
      socket.emit('send_whatsapp_message', { phone: activeContact.phone, message: sentText });
    }

    // Simular cliente dispara IA
    if (senderType === 'user') {
      import('../lib/ai-engine').then(async ({ processAILogic }) => {
        await processAILogic({ contact_id: activeContact.id, sender_type: 'user', content: sentText });
        fetchMessagesLocal(activeContact.id);
        fetchContacts();
      });
    }
  };

  const handleAssumirAtendimento = async () => {
    if (!activeContact) return;
    const { error } = await supabase.from('contacts')
      .update({ handled_by_ai: false, status: 'contatado' })
      .eq('id', activeContact.id);
    if (!error) {
      await supabase.from('messages').insert([{
        contact_id: activeContact.id,
        sender_type: 'ai_agent',
        content: '👋 Um corretor humano assumiu o seu atendimento.',
      }]);
      fetchContacts();
      setActiveContact(prev => ({ ...prev, handled_by_ai: false, status: 'contatado' }));
      fetchMessagesLocal(activeContact.id);
    }
  };

  const formatTime = (iso) => {
    try {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return ''; }
  };

  const safeStr = (s) => s || '';

  const filteredContacts = contacts.filter(c => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return safeStr(c.name).toLowerCase().includes(q) || safeStr(c.phone).includes(q);
  });

  const agentName = (() => {
    try { return JSON.parse(localStorage.getItem('imobai_ai_config') || '{}').agentName || 'Assistente'; }
    catch { return 'Assistente'; }
  })();

  return (
    <div className="chat-container glass-panel">

      {/* ─── Sidebar ─── */}
      <div className="chat-sidebar">

        {/* Cabeçalho da sidebar */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Conversas</span>
          <button
            onClick={() => { setShowNewContact(v => !v); setNewContactForm({ name: '', phone: '' }); }}
            title="Novo contato"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(124,58,237,0.3)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <UserPlus size={14} /> Novo
          </button>
        </div>

        {/* Formulário novo contato */}
        {showNewContact && (
          <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              placeholder="Nome"
              value={newContactForm.name}
              onChange={e => setNewContactForm(p => ({ ...p, name: e.target.value }))}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
            />
            <input
              placeholder="Telefone (somente números)"
              value={newContactForm.phone}
              onChange={e => setNewContactForm(p => ({ ...p, phone: e.target.value }))}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSaveNewContact} disabled={savingContact}
                style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'var(--accent-primary)', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', border: 'none', opacity: savingContact ? 0.6 : 1 }}>
                {savingContact ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setShowNewContact(false)}
                style={{ padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="chat-search">
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de contatos */}
        <div className="contact-list">
          {loadingContacts && filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Carregando...</div>
          ) : filteredContacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum contato encontrado.</div>
          ) : filteredContacts.map(c => {
            const count = unread[c.id] || 0;
            const hasUnread = count > 0;
            return (
              <div
                key={c.id}
                className={`contact-item ${activeContact?.id === c.id ? 'active' : ''}`}
                style={hasUnread ? { background: 'rgba(124,58,237,0.06)', borderLeft: '3px solid var(--accent-primary)' } : {}}
                onClick={() => handleContactClick(c)}
              >
                <div className="contact-avatar">
                  <User size={20} />
                  {hasUnread && (
                    <span className="unread-badge">{count > 99 ? '99+' : count}</span>
                  )}
                </div>

                <div className="contact-info">
                  <div className="c-head">
                    <h4 className="c-name" style={hasUnread ? { color: 'var(--text-main)', fontWeight: 700 } : {}}>
                      {safeStr(c.name) || formatPhone(c.phone) || 'Sem Nome'}
                    </h4>
                    <span className="c-time">{formatTime(c.updated_at)}</span>
                  </div>
                  {/* Telefone sempre visível */}
                  <p className="c-msg" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {c.phone ? (
                      isLidPhone(c.phone) ? (
                        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }} title="Número real não identificado. Use Atendimentos → Corrigir para inserir o telefone manualmente.">
                          ⚠ ID interno WA
                        </span>
                      ) : (
                        <><Phone size={11} style={{ flexShrink: 0 }} />{formatPhone(c.phone)}</>
                      )
                    ) : (
                      <span style={{ opacity: 0.5 }}>Sem telefone</span>
                    )}
                  </p>
                  <div className="c-tags">
                    <span className="c-status" style={{ color: c.handled_by_ai ? 'var(--accent-primary)' : '#10B981' }}>
                      {c.handled_by_ai ? '🤖 IA' : '👤 Humano'}
                    </span>
                    {c.original_channel === 'whatsapp' && (
                      <span className="c-intent">WhatsApp</span>
                    )}
                  </div>
                </div>

                {/* Botão excluir contato */}
                {deleteConfirm === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleDeleteContact(c.id)}
                      style={{ padding: '3px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', fontSize: '0.7rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                      Confirmar
                    </button>
                    <button onClick={() => setDeleteConfirm(null)}
                      style={{ padding: '3px 8px', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', fontSize: '0.7rem', border: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(c.id); }}
                    title="Excluir conversa"
                    style={{ opacity: 0, padding: 4, borderRadius: 6, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', transition: 'opacity 0.15s', alignSelf: 'center', flexShrink: 0 }}
                    className="delete-contact-btn"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Número conectado */}
        {myNumber && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Smartphone size={13} color="#25D366" />
            <span>Enviando via</span>
            <span style={{ color: '#25D366', fontWeight: 600 }}>{formatPhone(myNumber)}</span>
          </div>
        )}
      </div>

      {/* ─── Chat principal ─── */}
      <div className="chat-main">
        {!activeContact ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
            <Bot size={48} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '0.95rem' }}>Selecione uma conversa para começar</p>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="chat-header">
              <div className="active-user-info">
                <div className="avatar bg-accent-primary"><User size={20} /></div>
                <div>
                  <h3 style={{ marginBottom: 2 }}>
                    {safeStr(activeContact.name) || formatPhone(activeContact.phone) || 'Novo Lead'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {activeContact.phone && (
                      isLidPhone(activeContact.phone) ? (
                        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }} title="Número real não identificado — será corrigido automaticamente quando o contato enviar a próxima mensagem, ou use Atendimentos → Corrigir.">
                          ⚠ ID interno WA — corrija em Atendimentos
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Phone size={11} />{formatPhone(activeContact.phone)}
                        </span>
                      )
                    )}
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span style={{ color: activeContact.handled_by_ai ? 'var(--accent-primary)' : '#10b981' }}>
                      {activeContact.handled_by_ai ? '🤖 IA ativa' : '👤 Corretor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ações do header */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {activeContact.handled_by_ai && (
                  <button onClick={handleAssumirAtendimento}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(124,58,237,0.08)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Assumir
                  </button>
                )}
                <button
                  onClick={() => setDeleteConfirm(activeContact.id)}
                  title="Excluir conversa"
                  style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="chat-messages">
              {loadingMessages ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', opacity: 0.4, marginTop: '3rem', fontSize: '0.9rem' }}>
                  Nenhuma mensagem ainda.
                </div>
              ) : messages.map(m => {
                const isAI       = m.sender_type === 'ai_agent';
                const isAgent    = m.sender_type === 'human_agent';
                const wrapClass  = (isAI || isAgent) ? 'user' : 'bot';

                return (
                  <div key={m.id} className={`msg-bubble-wrapper ${wrapClass}`} style={{ position: 'relative' }}>
                    <div className={`msg-bubble ${wrapClass}`} style={{ position: 'relative' }}>
                      {isAI && (
                        <div style={{ fontSize: '10px', opacity: 0.65, marginBottom: 4, fontWeight: 600 }}>
                          🤖 {agentName}
                        </div>
                      )}
                      {isAgent && (
                        <div style={{ fontSize: '10px', opacity: 0.65, marginBottom: 4, fontWeight: 600 }}>
                          👤 Corretor
                        </div>
                      )}
                      <p style={{ marginBottom: 2 }}>{safeStr(m.content)}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span className="msg-time">{formatTime(m.created_at)}</span>
                        {!m.id?.toString().startsWith('temp-') && (
                          <button
                            onClick={() => handleDeleteMessage(m.id)}
                            title="Excluir mensagem"
                            style={{ background: 'transparent', border: 'none', padding: '1px 3px', cursor: 'pointer', opacity: 0.4, color: 'inherit', borderRadius: 4 }}
                            className="delete-msg-btn"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de envio */}
            <div className="chat-input-area">
              <form
                onSubmit={(e) => handleSendMessage(e, 'human_agent')}
                style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <input
                  type="text"
                  placeholder={`Mensagem para ${safeStr(activeContact.name) || formatPhone(activeContact.phone) || 'contato'}...`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  title="Enviar como corretor"
                  style={{ padding: '10px 20px', borderRadius: 24, background: 'var(--accent-primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !newMessage.trim() ? 0.5 : 1 }}
                >
                  <Send size={15} /> Enviar
                </button>
                <button
                  type="button"
                  disabled={!newMessage.trim()}
                  onClick={() => handleSendMessage(null, 'user')}
                  title="Simular mensagem do cliente (dispara IA)"
                  style={{ padding: '10px 16px', borderRadius: 24, background: '#10b981', color: '#fff', fontWeight: 600, fontSize: '0.85rem', border: 'none', cursor: 'pointer', opacity: !newMessage.trim() ? 0.5 : 1 }}
                >
                  👤 Simular
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Hover states via global style */}
      <style>{`
        .contact-item:hover .delete-contact-btn { opacity: 1 !important; }
        .msg-bubble-wrapper:hover .delete-msg-btn { opacity: 0.7 !important; }
        .delete-msg-btn:hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
