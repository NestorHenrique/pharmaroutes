---
name: front-end
description: Padrão visual e de layout do app PharmaRoutes (Rota Propagandista). Use ao criar ou alterar qualquer tela, componente, card, folha, formulário, cor ou texto do app, para seguir o design aprovado (violeta, status coloridos, folhas que sobem de baixo, botões de 52px, alvos de 44px).
---

# Front-end do PharmaRoutes

O app é usado por propagandistas (reps) em campo, no celular, muitas vezes ao sol e com pressa.
Cada tela deve ser lida em 2 segundos, com um toque por ação e sem texto de sobra.

## Antes de começar
1. Leia `AGENTS.md` e o guia em `node_modules/next/dist/docs` (esta versão do Next tem mudanças).
2. Responda e escreva textos de tela em **português**, curtos e diretos.
3. Não crie cores novas e nunca escreva cor em hexadecimal no componente. Use as classes do tema (abaixo).
4. Mobile primeiro (390px). Teste nos dois temas: `onix` (escuro) e `marfim` (claro).

## Cores: sempre pelas variáveis do tema (`app/globals.css`)
O tema remapeia as escalas do Tailwind; use sempre as mesmas classes nos dois temas:

| Uso | Classe |
|---|---|
| Fundo da página | `bg-slate-950` |
| Card, folha, menu | `bg-slate-900` com `border-slate-800` (borda mais forte: `border-slate-700`) |
| Fundo sutil, alça, chip inativo | `bg-slate-800` |
| Texto principal | `text-white` ou `text-slate-100` |
| Texto secundário | `text-slate-400` |
| Texto apagado | `text-slate-500` |
| Destaque (botão principal, aba ativa) | `bg-blue-600` (violeta; o texto vira escuro no tema escuro e branco no claro, já tratado no CSS) |
| Seleção (chip ligado) | `border-blue-600 bg-blue-900 text-blue-200` |
| Botão de bandeira / ícone de destaque | `border-blue-800 bg-blue-950 text-blue-600` |

Status (borda do card, fundo suave e texto):
- Último paciente: **vermelho** (`red-500`), avisa a cidade.
- Rep. no consultório: **azul** (`sky-500`).
- Aguardando médico: **amarelo** (`amber-400`), com contagem de minutos.
- Visitado: **verde** (`emerald-500`).
- Indisponível (não veio, licença, férias, afastado): **cinza**, borda tracejada, no fim da lista.
- Ação destrutiva (excluir): vermelho, só nesse caso. Nunca use vermelho para decorar.

Cor nunca é a única pista: todo status tem texto ou ícone junto.

## Tamanhos e forma
- Botão principal e secundário: altura **52px**, cantos `rounded-[14px]`, texto 16px. Principal violeta cheio; secundário com borda `slate-700`.
- Campos de formulário: altura **52px**, `rounded-xl`, texto **16px** (evita o zoom do iOS), fundo `bg-slate-950`, borda `slate-800`, foco com borda violeta.
- Alvo de toque mínimo **44px** (ícones, chips, abas). Chips de seleção 44px, `rounded-full`.
- Card: `rounded-2xl`, padding 12 a 14px, borda 1px.
- Ícones de traço (stroke 1.8 a 2.2, pontas arredondadas). Em telas novas prefira ícones a emoji.
- Título de tela ou folha: 20px, negrito. Título de seção: 11px, maiúsculas, `tracking-[0.08em]`, `text-slate-400`.
- Nomes de médico em **MAIÚSCULAS**.

## Abas do app (modelo copiloto)
O app tem abas de verdade, trocadas pela barra flutuante de baixo (`components/BottomNav.tsx`, 68px, cantos 26px, vidro fosco): **Hoje**, **Mapa**, botão violeta **+** (Novo médico), **Avisos** (abre a tela de avisos) e **Eu**. A aba ativa fica com fundo `bg-blue-950` e texto violeta. Conteúdo com `pb-32`; toast e "Voltar ao topo" ficam acima da barra.

Título de aba: linha pequena de contexto (12px, `text-slate-400`) e embaixo o título em **26px, extrabold**.

