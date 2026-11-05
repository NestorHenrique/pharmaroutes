import { supabase } from '@/lib/supabase';
import { LogOutIcon, RouteIcon } from '../ui/Icons';

interface AppHeaderProps {
  userEmail: string | undefined;
}

export default function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-[min(100%_-_1.5rem,760px)] items-center justify-between gap-3 sm:min-h-[72px] sm:w-[min(100%_-_2rem,760px)] sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-blue-500/30 bg-blue-600/15 text-blue-400"
          >
            <RouteIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-slate-100 sm:text-lg">PharmaRoutes</h1>
            {userEmail && <span className="block truncate text-xs text-slate-400">{userEmail}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <LogOutIcon className="size-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
