import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginForm() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) alert('Erro ao entrar: ' + error.message);
    setAuthLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
      <form onSubmit={handleLogin} style={{ backgroundColor: '#09090b', padding: '30px', borderRadius: '20px', border: '1px solid #27272a', width: '90%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.8)' }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '22px', fontWeight: 800 }}>PharmaRoutes</h2>
          <p style={{ margin: '5px 0 0 0', color: '#a1a1aa', fontSize: '12px' }}>Acesse sua conta corporativa</p>
        </div>
        <input type="email" placeholder="Seu email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #27272a', backgroundColor: '#121215', color: '#fff', outline: 'none' }} />
        <input type="password" placeholder="Sua senha" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #27272a', backgroundColor: '#121215', color: '#fff', outline: 'none' }} />
        <button type="submit" disabled={authLoading} style={{ backgroundColor: '#2563eb', color: '#fff', padding: '12px', borderRadius: '10px', border: 'none', fontWeight: 700, marginTop: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}>
          {authLoading ? 'Entrando...' : 'Entrar na Plataforma'}
        </button>
      </form>
    </div>
  );
}