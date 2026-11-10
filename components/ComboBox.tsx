'use client';

import { useState } from 'react';
import { normalizeText } from '@/utils';
import PickerSheet from '@/components/PickerSheet';

export interface ComboOption {
  value: string;
  label: string;
  /** texto pequeno à direita (sigla, contagem...) */
  hint?: string;
}

interface ComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  ariaLabel?: string;
  /** permite texto que não está na lista (ex.: cidade nova) */
  allowCustom?: boolean;
  size?: 'sm' | 'md';
  /** título da folha de seleção (padrão: o placeholder) */
  title?: string;
}

/**
 * Campo de seleção: toque abre uma folha por baixo com busca sem acento
 * ("parnaiba" acha "Parnaíba"), lista grande, Limpar e Cancelar.
 */
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  allowCustom = true,
  size = 'md',
  title,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);

  const key = normalizeText(value);
  const match = key ? options.find((o) => normalizeText(o.value) === key || normalizeText(o.label) === key) : undefined;
  const shown = match?.label ?? value;
  const pad = size === 'sm' ? 'h-10 px-3' : 'h-11 px-3.5';

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? placeholder}
        onClick={() => setOpen(true)}
        className={`flex w-full min-w-0 box-border items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 text-left text-base sm:text-sm hover:border-slate-500 ${pad}`}
      >
        <span className={`truncate ${shown ? 'text-slate-100' : 'text-slate-500'}`}>{shown || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <PickerSheet
          title={title ?? placeholder ?? 'Selecionar'}
          options={options}
          value={value}
          allowCustom={allowCustom}
          searchPlaceholder={`Buscar ${(placeholder ?? 'opção').toLowerCase()}...`}
          onSelect={(v) => {
            onChange(v);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
