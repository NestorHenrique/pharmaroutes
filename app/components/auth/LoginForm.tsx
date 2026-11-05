import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginForm() {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) alert(`Erro ao acessar: ${error.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-heading">
          <div className="login-mark" aria-hidden="true">P</div>
          <span className="doctor-eyebrow">PharmaRoutes</span>
          <h1>Acesse sua conta</h1>
          <p>Entre para continuar seu roteiro de visitas.</p>
        </div>
        <label className="login-field">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="voce@empresa.com"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
          />
        </label>
        <label className="login-field">
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Sua senha"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
          />
        </label>
        <button className="login-submit" type="submit" disabled={authLoading}>
          {authLoading ? 'A entrar...' : 'Entrar na plataforma'}
        </button>
      </form>
    </main>
  );
}