- **Hoje:** contexto "Quinta · 12 nov · 1ª semana" (abre a semana), título = cidade da semana (ou "Rota de hoje" / "Rota de sexta"), botão "?" e o **anel de progresso** (`ProgressRing`, 56px, "4/11"). Embaixo: dias (pontinho no dia de hoje), busca (um botão que abre a aba Médicos) e filtros (48px). Turno e Novos saíram do cabeçalho: turno fica na folha de Filtros, Novos na aba Médicos.
  - **Ao vivo** (`LiveStrip`): uma ficha de 44px por status (ponto colorido, nome, contador, "há N min"). Tocar abre a folha com os médicos; tocar no médico abre a ficha.
  - **Próximo** (`NextDoctorCard`): card grande violeta com o primeiro médico da rota e botões de 52px: Ir (Maps), **Cheguei** (marca Rep. no consultório) e **Visitei**. Depois de "Cheguei": etiqueta "Você está aqui" (azul) e "Visitei" verde cheio. Só na aba de hoje, sem filtro de local. Com ele, "Roteiro padrão" vira **"Depois"** e a lista começa no 2.
- **Mapa** (`RouteMap`): com `NEXT_PUBLIC_MAPTILER_KEY`, mapa vetorial MapLibre + MapTiler (`RouteMapGL`: um dedo arrasta, dois dão zoom, sem girar; o elemento do mapa usa `position:absolute` no `style`, porque o CSS do MapLibre anula a classe e o mapa fica com altura 0). Se o estilo não chegar em 20 s, cai no mapa simples com o motivo. Mapa simples: ruas do OpenStreetMap (escurecidas no tema escuro pela classe `map-tiles`), pinos de 44px de toque: violeta cheio = próximo, contorno violeta = falta (com o número da rota), verde com visto = visitado. Linha pontilhada violeta liga quem falta. Só entra no mapa quem tem coordenada no link de GPS (`lib/coords.ts`), mas o número do pino é o **mesmo da rota de Hoje**. A aba **não rola**: legenda, mapa com a altura que sobra e o card Próximo **compacto** (`compact`: etiqueta e nome em 1 linha, `ESP · local · bairro · cidade` em 1 linha, botões de 48px, sem média nem "Outro status") **logo abaixo** do mapa, sem sobrepor a borda nem os créditos. A linha da rota segue as **ruas** (OSRM público, `router.project-osrm.org`, até 25 paradas, guardada em memória); enquanto não chega ou se falhar, fica a linha reta tracejada. Botões de 44px por cima do mapa (canto de cima à esquerda): **Otimizar rota**, **Voltar à minha ordem** e **"N sem GPS"**, que abre a folha "Sem GPS · fora do mapa" (linhas de 60px, borda tracejada, número da rota, toque abre a ficha). A ordem de Hoje e do mapa vem do **Organizar rota** da semana atual (`ciclo_wN`), e as cidades marcadas para a semana viram o filtro de cidade de Hoje automaticamente.
- **Médicos:** seta de voltar, "Sua base · N médicos", busca de 48px (com foco automático), chips Todos / Falta visitar no ciclo / Novos, e linhas de 64px com iniciais, nome, `ESP · clínica · cidade` e etiqueta (Visitado verde, Novo, ou "1ª sem").
- **Eu** (`MeTab`): foto e nome, cartão com anel de 88px e "% do ciclo", três números (visitas na semana, média por dia, cidades), barras de visitas por dia (hoje em violeta cheio) e atalhos de 60px: Semana e cidades, Status geral, Guia, Perfil e ajustes.

Estados: carregando sem cache = cinco cards em esqueleto; vazio = `EmptyState` com ícone de traço (`busca`, `medico`, `agenda`), nunca emoji. Todo botão afunda de leve ao toque (`scale(0.97)`).

