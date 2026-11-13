---
name: mapa-do-app
description: Roteiro para ler o PharmaRoutes gastando poucos tokens e para abrir a tela inicial inteira com dados fictícios. Use no começo de qualquer tarefa que precise entender o app, propor melhorias ou conferir a tela inicial.
---

# Mapa do app (leia isto antes de abrir arquivos)

## Prompt de leitura
"Não leia `app/page.tsx` inteiro (quase 3 mil linhas). Rode `grep -n` pelos comentários `{/* ... */}` e pelos `useState` para achar o trecho, e leia só ele. Ignore `app/components/*` e `app/hooks/useDoctors.ts` (código morto). Veja o `git log --oneline | head -40` para saber o que já foi feito. Só então abra o componente da tarefa."

## Onde fica cada coisa
- `app/page.tsx`: o app inteiro. Estado `mainTab` troca as abas (Hoje, Mapa, Médicos, Eu); o cabeçalho e o `<main>` têm um bloco por aba. Também guarda todas as folhas e portões (termos, nome, semana, "Já visitou?").
- Abas novas: `BottomNav`, `NextDoctorCard`, `LiveStrip`, `RouteMap` (+ `lib/coords.ts`), `MeTab`, `ProgressRing`.
- `components/DoctorCard.tsx`: card do médico (fechado e aberto). `DoctorSheet.tsx`: ficha. `StatusSheet.tsx`: marcar status.
- `components/BottomSheet.tsx` e `PickerSheet.tsx`: base das folhas. `EmptyState.tsx`: estado vazio (ícones `busca`, `medico`, `agenda`).
- `hooks/`: dados por rep (`useRepProfile`, `useVisits`, `useWeekCities`, `useNotifications`, `useLocations`).
- `lib/`: fila offline, push, busca, locais. `utils.ts` e `constants.ts`: formatação, dias, turnos, especialidades.
- `app/globals.css`: os dois temas (as escalas `slate` e `blue` são remapeadas).
- `sql/`: migrações (nunca aplicar sozinho).

## Regras que confundem
- A semana do ciclo de cada médico vem de `rep_route_order` (`day_of_week = ciclo_w1..ciclo_w5`), não de `doctors.cycle_weeks`.
- A semana ativa conta como filtro (o selo "1" no botão de filtros).

## Ver a tela inicial inteira sem login
O Playwright não está instalado. Use o navegador interno:
1. Crie `app/zz-preview/page.tsx` (`'use client'`) que, num `useEffect`: troca `window.fetch` por uma versão que responde com dados fictícios a tudo que for `/rest/v1/`, `/auth/v1/` etc. (nada chega ao banco real), troca `window.WebSocket` por uma classe vazia, grava uma sessão falsa em `localStorage['sb-<ref>-auth-token']` e `pharma_active_week`, e só depois faz `import('../page')`.
2. Dados mínimos: `doctors` (com `agenda` do dia), `rep_profiles` (termos, nome e tour já aceitos), `rep_route_order` (`ciclo_w1` com os ids), `rep_week_cities`, `doctor_visits`, `doctor_statuses` (devolva `[]` quando a URL tiver `created_by=eq.` para não abrir "Já visitou?").
3. Suba com a configuração `pharmaroute-teste` de `.claude/launch.json` (porta 3101; a 3000 é a do login real, não misture), abra `/zz-preview?tema=onix` e `?tema=marfim` em 390×844.
4. Nunca abra `/` com a sessão falsa. Apague `app/zz-preview` antes do commit.
