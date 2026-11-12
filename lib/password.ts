/** Regras de senha mostradas em verde conforme a pessoa digita */
export interface PasswordRule {
  id: string;
  label: string;
  ok: boolean;
}

export function passwordRules(password: string, repeat: string): PasswordRule[] {
  return [
    { id: 'len', label: 'Pelo menos 8 caracteres', ok: password.length >= 8 },
    { id: 'letter', label: 'Uma letra', ok: /[A-Za-zÀ-ÿ]/.test(password) },
    { id: 'digit', label: 'Um número', ok: /\d/.test(password) },
    { id: 'match', label: 'As duas senhas iguais', ok: password.length > 0 && password === repeat },
  ];
}

export const passwordValid = (password: string, repeat: string): boolean =>
  passwordRules(password, repeat).every((r) => r.ok);
