import type { CSSProperties } from 'react';

// Input padrão (formulário de cadastro)
export const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #27272a',
  backgroundColor: '#09090b',
  color: '#fff',
  fontSize: '12px',
};

// Input compacto (edição dentro do card)
export const inputSmStyle: CSSProperties = {
  ...inputStyle,
  padding: '6px',
  borderRadius: '4px',
  backgroundColor: '#18181b',
  fontSize: '11px',
};

export const primaryButton: CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
