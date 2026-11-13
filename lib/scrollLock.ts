/**
 * Trava a rolagem da página enquanto há folhas abertas. Conta quantas pedem a trava, então duas folhas
 * abertas ao mesmo tempo (ou uma abrindo antes da outra fechar) nunca deixam a página travada para sempre.
 */
let locks = 0;
let saved = '';

export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (locks === 0) saved = document.body.style.overflow;
  locks++;
  document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = saved;
  };
}
