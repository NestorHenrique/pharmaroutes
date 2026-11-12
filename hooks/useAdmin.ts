import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** O usuário é administrador do app? (tabela app_admins: cada um só enxerga a própria linha) */
export function useAdmin(userId: string | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setIsAdmin(false);
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled && !error) setIsAdmin(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return isAdmin;
}
