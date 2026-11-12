---
name: acessibilidade
description: Checklist de acessibilidade do app PharmaRoutes. Use sempre que criar ou alterar tela, botão, campo, janela, aviso ou cor, para garantir contraste, alvo de toque, foco, leitor de tela e leitura ao sol.
---

# Acessibilidade (app de campo)

O rep usa o celular na rua, ao sol, com uma mão. Se não lê rápido, não serve. Confira tudo abaixo antes de entregar.

## Leitura
- Contraste do texto: **4,5:1** no mínimo (3:1 só para texto grande, 24px ou mais). Vale para os **dois temas** (`onix` e `marfim`).
- Texto secundário (`text-slate-400`) e apagado (`text-slate-500`) nunca em tamanho menor que 12px. Rótulos de campo: 12px, peso 600.
- Campos de formulário com **16px** (o iOS dá zoom em menos que isso).
- Cor nunca é a única pista. Status sempre com texto ou ícone ("Último paciente", ícone de visto).
- Não dependa de passar o dedo ou segurar para o essencial. Arrastar sempre tem alternativa (campo de posição ou menu "Mover para cima/baixo").

## Toque
- Alvo mínimo **44×44px** (botão de ícone, chip, aba, linha clicável). Espaço mínimo de 8px entre alvos.
- Ação perigosa (excluir, renovar ciclo) pede confirmação e nunca fica colada num botão comum.

## Teclado e foco
- Tudo que clica é `<button>` ou `<a>`. Nunca `div` ou `span` com `onClick`.
- Foco visível em todo elemento (já existe `:focus-visible` em `app/globals.css`; não remova nem esconda com `outline-none` sem substituto).
- Janelas e folhas: `role="dialog"` com `aria-modal="true"` e `aria-labelledby`; foco vai para dentro ao abrir, volta ao botão de origem ao fechar; **Esc** fecha.

## Leitor de tela
- Botão só com ícone: `aria-label` ("Marcar status", "Arrastar para mudar a ordem", "Notificações").
- Estado: `aria-pressed` (chip ligado), `aria-expanded` (recolher/expandir), `aria-current` (dia ativo), `role="switch"` + `aria-checked` (interruptor), `role="radiogroup"` / `role="radio"` (escolha única).
- Ícone decorativo: `aria-hidden="true"`. Ícone que informa: `role="img"` com `aria-label`.
- Avisos que somem (toast, faixa de conexão): `role="status"` ou `aria-live="polite"`. Erro de formulário: `role="alert"` e ligado ao campo por `aria-describedby`.
- Todo campo tem `<label>` (ou `aria-label`). Placeholder não substitui rótulo.

## Movimento
- Respeite `prefers-reduced-motion` (já tratado em `app/globals.css`). Animações curtas (até 250 ms).

## Como conferir rápido
- Procure `onClick` em `div`/`span`: `grep -rn "<div[^>]*onClick\|<span[^>]*onClick" components app`.
- Procure `<button` sem texto nem `aria-label` que só tenha `<svg>`.
- Abra a tela nos dois temas e olhe texto cinza sobre card.
- Diga no fim o que **não** foi possível conferir (por exemplo, leitor de tela real).
