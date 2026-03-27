import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building, Lock, Mail, Loader2, User, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false); // Alterna entre Login e Cadastro
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Controle do olhinho
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isSignUp) {
        // Fluxo de criar conta
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });
        
        if (error) throw error;

        // Se o e-mail já estiver cadastrado em contas que requerem confirmação, o Supabase não retorna erro, mas empty session
        if (data?.user?.identities?.length === 0) {
          setErrorMsg("Este e-mail já está cadastrado.");
        } else {
          setSuccessMsg("Conta criada com sucesso! Se o seu Supabase exigir, confirme o e-mail na sua caixa de entrada, e então faça o login abaixo.");
          setIsSignUp(false);
          setPassword(''); // Limpa a senha por segurança
        }
      } else {
        // Fluxo normal de login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      if (error.message === 'Invalid login credentials') {
        setErrorMsg('Email ou senha incorretos. (Se você acabou de criar a conta, veja se não precisa confirmar o link no e-mail ou desativar o "Confirm Email" no Supabase).');
      } else if (error.message === 'Email not confirmed') {
        setErrorMsg('Você precisa confirmar seu e-mail antes de fazer login.');
      } else if (error.message === 'User already registered') {
        setErrorMsg('Este e-mail já está cadastrado.');
      } else if (error.message.includes('Password should be at least')) {
        setErrorMsg('A senha precisa ter pelo menos 6 caracteres.');
      } else {
        setErrorMsg('Erro: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      minHeight: '100vh', backgroundColor: 'var(--bg-main)', 
      padding: '2rem', fontFamily: 'Inter, sans-serif'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '400px', padding: '2.5rem',
        display: 'flex', flexDirection: 'column', gap: '1.5rem',
        textAlign: 'center'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
          <Building size={32} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-main)' }}>ImobAI</h1>
        </div>

        <div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
            {isSignUp ? 'Criar Nova Conta' : 'Acesse sua Conta'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isSignUp ? 'Cadastre-se para começar a gerenciar seus leads.' : 'Faça login para gerenciar seus leads e chamados.'}
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
            padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
            padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
          
          {isSignUp && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <User size={16}/> Nome Completo
              </label>
              <input 
                type="text" 
                required={isSignUp}
                placeholder="João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)',
                  color: 'var(--text-main)', outline: 'none'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Mail size={16}/> E-mail
            </label>
            <input 
              type="email" 
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                border: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)',
                color: 'var(--text-main)', outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <Lock size={16}/> Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: '8px',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)',
                  color: 'var(--text-main)', outline: 'none'
                }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isSignUp && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                A senha deve ter pelo menos 6 caracteres.
              </span>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              backgroundColor: 'var(--accent-primary)', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '0.875rem',
              fontWeight: 600, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              marginTop: '0.5rem', transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : (isSignUp ? 'Criar Conta' : 'Entrar no Painel')}
          </button>
        </form>

        <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isSignUp ? 'Já tem uma conta?' : 'Ainda não é cadastrado?'}
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--accent-primary)',
                fontWeight: 600, marginLeft: '0.5rem', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'inherit'
              }}
            >
              {isSignUp ? 'Faça login aqui' : 'Criar conta agora'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}