## Fonte e linha do tempo (protótipo "copiloto")
- Títulos de aba, nome do médico no card Próximo, números grandes e o número da rota usam **Sora** (`font-display`); o resto do app segue em Inter.
- Parada simples da rota (sem status, não visitada) é **linha do tempo**: sem caixa, número em círculo de 36px e uma linha fina ligando as paradas. Não há alça de arrastar (a ordem vem da rota do ciclo). Com status, visitado ou indisponível o card continua com borda e cor.
- Card **Próximo**: raio 28px, nome em Sora 22px, pílula de fato (média do horário) e botões de 56px com raio 18px. Médico com **2+ locais**: seção "Onde vai visitar" (no consultório: "Você está em") com um botão de 52px por local (2 lado a lado; 3+ rolam na horizontal). Escolhido = borda violeta de 2px; embaixo "Local da quarta" (local que atende no dia da rota) ou os dias do local. O padrão é o local do **dia em que o rep pôs o médico na rota** (`locationForDay`; sem local nesse dia, Local 1). Endereço, Ir e Cheguei usam o local escolhido; já no consultório, tocar em outro local corrige o status. O botão central da barra de baixo continua sendo o **+** (Novo médico).

## Ficha, Avisos e Organizar rota (protótipo copiloto)
- **Ficha:** Status (principal) e Ligar; com 1 local, painel "Endereço" com botão de rota de 52px; com 2+ locais, as pílulas. Três números em Sora (média de horário, dias, semana do ciclo), WhatsApp médico e clínica em botões de 56px, observações em painel e barra fixa embaixo: **Editar cadastro** e **Ir até lá**.
- **Avisos:** cartão por aviso com ponto colorido de halo, título, "NOME · local. Fulano avisou." e a hora à direita.
- **Organizar rota do ciclo:** semanas, **chips das cidades da semana** (o rep marca onde trabalha; salva em `rep_week_cities`; sem cidade marcada aparecem todas), dias com contagem e a lista de todos os médicos do dia nessas cidades. A ordem muda **arrastando pela alça de seis pontinhos** (44px, à esquerda do número; setas ↑/↓ no teclado). Quem está fora da semana aparece apagado com "Fora da Nª semana · entra ao ordenar" e entra na semana ao ser ordenado. ⇄ (em todos) muda o dia; quem entra em mais de um dia mostra "Também na sexta · toque em ⇄" (violeta) e o ⇄ abre com **"Deixar só na quinta"** (52px, violeta cheio). Semana do ciclo e "Tirar desta semana" só para quem está na semana. Tocar no médico abre a ficha **sem fechar** a organização (ela fica escondida e volta na mesma semana, dia e rolagem).

## Marcar status (bandeira e "Outro status")
Folha em **grade de 2 colunas** (`components/StatusSheet.tsx`): cada status é um bloco de 72px, raio 18px, ponto colorido no canto e o nome embaixo. Rep. no consultório (azul), Aguardando médico (amarelo) e Último paciente (vermelho) têm fundo tingido; Finalizou, Não veio hoje, Licença/Afastado e Férias/Viagem são tracejados e cinza; **Já visitei** é um bloco verde cheio. Marcado = borda de 2px, visto e quem marcou com a hora. Licença e Férias abrem "Volta quando?": Amanhã, próxima segunda, em 15 dias, em 30 dias ou "Escolher data". "Outro status" no card Próximo abre essa mesma folha; tocar no nome do médico abre a ficha.

## Padrões de tela
**Folha que sobe de baixo** (filtros, novo médico, status, semana, cidades, retorno, editar): alça cinza no topo,
cantos de cima `rounded-t-[24px]`, título, conteúdo, rodapé fixo com **Cancelar** (esquerda) e **Salvar** (direita).
Use `components/BottomSheet.tsx` e `PickerSheet.tsx`.

**Tela cheia** (ficha do médico, perfil, notificações, busca): seta de voltar de 44px à esquerda, título à direita da seta.

**Confirmação de ação destrutiva**: janela centralizada com ícone, título, uma frase do que acontece, botão vermelho e Cancelar.
Excluir médico = **"Excluir do meu painel"** (só some do painel do rep; continua na base e nos outros reps).

**Avisos**: faixa no topo para conexão (âmbar: sem internet; azul: enviando; verde: tudo enviado); toast embaixo com
**Desfazer** que some em 5 s.

**Estados**: toda lista tem estado vazio (ícone, frase, uma ação), erro (o que houve + tentar de novo) e carregando (esqueleto cinza).

