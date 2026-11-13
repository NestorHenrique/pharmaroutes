'use client';

import { useState, useRef, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';

interface IASheetProps {
  repName: string;
  city: string;
  onClose: () => void;
}

type Msg = { role: 'user' | 'ai'; text: string };

const SUGGESTIONS = [
  'Reorganize minha rota de hoje pelos horários',
  'Quem falta visitar neste ciclo desta semana?',
  'Monte minha rota de amanhã',
  'Quanto falta para fechar meu ciclo?',
];

const PLACEHOLDER_REPLIES: Record<string, string> = {
  default: 'Entendido. Para aplicar isso à sua rota, preciso acessar seus dados de agendas e visitas. Assim que a integração estiver completa, farei isso automaticamente para você.',
};

/** Assistente de rota: interface de chat para pedir ajustes de rota, dúvidas e resumos. */
export default function IASheet({ repName, city, onClose }: IASheetProps) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', text: text.trim() };
    setMsgs((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    // Resposta placeholder (sem backend real ainda)
    setTimeout(() => {
      const reply = PLACEHOLDER_REPLIES[text.trim()] ?? PLACEHOLDER_REPLIES.default;
      setMsgs((m) => [...m, { role: 'ai', text: reply }]);
      setLoading(false);
    }, 900);
  }

  return (
    <BottomSheet
      title="Assistente da rota"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* contexto */}
        <div className="rounded-2xl border border-blue-900 bg-blue-950/50 px-4 py-3">
          <p className="m-0 text-[13px] text-blue-300">
            <span className="font-semibold">{repName}</span> · {city} · Rota de hoje
          </p>
          <p className="m-0 mt-0.5 text-[12px] text-blue-400/80">
            Peça do seu jeito — ajusto a rota, respondo dúvidas e mostro o que falta no ciclo.
          </p>
        </div>

        {/* conversa */}
        {msgs.length === 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Experimente</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left text-[14px] font-medium text-slate-200 active:bg-slate-800"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-blue-400" aria-hidden="true">
                  <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                  <path d="M19 16v4M17 18h4" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 overflow-y-auto">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`max-w-[88%] rounded-[18px] px-4 py-3 text-[14px] leading-snug ${
                  m.role === 'user'
                    ? 'self-end rounded-br-[6px] bg-blue-600 text-white'
                    : 'self-start rounded-bl-[6px] border border-slate-800 bg-slate-900 text-slate-100'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="self-start rounded-[18px] rounded-bl-[6px] border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-slate-500"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* input */}
      <div className="flex gap-2 border-t border-slate-800 pt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="Peça uma rota, um ajuste, uma dúvida…"
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-[14px] text-slate-100 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          aria-label="Enviar"
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11l18-8-8 18-2-8z" />
          </svg>
        </button>
      </div>
    </BottomSheet>
  );
}
