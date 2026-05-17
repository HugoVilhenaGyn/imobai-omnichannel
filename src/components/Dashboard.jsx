import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, MessageSquare, Bot, UserCheck, Smartphone, TrendingUp, Clock } from 'lucide-react';
import { formatPhone } from '../lib/formatPhone';

const COLUMNS = [
  { id: 'novo_lead',         label: 'Novo Lead',          color: '#7c3aed' },
  { id: 'contatado',         label: 'Contatado',           color: '#10B981' },
  { id: 'qualificado',       label: 'Qualificado',         color: '#F59E0B' },
  { id: 'negociacao_visita', label: 'Visita/Negociação',   color: '#8B5CF6' },
  { id: 'ganho_fechado',     label: 'Fechado',             color: '#14B8A6' },
];

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 160px' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-main)' }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function PipelineBar({ contacts }) {
  const total = contacts.length || 1;
  return (
    <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <TrendingUp size={16} color="var(--accent-primary)" /> Pipeline de Leads
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {COLUMNS.map(col => {
          const count = contacts.filter(c => c.status === col.id).length;
          const pct   = Math.round((count / total) * 100);
          return (
            <div key={col.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{col.label}</span>
                <span style={{ fontWeight: 700, color: col.color }}>{count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: col.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentList({ contacts }) {
  const recent = [...contacts]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8);

  const getTimeAgo = (iso) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}m atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return `${Math.floor(diff / 1440)}d atrás`;
  };

  const colColor = (status) => COLUMNS.find(c => c.id === status)?.color || 'var(--text-muted)';
  const colLabel = (status) => COLUMNS.find(c => c.id === status)?.label || status || '—';

  return (
    <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={16} color="var(--accent-primary)" /> Atividade Recente
      </h3>
      {recent.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum contato ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recent.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {(c.name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name || 'Sem nome'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formatPhone(c.phone) || '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: colColor(c.status), background: `${colColor(c.status)}18`, padding: '2px 8px', borderRadius: 20, marginBottom: 2 }}>
                  {colLabel(c.status)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{getTimeAgo(c.updated_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchAll = async () => {
    const { data } = await supabase.from('contacts').select('*').order('updated_at', { ascending: false });
    setContacts(data || []);
    setLoading(false);
  };

  const total    = contacts.length;
  const waCount  = contacts.filter(c => c.original_channel === 'whatsapp').length;
  const aiCount  = contacts.filter(c => c.handled_by_ai).length;
  const human    = contacts.filter(c => !c.handled_by_ai).length;
  const fechado  = contacts.filter(c => c.status === 'ganho_fechado').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', overflowY: 'auto', padding: '0.25rem 0.5rem 1rem' }}>

      {/* Estatísticas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <StatCard icon={Users}       label="Total de Contatos"  value={total}   color="var(--accent-primary)" />
        <StatCard icon={Smartphone}  label="Via WhatsApp"       value={waCount} color="#25D366" sub={total ? `${Math.round(waCount/total*100)}% do total` : ''} />
        <StatCard icon={Bot}         label="Atendidos por IA"   value={aiCount} color="#8B5CF6" />
        <StatCard icon={UserCheck}   label="Atendidos por Humano" value={human} color="#10B981" />
        <StatCard icon={MessageSquare} label="Negócios Fechados" value={fechado} color="#14B8A6" sub={total ? `${Math.round(fechado/total*100)}% conversão` : ''} />
      </div>

      {/* Pipeline + Recentes */}
      <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minHeight: 0, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 320px' }}>
          <PipelineBar contacts={contacts} />
        </div>
        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column' }}>
          <RecentList contacts={contacts} />
        </div>
      </div>
    </div>
  );
}