## O card do médico (lista da rota)
- Linha 1: nome em maiúsculas. Linha 2: `ESP · clínica · cidade`. Se passar de **30 caracteres**, a linha 2 fica
  `ESP · clínica` e uma linha 3 mostra `bairro · cidade`. Helper: `formatPlaceLines` em `utils.ts`.
- Esquerda: alça de arrastar (30×44px) com o **número da posição** e seis pontinhos. A ordem é salva **só para o rep**.
- Direita: horário médio com relógio violeta + "média" embaixo, e o botão de **bandeira** (44px) que abre "Marcar status".
- Status ativo = etiqueta colorida no topo do card ("Último paciente", "Rep. no consultório", "Aguardando médico")
  + hora na linha de baixo. Quem está no consultório aparece como chips com iniciais, nome e hora.
- Visitados ficam numa **linha verde recolhida** ("Visitados hoje" + contador + seta); abre ao tocar.
- Novo médico aparece com a etiqueta **NOVO** (verde) na linha de local.

## Médico com mais de um local (visual pronto; banco em outra etapa)
- Só aparece com 2+ locais (`doc.locais`) ou com `NEXT_PUBLIC_LOCAIS_PREVIEW=1` na edição. Um local só = card igual ao de antes.
- Card aberto: `components/LocationPills.tsx`. Duas pílulas lado a lado (56px, `rounded-[14px]`): a de hoje `border-2 border-blue-600 bg-blue-900 text-blue-200` com "Local de hoje"; a outra com "Quinta · Tarde". Embaixo: endereço do local, "Atende em N locais. Toque no outro para trocar hoje." e GPS 44px.
- Status: a folha mostra "Rep. no consultório · Cajubá"; depois de marcar, faixa "Marcado no Cajubá. Local errado?" (troca em 1 toque).
- Edição: seção "Locais" (`LocationsEditor`: Local 1 principal, Local 2…, lápis 44px, botão tracejado "Adicionar local") e folha `LocationSheet` (campos 52px, GPS, `AgendaEditor`, "Excluir este local" só nos extras).
- Presença e histórico: `PresenceItem.locationName` e `StatusEventRow.location_name` acrescentam " · Clínica Cajubá" ao fim, só com 2+ locais. Helpers em `lib/locations.ts`.

## Ícone do app
Maleta branca com cruz índigo e selo verde de "visita feita" (visto) no canto, sobre degradê índigo (#6366F1 → #3730A3). Sem pino.
Arquivos: `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`, `public/icons/*`. Fonte do desenho: quadro "Ícone" do canvas (E3).

## Textos
- Frases curtas, sem jargão. "Rep." para representante só quando faltar espaço.
- Botão diz a ação: "Salvar", "Renovar ciclo", "Sim, já visitei", "Adicionar ao meu painel".
- Hora no formato 16:52. Cidades do Piauí nos exemplos (Parnaíba, Esperantina, Teresina); UF padrão **PI**; telefone (86).
- Nomes de médicos e clínicas de exemplo são fictícios. Nas dicas do primeiro acesso, use cards de EXEMPLO com etiqueta.

## Regras de produto que o visual deve respeitar
- A **semana do ciclo** é por rep. Ao escolher a semana, a lista mostra só as **cidades marcadas para ela**; o filtro "Semana do ciclo" fica desmarcado até o rep distribuir os médicos pelas semanas (mudança do código, 581bc5b).
- Cidades são salvas **por semana e por rep**.
- Turno por dia: **Manhã, Tarde ou Integral** (sem Noite).
- Marcar "Já visitei" mostra o nome do rep e a hora. Com vários reps: "Arthur 16:50 · Nestor 16:55 +3".
- Pergunta "Já visitou?" bloqueia o app até responder (Sim ou Ainda não).

## Ao terminar
1. `npx tsc --noEmit`: não pode ganhar erro novo (os erros antigos em `app/components/*` e `app/hooks/useDoctors.ts` são código morto).
2. `npm run build` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` de teste deve passar.
3. Confira os dois temas e a largura de 390px (roteiro na skill `mapa-do-app`).
4. Se a mudança alterar o design, descreva o que mudou. Não mexa no banco sem autorização: escreva migrações em `sql/`.
