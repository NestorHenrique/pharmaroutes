import { supabase } from '@/lib/supabase';

/** Traduz os erros mais comuns do login para frases simples */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  if (m.includes('network') || m.includes('fetch')) return 'Sem conexão. Verifique a internet e tente de novo.';
  if (m.includes('weak') || m.includes('password should')) return 'Senha fraca. Use pelo menos 8 caracteres, com letra e número.';
  return message;
}

/** "Esqueci a senha": manda o link por e-mail. Devolve uma mensagem de erro ou null. */
export async function sendResetEmail(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
  return error ? friendly(error.message) : null;
}

/** Definir a nova senha depois de abrir o link do e-mail (sessão de recuperação) */
export async function setNewPassword(next: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? friendly(error.message) : null;
}

/** Trocar a senha logado: confere a senha atual primeiro */
export async function changePassword(email: string, current: string, next: string): Promise<string | null> {
  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (checkError) return checkError.message.toLowerCase().includes('invalid') ? 'A senha atual está incorreta.' : friendly(checkError.message);
  return setNewPassword(next);
}

export { friendly as friendlyAuthError };

/* ── "Manter conectado" ──
 * Desmarcado: ao fechar o app e abrir de novo, pede o login outra vez.
 * Guardamos a escolha no aparelho e um marcador da sessão atual (some quando o app é fechado).
 */
const KEEP_KEY = 'pr-keep-login';
const ALIVE_KEY = 'pr-session-alive';

export function rememberKeepLogin(keep: boolean): void {
  try {
    localStorage.setItem(KEEP_KEY, keep ? '1' : '0');
    sessionStorage.setItem(ALIVE_KEY, '1');
  } catch { /* ignore */ }
}

/** true = este app foi fechado e reaberto e a pessoa pediu para NÃO manter conectado */
export function shouldSignOutOnReopen(): boolean {
  try {
    const keep = localStorage.getItem(KEEP_KEY);
    const alive = sessionStorage.getItem(ALIVE_KEY) === '1';
    if (!alive) sessionStorage.setItem(ALIVE_KEY, '1');
    return keep === '0' && !alive;
  } catch {
    return false;
  }
}
