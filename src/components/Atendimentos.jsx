import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatPhone } from '../lib/formatPhone';
import { io } from 'socket.io-client';
import {
  User, Phone, Smartphone, AlertTriangle, Trash2,
  Check, X, RefreshCw, Search, Bot, UserCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Socket (module-level singleton)
// ---------------------------------------------------------------------------
const socket = io('http://localhost:3001', { transports: ['websocket', 'polling'] });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const isLid = (phone) => Boolean(phone && /^\d{14,}$/.test(phone));

function getInitials(name) {
  if (!name || !name.trim()) return null;
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Styles (inline object helpers)
// ---------------------------------------------------------------------------
const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.25rem',
    height: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 0.9rem',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flex: 1,
    minWidth: '200px',
    maxWidth: '400px',
  },
  searchInput: {
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-main)',
    fontSize: '0.9rem',
    flex: 1,
  },
  statsRow: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.75rem 1.25rem',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    minWidth: '120px',
    backdropFilter: 'blur(10px)',
  },
  statNumber: {
    fontSize: '1.6rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '0.9rem',
  },
  card: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    padding: '1rem 1.1rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
  },
  avatar: (color) => ({
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: '#fff',
    flexShrink: 0,
  }),
  name: {
    fontWeight: 700,
    color: 'var(--text-main)',
    fontSize: '0.95rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    background: 'rgba(255,255,255,0.07)',
    padding: '1px 5px',
    borderRadius: '4px',
    color: 'var(--text-main)',
  },
  badge: (bg, color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '0.72rem',
    fontWeight: 600,
    background: bg,
    color: color || '#fff',
  }),
  badgesRow: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '0.2rem',
  },
  timestamp: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  deleteBtn: (hovered) => ({
    background: hovered ? 'rgba(239,68,68,0.15)' : 'transparent',
    border: hovered ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
    borderRadius: '6px',
    color: hovered ? '#ef4444' : 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '3px 7px',
    fontSize: '0.78rem',
    transition: 'all 0.18s',
  }),
  btn: (variant) => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.45rem 0.9rem',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '0.85rem',
      transition: 'opacity 0.15s',
    };
    if (variant === 'primary')
      return { ...base, background: 'var(--accent-primary)', color: '#fff' };
    if (variant === 'warning')
      return { ...base, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' };
    if (variant === 'ghost')
      return { ...base, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' };
    return base;
  },
  inlineInput: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    color: 'var(--text-main)',
    fontSize: '0.8rem',
    padding: '2px 6px',
    outline: 'none',
    width: '140px',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.25)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Avatar({ name, lid }) {
  const initials = getInitials(name);
  const color = lid ? '#b45309' : '#7c3aed';
  return (
    <div style={S.avatar(color)}>
      {initials ? initials : <User size={18} color="#fff" />}
    </div>
  );
}

