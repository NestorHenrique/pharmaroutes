---
name: entrega-design
description: Roteiro para levar o design do canvas (protótipo) para o código do PharmaRoutes em blocos pequenos e seguros. Use ao implementar telas novas, passar o protótipo para o código, ou montar prompts de implementação.
---

# Do canvas para o código

## Princípios
1. **Camadas:** primeiro só visual (cores, tamanhos, textos), depois estrutura de tela, depois lógica e banco. Nunca tudo junto.
2. **Blocos pequenos:** um bloco por vez, um commit por item, parar e mostrar ao fim de cada bloco.
3. **Reaproveitar o que existe** (`BottomSheet`, `PickerSheet`, `StatusSelector`, `weekPrompt`, fila offline). Leia antes de criar.
4. **Banco:** não altere sozinho. Escreva a migração em `sql/` e avise a pessoa para rodar. Diga quais tabelas ou colunas mudam.
5. **Sem pull request** a menos que peçam. Trabalhe na branch indicada.

## Ordem sugerida
1. Tema e cores (variáveis em `app/globals.css`).
2. Card e lista (`components/DoctorCard.tsx`, `app/page.tsx`).
3. Folhas e telas novas só de layout.
4. Fluxos com lógica (semana, cidades, perguntas, notificações, perfil, senha).
5. Estados (vazio, erro, carregando, offline) e avisos.

## Para cada item
- **Ler:** a tela no protótipo e a skill `front-end`; os arquivos atuais.
- **Fazer:** a menor mudança que entrega o item. Sem refatorar o que não pediram.
- **Conferir:** skills `acessibilidade`, `textos-pt-br` e `teste-mobile`; tipos e build.
- **Registrar:** commit com mensagem em português descrevendo o resultado. Terminar com as linhas de atribuição que o ambiente indicar.

## Relatório de cada bloco (curto)
- O que mudou (em frases simples).
- O que foi testado e **como**; o que **não** deu para testar.
- Migrações SQL que a pessoa precisa rodar (arquivo e o que faz).
- Decisões que ficaram em aberto.

## Montar prompt para outra sessão
Sessão nova começa sem contexto. O prompt deve ter: repositório e branch; "leia `AGENTS.md` e as skills do projeto";
o que já foi feito (não refazer); regras (banco, PR, verificação); tarefas numeradas com a regra de produto de cada uma;
decisões em aberto; link do protótipo (aviso de que é privado).

## Manter a documentação viva
Se o design mudar, atualize a skill `front-end` na mesma entrega. Skill desatualizada é pior que skill nenhuma.
