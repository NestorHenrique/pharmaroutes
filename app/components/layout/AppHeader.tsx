import { supabase } from '@/lib/supabase';

interface AppHeaderProps {
  userEmail: string | undefined;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
}

export default function AppHeader({ userEmail, showAddForm, setShowAddForm }: AppHeaderProps) {
  return (
    <header style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(9, 9, 11, 0.65)', backdropFilter: 'blur(12px)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>PharmaRoutes</h1>
          <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 500 }}>{userEmail}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: showAddForm ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#fff', border: '1px solid rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', boxShadow: showAddForm ? 'none' : '0 4px 12px rgba(37,99,235,0.25)' }}>
            {showAddForm ? 'Cancelar' : '+ Médico'}
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Sair</button>
        </div>
      </div>
    </header>
  );
}