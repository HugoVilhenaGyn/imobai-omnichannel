import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Somente ícones que sabemos que funcionam
import { Plus, MoreVertical, Building, Key, Home, Loader2, Search, Filter, MessageCircle, Bot, User, Clock, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/formatPhone';
import './KanbanBoard.css';

const columns = [
  { id: 'novo_lead', title: 'Novo Lead', color: 'var(--accent-primary)', description: 'Triagem inicial' },
  { id: 'contatado', title: 'Contatado', color: '#10B981', description: 'Primeiro contato feito' },
  { id: 'qualificado', title: 'Qualificado', color: '#F59E0B', description: 'Lead com potencial' },
  { id: 'negociacao_visita', title: 'Visita / Negociação', color: '#8B5CF6', description: 'Em andamento' },
  { id: 'ganho_fechado', title: 'Fechado', color: '#14B8A6', description: 'Contrato assinado' }
];

const ChannelIcon = ({ channel }) => {
  // Simplificado para evitar erros de ícone inexistente
  return <div style={{ fontSize: '10px' }}>🌐</div>;
};

export default function KanbanBoard() {
  const [funnel, setFunnel] = useState('vendas');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchContacts();
    const channel = supabase.channel('contacts_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchContacts()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('contacts').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return '---';
    const now = new Date();
    const updated = new Date(dateString);
    if (isNaN(updated.getTime())) return '---';
    const diff = Math.floor((now - updated) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const handleDragStart = (e, card, fromColumn) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('fromColumn', fromColumn);
  };

  const handleDrop = async (e, toColumn) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    const fromColumn = e.dataTransfer.getData('fromColumn');
    if (fromColumn === toColumn) return;

    setContacts(prev => prev.map(c => c.id === cardId ? { ...c, status: toColumn } : c));
    await supabase.from('contacts').update({ status: toColumn, updated_at: new Date().toISOString() }).eq('id', cardId);
  };

  const filteredContacts = contacts.filter(c => 
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm)) &&
    c.intent === funnel
  );

  return (
    <div className="kanban-wrapper">
      <div className="kanban-actions-bar">
        <div className="kanban-tabs glass-panel">
          <button className={`k-tab ${funnel === 'vendas' ? 'active' : ''}`} onClick={() => setFunnel('vendas')}><Building size={16} /> Vendas</button>
          <button className={`k-tab ${funnel === 'locacao' ? 'active' : ''}`} onClick={() => setFunnel('locacao')}><Key size={16} /> Locação</button>
          <button className={`k-tab ${funnel === 'captacao' ? 'active' : ''}`} onClick={() => setFunnel('captacao')}><Home size={16} /> Captação</button>
        </div>
        <div className="kanban-search-group glass-panel">
          <Search size={18} />
          <input type="text" placeholder="Buscar lead..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="kanban-board">
        {loading && contacts.length === 0 ? (
          <div className="kanban-loading"><Loader2 className="animate-spin" /></div>
        ) : (
          columns.map(col => {
            const colContacts = filteredContacts.filter(c => c.status === col.id);
            return (
              <div key={col.id} className="kanban-col" onDrop={(e) => handleDrop(e, col.id)} onDragOver={(e) => e.preventDefault()}>
                <div className="col-header">
                  <div className="col-title-group">
                    <div className="col-indicator" style={{ backgroundColor: col.color }}></div>
                    <div>
                      <h3>{col.title}</h3>
                      <p style={{ fontSize: '10px', color: 'gray' }}>{col.description}</p>
                    </div>
                  </div>
                  <span className="col-count">{colContacts.length}</span>
                </div>
                <div className="col-body">
                  <AnimatePresence>
                    {colContacts.map(card => (
                      <motion.div layout key={card.id} className="kanban-card glass-panel" draggable onDragStart={(e) => handleDragStart(e, card, col.id)}>
                        <div className="card-labels">
                           <ChannelIcon channel={card.original_channel} />
                           {card.handled_by_ai ? <span style={{ fontSize: '10px', color: 'purple' }}>🤖 IA</span> : <span style={{ fontSize: '10px', color: 'orange' }}>👤 Humano</span>}
                        </div>
                        <h4 style={{ margin: '5px 0' }}>{card.name}</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'gray' }}>
                          <span>{formatPhone(card.phone)}</span>
                          <span>{getTimeAgo(card.updated_at || card.created_at)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
