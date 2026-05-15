import React, { useState, useEffect, useRef } from 'react';
import { Send, Phone, Video, MoreVertical, Bot, User, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { io } from 'socket.io-client';
import { formatPhone } from '../lib/formatPhone';
import './ChatOmni.css';

const socket = io('http://localhost:3001');

export default function ChatOmni() {
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  const activeContactRef = useRef(null);

  // Manter ref sincronizado com o state
  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);

  // Busca lista de contatos ao montar o componente
  useEffect(() => {
    fetchContacts();

    // Inscrever-se em todas as mudanças do Supabase para atualizar a interface em tempo real
    const channel = supabase
      .channel('omni_channel_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        fetchContacts();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // Se a mensagem for para o contato atual aberto, busca as mensagens dele de novo
        setMessages(prev => {
          const isForActiveContact = prev.length > 0 && prev[0].contact_id === payload.new.contact_id;
          if (isForActiveContact) {
            setTimeout(() => fetchMessagesLocal(payload.new.contact_id), 100);
          }
          return prev;
        });
      })
      .subscribe();

    // ESCUTA WHATSAPP VIA SOCKET.IO (caminho direto, sem depender do Supabase Realtime)
    socket.on('new_whatsapp_message', (data) => {
      console.log('📩 Mensagem WhatsApp recebida no Chat:', data);
      fetchContacts(); // Atualiza lista de contatos (pode ter um novo)
      
      const current = activeContactRef.current;
      if (current && data.contact && current.id === data.contact.id) {
        // Se o chat aberto é do mesmo contato, recarrega as mensagens
        fetchMessagesLocal(current.id);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      socket.off('new_whatsapp_message');
    };
  }, []);

  // Buscar mensagens toda vez que o contato ativo trocar
  useEffect(() => {
    if (activeContact) {
      fetchMessagesLocal(activeContact.id);
    } else {
      setMessages([]);
    }
  }, [activeContact?.id]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false }); // Contatos mais recentes no topo

      if (error) throw error;
      setContacts(data || []);
      setLoadingContacts(false);
    } catch (err) {
      console.error('Erro ao buscar contatos no chat:', err);
      setLoadingContacts(false);
    }
  };

  const fetchMessagesLocal = async (contactId) => {
    try {
      if (!contactId) return;
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true }); // Mais antigas em cima, rola para as mais novas em baixo
        
      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const handleSendMessage = async (e, forcedSenderType = 'human_agent') => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeContact) return;

    const sentText = newMessage.trim();
    setNewMessage('');

    // Update otimista na tela antes da internet confirmar
    const tempMsg = {
      id: Date.now().toString(),
      contact_id: activeContact.id,
      sender_type: forcedSenderType,
      content: sentText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    // Salvar no Supabase
    const payload = {
      contact_id: activeContact.id,
      sender_type: forcedSenderType,
      content: sentText
    };
    const { error } = await supabase.from('messages').insert([payload]);

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem: ' + error.message);
      fetchMessagesLocal(activeContact.id); // Rollback da mensagem temporária em caso de erro
    } else {
      fetchMessagesLocal(activeContact.id); // Busca a mensagem confirmada

      // Mantém o contato no topo da lista após envio do corretor
      supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', activeContact.id);

      // 🌐 INTEGRAÇÃO WHATSAPP:
      // Se for um envio humano e o contato for do canal WhatsApp, envia pro Node.js!
      if (forcedSenderType === 'human_agent' && activeContact.original_channel === 'whatsapp' && activeContact.phone) {
          socket.emit('send_whatsapp_message', { phone: activeContact.phone, message: sentText });
      }
      
      // Como o Supabase Realtime pode estar desligado por padrão no projeto, 
      // nós ativamos a IA programaticamente logo em seguida para garantir a simulação:
      if (forcedSenderType === 'user') {
        import('../lib/ai-engine').then(async ({ processAILogic }) => {
          // 'await' garante que a tela vai esperar o tempo exato que a API 
          // do Google Gemini demorar para redigir a resposta e salvá-la no banco.
          await processAILogic(payload);
          
          fetchMessagesLocal(activeContact.id);
          fetchContacts(); // Refresca Kanban tags
        });
      }
    }
  };

  const handleAssumirAtendimento = async () => {
    if (!activeContact) return;
    
    // Atualiza o contato para "contatado" e tira a responsabilidade da IA
    const { error } = await supabase
      .from('contacts')
      .update({ handled_by_ai: false, status: 'contatado' })
      .eq('id', activeContact.id);
      
    if (error) {
      console.error('Erro ao assumir:', error);
      alert('Erro ao assumir atendimento: ' + error.message);
    } else {
      // Inserir uma mensagem automática avisando o lead
      await supabase.from('messages').insert([{
        contact_id: activeContact.id,
        sender_type: 'ai_agent', // Usamos ai_agent como mensagens de sistema
        content: '👋 Um corretor humano assumiu o seu atendimento. Como posso ajudar?'
      }]);
      
      fetchContacts();
      setActiveContact(prev => ({ ...prev, handled_by_ai: false, status: 'contatado' }));
      fetchMessagesLocal(activeContact.id);
    }
  };

  const formatTime = (isoString) => {
    try {
      if (!isoString) return '';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const safeStr = (str) => str || '';

  return (
    <div className="chat-container glass-panel">
      {/* Sidebar de Contatos */}
      <div className="chat-sidebar">
        <div className="chat-search">
          <input type="text" placeholder="Buscar contatos ou mensagens..." />
        </div>
        
        <div className="contact-list">
          {loadingContacts && contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
              Aguarde...
            </div>
          ) : (
            contacts.map(c => (
              <div 
                key={c.id} 
                className={`contact-item ${activeContact?.id === c.id ? 'active' : ''}`}
                onClick={() => {
                  setLoadingMessages(true);
                  setActiveContact(c);
                }}
              >
                <div className="contact-avatar">
                  <User size={20} />
                </div>
                <div className="contact-info">
                  <div className="c-head">
                    <h4 className="c-name">{safeStr(c.name) || 'Sem Nome'}</h4>
                    <span className="c-time">{formatTime(c.updated_at)}</span>
                  </div>
                  <p className="c-msg">{formatPhone(c.phone) || safeStr(c.email) || 'Sem contato'}</p>
                  <div className="c-tags">
                    {c.handled_by_ai ? (
                      <span className="c-status" style={{color: 'var(--accent-primary)'}}>Robô</span>
                    ) : (
                      <span className="c-status" style={{color: '#10B981'}}>Humano</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área principal (Mensagens) */}
      <div className="chat-main">
        {!activeContact ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
            Selecione um contato na lista lateral para iniciar o chat.
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="active-user-info">
                <div className="avatar bg-accent-primary"><User size={20} /></div>
                <div>
                  <h3>{safeStr(activeContact.name) || formatPhone(activeContact.phone) || 'Novo Lead'}</h3>
                  <span className="active-status" style={{fontSize: '12px', opacity: 0.8}}>
                    {formatPhone(activeContact.phone) && <>{formatPhone(activeContact.phone)} · </>}
                    {activeContact.handled_by_ai ? '🤖 Sendo atendido pela IA' : 'Corretor Assumiu'}
                  </span>
                </div>
              </div>
              <div className="chat-actions">
                {/* Removidos Icones que podem estar causando quebra no Lucide antigo */}
              </div>
            </div>

            <div className="chat-messages">
              {loadingMessages ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando histórico...</div>
              ) : (!Array.isArray(messages) || messages.length === 0) ? (
                <div style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>Nenhuma mensagem neste chat ainda.</div>
              ) : (
                messages.map(m => {
                  const isClient = m.sender_type === 'user';
                  const msgClass = isClient ? 'bot' : 'user'; 
                  
                  return (
                    <div key={m.id || Math.random().toString()} className={`msg-bubble-wrapper ${msgClass}`}>
                      <div className={`msg-bubble ${msgClass}`}>
                        {m.sender_type === 'ai_agent' && (
                          <div style={{ fontSize: '10px', opacity: 0.6, marginBottom: '4px', fontWeight: 600 }}>
                            🤖 {(() => {
                                  try {
                                    const c = localStorage.getItem('imobai_ai_config');
                                    return c ? (JSON.parse(c).agentName || 'Assistente Virtual') : 'Assistente Virtual';
                                  } catch(e) { return 'Assistente Virtual'; }
                                })()}
                          </div>
                        )}
                        <p>{safeStr(m.content)}</p>
                        <span className="msg-time">{formatTime(m.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              {activeContact.handled_by_ai && (
                <button className="bot-suggest-btn" onClick={handleAssumirAtendimento}>
                  🤖 Assumir Atendimento
                </button>
              )}
              
              <form onSubmit={(e) => handleSendMessage(e, 'human_agent')} style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className="input-wrapper" style={{ flex: 1, display: 'flex', position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Digite uma mensagem..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    style={{ flex: 1, paddingRight: '10px' }}
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="send-btn" 
                  disabled={!newMessage.trim()}
                  style={{ position: 'static', transform: 'none', height: '42px', width: 'auto', padding: '0 16px', borderRadius: '21px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Enviar
                </button>
                
                <button 
                  type="button" 
                  className="send-btn" 
                  disabled={!newMessage.trim()} 
                  onClick={() => handleSendMessage(null, 'user')} 
                  style={{ position: 'static', transform: 'none', height: '42px', width: 'auto', padding: '0 16px', borderRadius: '21px', backgroundColor: '#10b981', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 'bold' }}
                >
                  👤 Simular Cliente
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
