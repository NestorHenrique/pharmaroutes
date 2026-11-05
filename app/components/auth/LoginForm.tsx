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
    if (error) alert('Erro ao aceder: ' + error.message);
    setAuthLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #1f2937 0%, #09090b 100%)' }}>
      <form onSubmit={handleLogin} style={{ backgroundColor: 'rgba(24, 24, 27, 0.6)', backdropFilter: 'blur(16px)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', width: '90%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 700 }}>PharmaRoutes</h2>
          <p style={{ margin: '5px 0 0 0', color: '#a1a1aa', fontSize: '12px' }}>Acesse sua conta</p>
        </div>
        <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
        <input type="password" placeholder="Senha" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fff', outline: 'none' }} />
        <button type="submit" disabled={authLoading} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, marginTop: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}>
          {authLoading ? 'A entrar...' : 'Entrar na Plataforma'}
        </button>
      </form>
    </div>
  );
}