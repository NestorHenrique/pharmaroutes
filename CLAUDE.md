# PharmaRoutes: instruções do projeto

Veja também `AGENTS.md` (regras do Next.js desta versão).

## Trabalho visual: use as skills do projeto SEMPRE
Antes de criar ou alterar tela, componente, card, cor ou texto, siga estas skills (em `.claude/skills/`):

1. **`front-end`**: o padrão visual aprovado (cores do tema, 52px/44px, folhas, card do médico).
2. **`acessibilidade`**: contraste, toque, foco, leitor de tela.
3. **`textos-pt-br`**: tom e vocabulário dos textos.
4. **`teste-mobile`**: conferir em 390px, nos dois temas, antes de entregar.
5. **`entrega-design`**: ao levar o protótipo para o código (blocos pequenos, banco só com autorização).

## Regras gerais
- Responda em português.
- Não altere o banco sozinho: escreva migrações em `sql/` e avise.
- Não crie pull request sem pedirem.
- Se o design mudar, atualize a skill `front-end` na mesma entrega.
