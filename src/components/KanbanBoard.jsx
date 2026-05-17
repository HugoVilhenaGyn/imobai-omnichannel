import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Building, Key, Home, Loader2, Search, ChevronLeft, ChevronRight, X, Check, Phone, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/formatPhone';
import './KanbanBoard.css';

const COLUMNS = [
  { id: 'novo_lead',         title: 'Novo Lead',          color: 'var(--accent-primary)', description: 'Triagem inicial' },
  { id: 'contatado',         title: 'Contatado',           color: '#10B981',               description: 'Primeiro contato feito' },
  { id: 'qualificado',       title: 'Qualificado',         color: '#F59E0B',               description: 'Lead com potencial' },
  { id: 'negociacao_visita', title: 'Visita / Negociação', color: '#8B5CF6',               description: 'Em andamento' },
  { id: 'ganho_fechado',     title: 'Fechado',             color: '#14B8A6',               description: 'Contrato assinado' },
];

const FUNNELS = [
  { id: 'vendas',   label: 'Vendas',   icon: Building },
  { id: 'locacao',  label: 'Locação',  icon: Key },
  { id: 'captacao', label: 'Captação', icon: Home },
];

export default function KanbanBoard() {
  const [funnel, setFunnel]           = useState('vendas');
  const [contacts, setContacts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [addingInCol, setAddingInCol] = useState(null);
  const [newCard, setNewCard]         = useState({ name: '', phone: '' });
  const [saving, setSaving]           = useState(false);
  const [dragOver, setDragOver]       = useState(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    fetchContacts();
    const channel = supabase
      .channel('crm_kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchContacts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Foca o input quando abre o form de adicionar
  useEffect(() => {
    if (addingInCol && nameInputRef.current) nameInputRef.current.focus();
  }, [addingInCol]);

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
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '—';
    const diff = Math.floor((Date.now() - new Date(dateString)) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  /* ── Drag & Drop ── */
  const handleDragStart = (e, cardId, fromCol) => {
    e.dataTransfer.setData('cardId', cardId);
    e.dataTransfer.setData('fromCol', fromCol);
  };

  const handleDrop = async (e, toCol) => {
    e.preventDefault();
    setDragOver(null);
    const cardId  = e.dataTransfer.getData('cardId');
    const fromCol = e.dataTransfer.getData('fromCol');
    if (!cardId || fromCol === toCol) return;
    setContacts(prev => prev.map(c => c.id === cardId ? { ...c, status: toCol } : c));
    await supabase.from('contacts').update({ status: toCol, updated_at: new Date().toISOString() }).eq('id', cardId);
  };

  /* ── Mover com botão ← → ── */
  const handleMove = async (card, direction) => {
    const idx    = COLUMNS.findIndex(c => c.id === card.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= COLUMNS.length) return;
    const newColId = COLUMNS[newIdx].id;
    setContacts(prev => prev.map(c => c.id === card.id ? { ...c, status: newColId } : c));
    await supabase.from('contacts').update({ status: newColId, updated_at: new Date().toISOString() }).eq('id', card.id);
  };

  /* ── Adicionar card ── */
  const handleAddCard = async (colId) => {
    if (!newCard.name.trim() && !newCard.phone.trim()) return;
    setSaving(true);
    try {
      const phone = newCard.phone.replace(/\D/g, '');
      await supabase.from('contacts').insert([{
        name:             newCard.name.trim() || phone || 'Sem nome',
        phone:            phone || null,
        status:           colId,
        intent:           funnel,
        handled_by_ai:    false,
        original_channel: 'manual',
      }]);
      setAddingInCol(null);
      setNewCard({ name: '', phone: '' });
      fetchContacts();
    } finally {
      setSaving(false);
    }
  };

  const cancelAdd = () => { setAddingInCol(null); setNewCard({ name: '', phone: '' }); };

  /* ── Filtro ── */
  const filteredContacts = contacts.filter(c => {
    const matchFunnel = c.intent === funnel || (!c.intent && funnel === 'vendas');
    const matchSearch = !searchTerm ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm);
    return matchFunnel && matchSearch;
  });

  return (
    <div className="kanban-wrapper">
      {/* Barra superior */}
      <div className="kanban-actions-bar">
        <div className="kanban-tabs glass-panel">
          {FUNNELS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`k-tab ${funnel === id ? 'active' : ''}`}
              onClick={() => setFunnel(id)}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="kanban-search-group glass-panel">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar lead..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="kanban-board">
        {loading && contacts.length === 0 ? (
          <div className="kanban-loading"><Loader2 className="animate-spin" size={32} /></div>
        ) : (
          COLUMNS.map((col) => {
            const colCards = filteredContacts.filter(c => c.status === col.id);
            const isOver   = dragOver === col.id;

            return (
              <div
                key={col.id}
                className="kanban-col"
                onDrop={e => handleDrop(e, col.id)}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={() => setDragOver(null)}
                style={isOver ? { outline: `2px dashed ${col.color}`, borderRadius: 12 } : {}}
              >
                {/* Cabeçalho da coluna */}
                <div className="col-header">
                  <div className="col-title-group">
                    <div className="col-indicator" style={{ backgroundColor: col.color }} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.9rem' }}>{col.title}</h3>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{col.description}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="col-count">{colCards.length}</span>
                    <button
                      className="add-btn"
                      title={`Adicionar em ${col.title}`}
                      onClick={() => setAddingInCol(addingInCol === col.id ? null : col.id)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                {/* Form de adicionar (inline na coluna) */}
                <AnimatePresence>
                  {addingInCol === col.id && (
                    <motion.div
                      key="add-form"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18 }}
                      className="glass-panel"
                      style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      <input
                        ref={nameInputRef}
                        placeholder="Nome do lead"
                        value={newCard.name}
                        onChange={e => setNewCard(p => ({ ...p, name: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCard(col.id); if (e.key === 'Escape') cancelAdd(); }}
                        style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                      />
                      <input
                        placeholder="Telefone (opcional)"
                        value={newCard.phone}
                        onChange={e => setNewCard(p => ({ ...p, phone: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCard(col.id); if (e.key === 'Escape') cancelAdd(); }}
                        style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleAddCard(col.id)}
                          disabled={saving || (!newCard.name.trim() && !newCard.phone.trim())}
                          style={{ flex: 1, padding: '6px', borderRadius: 7, background: col.color, color: '#fff', fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        >
                          {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                          Incluir
                        </button>
                        <button
                          onClick={cancelAdd}
                          style={{ padding: '6px 10px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Cards */}
                <div className="col-body">
                  <AnimatePresence>
                    {colCards.length === 0 && addingInCol !== col.id ? (
                      <div className="empty-col">
                        <Plus size={18} style={{ opacity: 0.3, marginBottom: 4 }} /><br />
                        Nenhum lead
                      </div>
                    ) : (
                      colCards.map(card => {
                        const colIdx2 = COLUMNS.findIndex(c => c.id === card.status);
                        return (
                          <motion.div
                            layout
                            key={card.id}
                            className="kanban-card glass-panel"
                            draggable
                            onDragStart={e => handleDragStart(e, card.id, col.id)}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            {/* Badges */}
                            <div className="card-labels">
                              {card.original_channel === 'whatsapp'
                                ? <span style={{ fontSize: '10px' }}>💬 WA</span>
                                : <span style={{ fontSize: '10px' }}>✏️ Manual</span>}
                              {card.handled_by_ai
                                ? <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>🤖 IA</span>
                                : <span style={{ fontSize: '10px', color: '#f59e0b' }}>👤 Humano</span>}
                            </div>

                            {/* Nome */}
                            <h4 style={{ margin: '4px 0', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                              {card.name || 'Sem nome'}
                            </h4>

                            {/* Telefone + Tempo */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                {card.phone && <Phone size={10} />}
                                {formatPhone(card.phone)}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Clock size={10} />
                                {getTimeAgo(card.updated_at || card.created_at)}
                              </span>
                            </div>

                            {/* Botões de transferir */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <button
                                onClick={() => handleMove(card, -1)}
                                disabled={colIdx2 === 0}
                                title={colIdx2 > 0 ? `← ${COLUMNS[colIdx2 - 1].title}` : ''}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: colIdx2 === 0 ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)', cursor: colIdx2 === 0 ? 'not-allowed' : 'pointer', fontSize: '0.72rem' }}
                              >
                                <ChevronLeft size={12} />
                                {colIdx2 > 0 ? COLUMNS[colIdx2 - 1].title : '—'}
                              </button>
                              <button
                                onClick={() => handleMove(card, +1)}
                                disabled={colIdx2 === COLUMNS.length - 1}
                                title={colIdx2 < COLUMNS.length - 1 ? `→ ${COLUMNS[colIdx2 + 1].title}` : ''}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: colIdx2 === COLUMNS.length - 1 ? 'rgba(255,255,255,0.15)' : col.color, cursor: colIdx2 === COLUMNS.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {colIdx2 < COLUMNS.length - 1 ? COLUMNS[colIdx2 + 1].title : '—'}
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
