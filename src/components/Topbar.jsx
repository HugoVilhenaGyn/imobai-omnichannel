import React from 'react';

export default function Topbar({ title, subtitle }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="user-profile glass-panel hover:bg-hover cursor-pointer transition">
        <div className="avatar">IA</div>
        <span style={{ fontWeight: 500, marginLeft: '4px' }}>Agente Virtual</span>
      </div>
    </header>
  );
}
