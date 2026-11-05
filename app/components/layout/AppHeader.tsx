import { supabase } from '@/lib/supabase';

interface AppHeaderProps {
  userEmail: string | undefined;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header style={{ backgroundColor: '#000000', borderBottom: '1px solid #1A1A1A', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.5px' }}>PharmaRoutes</h1>
          <span style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>{userEmail}</span>
        </div>
        
        <button 
          onClick={() => supabase.auth.signOut()} 
          style={{ backgroundColor: '#1A1A1A', color: '#A1A1AA', border: '1px solid #27272A', padding: '8px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Sair
        </button>
      </div>
    </header>
  );
}