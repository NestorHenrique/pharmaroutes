/**
 * Marcas por usuário guardadas no aparelho (primeiro acesso, tutorial visto...).
 * São a reserva quando a coluna correspondente de rep_profiles ainda não existe (migração v12),
 * para o app nunca ficar repetindo a mesma pergunta.
 */
const PREFIX = 'pr-flag:';

export function getFlag(userId: string, name: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${name}:${userId}`);
  } catch {
    return null;
  }
}

export function setFlag(userId: string, name: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(`${PREFIX}${name}:${userId}`);
    else localStorage.setItem(`${PREFIX}${name}:${userId}`, value);
  } catch { /* sem espaço / modo privado: segue sem a reserva */ }
}
