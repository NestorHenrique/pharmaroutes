---
name: teste-mobile
description: Como conferir visualmente uma mudança de tela do PharmaRoutes no celular (390px), nos dois temas, sem precisar de login real. Use depois de alterar layout, card, folha ou cor, antes de entregar.
---

# Teste visual no celular

O app só abre com login do Supabase, então confira **o componente isolado** com dados de exemplo.

## Passo a passo
1. `npm ci` (se faltar `node_modules`).
2. Crie uma página **temporária** `app/zz-preview/page.tsx` (`'use client'`) que renderiza só o componente alterado com dados fictícios
   (para `DoctorCard`, monte `Doctor` e `DoctorStatus` de exemplo e passe `onToggleExpand`, `expanded={false}`, `tier`, `statuses`).
3. Suba o app com chaves de teste:
   `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next dev -p 3101`
4. Tire foto com o Playwright que já vem instalado (`require('playwright')`), tela **390×844**, `deviceScaleFactor: 1`
   (use 2 só se for mostrar para a pessoa), **nos dois temas**: antes de abrir a página,
   `localStorage.setItem('pharma_theme', 'onix' | 'marfim')`.
5. Olhe as imagens e confira a lista abaixo.
6. **Apague** `app/zz-preview` e pare o servidor. Nunca envie a página de teste para o repositório.

## O que olhar
- Texto cortado ou quebrado (nome comprido, clínica comprida, cidade). Regra da linha de local: mais de 30 caracteres desce bairro e cidade.
- Alvos de toque abaixo de 44px; botões colados um no outro.
- Contraste do texto cinza nos **dois** temas.
- Etiquetas de status legíveis (texto escuro sobre vermelho/azul/amarelo no escuro; texto claro no claro).
- Nada esticando a tela na horizontal (rolagem lateral = erro).
- Estados: normal, ativo, desativado, vazio, erro, carregando.

## Verificação de código
- `npx tsc --noEmit`: sem erro novo (os de `app/components/*` e `app/hooks/useDoctors.ts` já existiam).
- `npm run build` com as chaves de teste acima deve passar.
- `npm run lint` está quebrado desde antes; não use como prova.

## No relatório final
Diga o que viu em cada tema, o que **não** conseguiu testar (login real, notificação push, offline) e anexe só imagens que a pessoa precise ver.