function PhoneRow({ contact, onSave }) {
  const { id, phone, original_channel } = contact;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const lid = isLid(phone);

  const startEdit = () => {
    setDraft('');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const confirmEdit = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSave(id, draft);
    setSaving(false);
    setEditing(false);
  };

  if (lid) {
    return (
      <div style={{ ...S.row, flexWrap: 'wrap', gap: '0.4rem' }}>
        <AlertTriangle size={13} color="#f59e0b" />
        <span style={{ color: '#f59e0b', fontWeight: 600 }}>Sem telefone real</span>
        {!editing ? (
          <button style={S.btn('warning')} onClick={startEdit}>Corrigir</button>
        ) : (
          <>
            <input
              style={S.inlineInput}
              placeholder="Ex: 5511999998888"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit(); }}
              autoFocus
            />
            <button style={S.btn('ghost')} onClick={confirmEdit} disabled={saving}>
              {saving ? <span style={S.spinner} /> : <Check size={13} />}
            </button>
            <button style={S.btn('ghost')} onClick={cancelEdit} disabled={saving}>
              <X size={13} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={S.row}>
      <Phone size={13} color="var(--text-muted)" />
      <span>{formatPhone(phone)}</span>
    </div>
  );
}

function WhatsAppIdRow({ phone }) {
  if (!phone) return null;
  const lid = isLid(phone);
  const suffix = lid ? '@lid' : '@c.us';
  return (
    <div style={S.row}>
      <Smartphone size={13} color="#25D366" />
      <span style={{ color: 'var(--text-muted)' }}>WhatsApp ID:</span>
      <code style={S.code}>{phone}{suffix}</code>
    </div>
  );
}

function BadgesRow({ contact }) {
  const { handled_by_ai, original_channel, status } = contact;

  const statusLabel = status ? status.replace(/_/g, ' ') : 'novo';

  const statusColor =
    status === 'fechado'      ? 'rgba(239,68,68,0.2)'  :
    status === 'contatado'    ? 'rgba(34,197,94,0.2)'  :
    status === 'novo_contato' ? 'rgba(124,58,237,0.15)':
                                'rgba(148,163,184,0.15)';

  return (
    <div style={S.badgesRow}>
      {handled_by_ai ? (
        <span style={S.badge('rgba(124,58,237,0.2)', '#a78bfa')}>
          <Bot size={10} /> IA
        </span>
      ) : (
        <span style={S.badge('rgba(34,197,94,0.2)', '#4ade80')}>
          <UserCheck size={10} /> Humano
        </span>
      )}

      {original_channel === 'whatsapp' && (
        <span style={S.badge('rgba(37,211,102,0.15)', '#25D366')}>
          WhatsApp
        </span>
      )}

      <span style={S.badge(statusColor, 'var(--text-muted)')}>
        {statusLabel}
      </span>
    </div>
  );
}

function DeleteControl({ onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Excluir?</span>
        <button style={S.btn('ghost')} onClick={handleConfirm} disabled={deleting}>
          {deleting ? <span style={S.spinner} /> : <Check size={12} color="#ef4444" />}
        </button>
        <button style={S.btn('ghost')} onClick={() => setConfirming(false)} disabled={deleting}>
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      style={S.deleteBtn(hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setConfirming(true)}
      title="Excluir contato"
    >
      <Trash2 size={13} />
    </button>
  );
}

function ContactCard({ contact, onSave, onDelete }) {
  const { name, phone, original_channel, updated_at } = contact;
  const lid = isLid(phone);

  return (
    <div className="glass-panel" style={S.card}>
      {/* Header */}
      <div style={S.cardHeader}>
        <Avatar name={name} lid={lid} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.name}>{name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem nome</span>}</div>
        </div>
      </div>

      {/* Phone */}
      <PhoneRow contact={contact} onSave={onSave} />

      {/* WhatsApp ID (only for whatsapp channel) */}
      {original_channel === 'whatsapp' && (
        <WhatsAppIdRow phone={phone} />
      )}

      {/* Badges */}
      <BadgesRow contact={contact} />

      {/* Footer */}
      <div style={S.footer}>
        <span style={S.timestamp}>{fmtDate(updated_at)}</span>
        <DeleteControl onDelete={() => onDelete(contact.id)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function Atendimentos() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveLog, setResolveLog] = useState(null); // { resolved, errors }

  // -------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------
  const fetchContacts = useCallback(async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error) setContacts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // -------------------------------------------------------------------
  // Realtime subscription
  // -------------------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel('atendimentos-contacts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => { fetchContacts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchContacts]);

  // -------------------------------------------------------------------
  // handleSavePhone
  // -------------------------------------------------------------------
  const handleSavePhone = useCallback(async (contactId, rawValue) => {
    const digits = rawValue.replace(/\D/g, '');
    await supabase
      .from('contacts')
      .update({ phone: digits })
      .eq('id', contactId);
    fetchContacts();
  }, [fetchContacts]);

  // -------------------------------------------------------------------
  // handleDelete
  // -------------------------------------------------------------------
  const handleDelete = useCallback(async (contactId) => {
    // Delete messages first (FK safety)
    await supabase.from('messages').delete().eq('contact_id', contactId);
    await supabase.from('contacts').delete().eq('id', contactId);
    fetchContacts();
  }, [fetchContacts]);

  // -------------------------------------------------------------------
  // Resolver IDs
  // -------------------------------------------------------------------
  const handleResolveLids = useCallback(() => {
    const lids = contacts
      .filter((c) => isLid(c.phone))
      .map((c) => ({ id: c.id, phone: c.phone }));

    if (lids.length === 0) return;

    setResolving(true);
    setResolveLog(null);

    socket.emit('resolve_lids', lids);

    const handler = async (results) => {
      let resolved = 0;
      let errors = 0;

      for (const r of results) {
        if (r.newPhone && !r.error) {
          await supabase
            .from('contacts')
            .update({ phone: r.newPhone })
            .eq('id', r.id);
          resolved++;
        } else {
          errors++;
        }
      }

      setResolveLog({ resolved, errors });
      setResolving(false);
      fetchContacts();
    };

    socket.once('resolve_lids_result', handler);
  }, [contacts, fetchContacts]);

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------
  const filtered = contacts.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const totalContacts = contacts.length;
  const withWhatsApp = contacts.filter((c) => c.original_channel === 'whatsapp').length;
  const handledByAI = contacts.filter((c) => c.handled_by_ai === true).length;
  const lidCount = contacts.filter((c) => isLid(c.phone)).length;

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div style={S.page}>
      {/* Keyframe injection */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Top Bar */}
      <div style={S.topBar}>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-main)', flexShrink: 0 }}>
          Atendimentos
        </h2>

        {/* Search */}
        <div style={S.searchBox}>
          <Search size={15} color="var(--text-muted)" />
          <input
            style={S.searchInput}
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Refresh */}
        <button
          style={S.btn('ghost')}
          onClick={fetchContacts}
          title="Recarregar"
        >
          <RefreshCw size={14} />
        </button>

        {/* Resolver IDs */}
        <button
          style={{
            ...S.btn('primary'),
            opacity: resolving || lidCount === 0 ? 0.6 : 1,
            cursor: resolving || lidCount === 0 ? 'not-allowed' : 'pointer',
          }}
          onClick={handleResolveLids}
          disabled={resolving || lidCount === 0}
          title={lidCount === 0 ? 'Nenhum LID para resolver' : `Resolver ${lidCount} LID(s)`}
        >
          {resolving ? (
            <span style={S.spinner} />
          ) : (
            <Smartphone size={14} />
          )}
          Resolver IDs
          {lidCount > 0 && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '10px',
              padding: '0 6px',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}>
              {lidCount}
            </span>
          )}
        </button>
      </div>

      {/* Resolve feedback */}
      {resolveLog && (
        <div style={{
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          background: resolveLog.errors > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${resolveLog.errors > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>
            Resolução concluída — <strong>{resolveLog.resolved}</strong> resolvidos, <strong>{resolveLog.errors}</strong> erros.
          </span>
          <button
            onClick={() => setResolveLog(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={S.statsRow}>
        <div style={S.statCard}>
          <span style={{ ...S.statNumber, color: 'var(--accent-primary)' }}>{totalContacts}</span>
          <span style={S.statLabel}>Total de Contatos</span>
        </div>
        <div style={S.statCard}>
          <span style={{ ...S.statNumber, color: '#25D366' }}>{withWhatsApp}</span>
          <span style={S.statLabel}>Com WhatsApp</span>
        </div>
        <div style={S.statCard}>
          <span style={{ ...S.statNumber, color: '#a78bfa' }}>{handledByAI}</span>
          <span style={S.statLabel}>Atendidos por IA</span>
        </div>
        {lidCount > 0 && (
          <div style={S.statCard}>
            <span style={{ ...S.statNumber, color: '#f59e0b' }}>{lidCount}</span>
            <span style={S.statLabel}>IDs sem Telefone</span>
          </div>
        )}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={S.emptyState}>
          <span style={{ ...S.spinner, width: '24px', height: '24px', borderWidth: '3px' }} />
          <p>Carregando contatos…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={S.emptyState}>
          {search ? (
            <>Nenhum contato encontrado para "<strong>{search}</strong>".</>
          ) : (
            'Nenhum contato cadastrado ainda.'
          )}
        </div>
      ) : (
        <div style={S.grid}>
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onSave={handleSavePhone}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
