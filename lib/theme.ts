/** Aparência: Escuro (Ônix), Claro (Marfim) ou Automático (segue o aparelho) */
export type Theme = 'onix' | 'marfim';
export type ThemePref = Theme | 'auto';

export const THEME_KEY = 'pharma_theme';

export function readThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'marfim' || t === 'onix' || t === 'auto' ? t : 'onix';
  } catch {
    return 'onix';
  }
}

export function resolveTheme(pref: ThemePref): Theme {
  if (pref !== 'auto') return pref;
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'marfim' : 'onix';
  } catch {
    return 'onix';
  }
}

/** Aplica no <html> e guarda a preferência; devolve o tema que ficou valendo */
export function applyTheme(pref: ThemePref): Theme {
  const t = resolveTheme(pref);
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'marfim' ? '#F7F6FB' : '#0B0B12');
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch { /* ignore */ }
  return t;
}
