interface ConnectionBannerProps {
  online: boolean;
  /** alterações esperando para subir */
  pending: number;
  syncing: boolean;
  /** acabou de subir tudo (some sozinho depois de alguns segundos) */
  justSynced: boolean;
}

/**
 * Faixa de conexão no cabeçalho: sem internet (amarela), enviando (azul) e tudo enviado (verde).
 * Quando está tudo certo e nada pendente, não aparece.
 */
export default function ConnectionBanner({ online, pending, syncing, justSynced }: ConnectionBannerProps) {
  const n = `${pending} ${pending === 1 ? 'alteração' : 'alterações'}`;
  let tone = '';
  let text = '';
  if (!online) {
    tone = 'border-amber-500 bg-amber-950 text-amber-300';
    text = pending > 0 ? `Sem internet. ${n} ficam guardadas e vão sozinhas quando voltar.` : 'Sem internet. Suas marcações ficam guardadas e vão sozinhas quando voltar.';
  } else if (pending > 0) {
    tone = 'border-sky-500 bg-sky-950 text-sky-300';
    text = syncing ? `Enviando ${n}…` : `${n} esperando para enviar.`;
  } else if (justSynced) {
    tone = 'border-emerald-800 bg-emerald-950 text-emerald-300';
    text = 'Tudo enviado. Seus colegas já veem.';
  } else {
    return null;
  }
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-[13px] font-semibold leading-snug ${tone}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-current" />
      {text}
    </div>
  );
}
