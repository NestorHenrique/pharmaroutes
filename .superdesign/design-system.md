# PharmaRoutes — Design system (modelo "Copiloto")

Fonte da verdade visual: `.superdesign/prototipo-copiloto.html` (protótipo aprovado). Toda tela nova segue exatamente as classes, tamanhos e cores desse protótipo.

## Produto
App de celular (PWA, 390px) para propagandistas farmacêuticos (reps) em campo no Piauí. O app é o copiloto da rota: diz qual é o próximo médico, mostra o que os colegas avisaram ao vivo e registra a visita em um toque. É usado com pressa, com uma mão, muitas vezes sob o sol. Cada tela precisa ser lida em 2 segundos.

Idioma de toda a interface: **português do Brasil**, frases curtas, sem jargão. Botão diz a ação ("Salvar", "Cheguei", "Visitei", "Adicionar ao meu painel"). Hora 16:52. Exemplos com cidades do Piauí (Parnaíba, Esperantina, Piripiri, Luís Correia), UF PI, telefone (86). Nomes de médico em MAIÚSCULAS. Nomes fictícios.

## Arquitetura
- Abas (barra flutuante embaixo): **Hoje**, **Mapa**, botão central violeta (bandeira = marcar status), **Avisos**, **Eu**.
- Telas cheias com seta de voltar (44px) e rodapé de ações: Ficha do médico, Editar/Novo médico, Assistente da rota (IA), Organizar rota do ciclo, Médicos (base), Perfil e ajustes, Status geral, Guia de status, Histórico.
- Folhas que sobem de baixo: Marcar status, Volta quando?, Lista ao vivo, Editar local, Mover médico, Novo médico (CRM), Filtros, Semana e cidades.
- Portões: Login, Termos, Confirmar nome, Montar semana, "Já visitou?".

## Temas (dois, mesmas regras)
| Token | Ônix (escuro, padrão) | Marfim (claro) |
|---|---|---|
| --bg (página) | #0B0B12 | #F7F6FB |
| --card | #14141D | #FFFFFF |
| --sub (preenchimento sutil) | #1E1E2B | #EEECF6 |
| --line (borda) | #2A2A3A | #D9D5E8 |
| --fg (texto) | #F4F2EE | #17171A |
| --mut (texto secundário) | #A8A49B | #55526B |
| --dim (texto apagado) | #8E8A82 | #6B6880 |
| --acc (violeta) | #A78BFA | #5B3FD0 |
| --on-acc (texto sobre violeta) | #0B0B12 | #FFFFFF |
| --acc-soft | #1B1638 | #F3F0FE |
| --acc-line | #4C3F8F | #C9BCF5 |
| --acc-fg (texto violeta) | #C4B5FD | #4A31C0 |
| --red (Último paciente) | #F87171 | #C92A2A |
| --amber (Aguardando médico) | #FBBF24 | #A8590A |
| --sky (Rep. no consultório) | #38BDF8 | #0B6FA8 |
| --green (Visitado) | #34D399 | #0B7A55 |
| --on-status | #0B0B12 | #FFFFFF |

Desenhe em **Ônix** por padrão. Nenhuma outra cor. Vermelho só para status "Último paciente" e ação destrutiva. Cor nunca é a única pista: todo status tem texto ou ícone. Indisponível (não veio, licença, férias) = cinza com borda tracejada.

## Tipografia
- Títulos e números: **Sora** 700/800, letter-spacing -0.03em. Corpo: **Inter** 400–700, letter-spacing -0.01em.
- Título de aba 26px/800 com linha de contexto de 12px acima. Título de tela cheia e de folha 20px/800.
- Eyebrow de seção: 11px, 700, MAIÚSCULAS, tracking .08em, cor --mut.
- Corpo 14–15px; meta 12–13px; números com tabular-nums.

## Forma e tamanhos
- Tela: padding 18px 16px, gap 14px entre blocos, 110px livres embaixo para a barra.
- Botão (`.btn`): 56px de altura na tela, 52px no rodapé, raio 16–18px, 15px/700. `pri` = violeta cheio; `ghost` = --sub com borda --line; `ok` = verde cheio.
- Campo (`.fld`): min 56px, raio 14px, fundo --bg, borda 1px --line, rótulo 11px em cima e valor 16px.
- Chip de filtro (`.f`): 44px, pílula, borda --line; ligado = fundo --acc-soft, borda --acc, texto --acc-fg.
- Ficha ao vivo (`.chip`): 44px, pílula, fundo 14% da cor do status, ponto colorido, nome, contador em pílula cheia, "4 min".
- Card (`.panel`): raio 24px, fundo --card, borda interna 1px --line, padding 16px. Sem sombra.
- Card "Próximo" (`.hero`): raio 28px, degradê 160° de violeta 22% para --card, borda --acc-line, pílula "PRÓXIMO", nome 22px/800 maiúsculo, fatos em pastilhas, ações em grade 56px | 1fr | 1fr (Ir, Cheguei, Visitei).
- Linha do tempo "Depois" (`.stop`): número em círculo de 36px ligado por linha vertical, nome, `ESP · clínica`, hora média à direita.
- Barra de baixo (`.nav`): flutuante, 68px, raio 26px, vidro fosco, 5 colunas; aba ativa com fundo --acc-soft e texto --acc-fg; botão central 56px violeta.
- Folha (`.sheet`): cantos de cima 28px, alça 40×5px, título 20px, véu preto 55%.
- Toast: 52px, raio 16px, fundo --fg com texto --bg, "Desfazer" sublinhado, acima da barra.
- Alvo de toque mínimo 44px. Ícones de traço (stroke 2, pontas redondas, 24px de grade). Nunca emoji.
- Sombra só em elementos flutuantes (barra, card do mapa): 0 12px 30px rgb(0 0 0 / .25).

## Movimento
Folha sobe em .26s; véu aparece em .18s; botão afunda (scale .96) ao toque; anel de progresso anima. Respeitar prefers-reduced-motion.

## Regras de produto que o visual respeita
- A semana do ciclo é por rep; a semana escolhida filtra os médicos; cidades filtram só os avisos.
- Turnos: Manhã, Tarde ou Integral.
- Licença e Férias perguntam a data de volta e tiram o médico da rota.
- Excluir médico = "Excluir do meu painel" (continua na base).
- O assistente sempre pede confirmação antes de mudar algo.
