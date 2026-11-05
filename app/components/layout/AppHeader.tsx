import { supabase } from '@/lib/supabase';

interface AppHeaderProps {
  userEmail: string | undefined;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div>
          <h1 className="app-brand">PharmaRoutes</h1>
          {userEmail && <span className="app-header-email">{userEmail}</span>}
        </div>
        <button className="app-header-logout" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </div>
    </header>
  );
}