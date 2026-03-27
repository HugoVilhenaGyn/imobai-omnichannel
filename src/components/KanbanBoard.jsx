import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MoreVertical, Building, Key, Home, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './KanbanBoard.css';

const columns = [
  { id: 'novo_lead', title: 'Novo Lead', color: 'var(--accent-primary)' },
  { id: 'contatado', title: 'Contatado', color: '#10B981' },
  { id: 'qualificado', title: 'Qualificado', color: '#F59E0B' },
  { id: 'negociacao_visita', title: 'Visita / Negociação', color: '#8B5CF6' },
  { id: 'ganho_fechado', title: 'Fechado', color: '#14B8A6' }
];

export default function KanbanBoard() {
  const [funnel, setFunnel] = useState('vendas'); // vendas, locacao, captacao
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
    
    // Inscrever-se para atualizações em tempo real (Realtime subscriptions)
    const channel = supabase
      .channel('contacts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => {
          console.log('Mudança detectada no banco:', payload);
          fetchContacts(); // Recarrega os dados ao detectar mudanças de outro local/user
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
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

  const handleDragStart = (e, card, fromColumn) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('fromColumn', fromColumn);
  };

  const handleDrop = async (e, toColumn) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    const fromColumn = e.dataTransfer.getData('fromColumn');
    
    if (fromColumn === toColumn) return;

    // 1. Atualização Otimista na Interface
    setContacts(prev => 
      prev.map(c => c.id === cardId ? { ...c, status: toColumn } : c)
    );

    // 2. Atualização no Banco de Dados
    const { error } = await supabase
      .from('contacts')
      .update({ status: toColumn })
      .eq('id', cardId);

    if (error) {
      console.error('Erro ao mover card:', error);
      fetchContacts(); // Faz rollback local se o banco der erro
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Botão para simular a criação de um novo lead
  const handleAddTestLead = async (colId) => {
    const newContact = {
      name: 'Lead Teste ' + Math.floor(Math.random() * 1000),
      phone: '11988887777',
      intent: funnel,
      status: colId,
      original_channel: 'whatsapp'
    };
    
    // Mostra um feedback visual de que está carregando na interface?
    console.log("Inserindo novo contato:", newContact);

    const { error } = await supabase.from('contacts').insert([newContact]);
    
    if (error) {
      console.error('Erro ao inserir lead:', error);
      alert('Erro ao tentar inserir no Supabase: ' + error.message);
    } else {
      // Como o recurso de "Realtime" (WebSocket) pode não estar habilitado 
      // por padrão na tabela `contacts` do seu Supabase, nós forçamos 
      // uma busca manual para a tela atualizar imediatamente:
      fetchContacts();
    }
  };

  return (
    <div className="kanban-wrapper">
      <div className="kanban-tabs glass-panel">
        <button className={`k-tab ${funnel === 'vendas' ? 'active' : ''}`} onClick={() => setFunnel('vendas')}>
          <Building size={16} /> Vendas
        </button>
        <button className={`k-tab ${funnel === 'locacao' ? 'active' : ''}`} onClick={() => setFunnel('locacao')}>
          <Key size={16} /> Locação
        </button>
        <button className={`k-tab ${funnel === 'captacao' ? 'active' : ''}`} onClick={() => setFunnel('captacao')}>
          <Home size={16} /> Captação
        </button>
      </div>

      <div className="kanban-board">
        {loading && contacts.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} /> Carregando contatos vivos...
          </div>
        ) : (
          columns.map(col => {
            const columnContacts = contacts.filter(c => c.intent === funnel && c.status === col.id);
            return (
              <div 
                key={col.id} 
                className="kanban-col glass-panel"
                onDrop={(e) => handleDrop(e, col.id)}
                onDragOver={handleDragOver}
              >
                <div className="col-header">
                  <div className="col-title">
                    <div className="col-indicator" style={{ backgroundColor: col.color }}></div>
                    <h3>{col.title}</h3>
                    <span className="col-count">
                      {columnContacts.length}
                    </span>
                  </div>
                  <button className="add-btn" onClick={() => handleAddTestLead(col.id)} title="Adicionar Card de Teste Real">
                    <Plus size={16} />
                  </button>
                </div>
                
                <div className="col-body">
                  <AnimatePresence>
                    {columnContacts.map(card => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={card.id}
                          className="kanban-card glass-panel"
                          draggable
                          onDragStart={(e) => handleDragStart(e, card, col.id)}
                        >
                          <div className="card-top">
                            <span className="card-id">#{card.id.split('-')[0]}</span>
                            <MoreVertical size={14} className="card-more" />
                          </div>
                          <h4>{card.name}</h4>
                          <p>{card.phone} • {card.original_channel}</p>
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
