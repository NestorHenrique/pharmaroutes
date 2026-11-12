---
name: textos-pt-br
description: Tom e vocabulário dos textos do app PharmaRoutes em português do Brasil. Use ao escrever ou revisar qualquer texto de tela, botão, aviso, erro, estado vazio, notificação ou confirmação.
---

# Textos do app (pt-BR)

Quem lê está em campo, com pressa. Frase curta, palavra simples, uma ideia por linha.

## Regras
1. Diga o que acontece, não o que o sistema faz. "Ele some só do seu painel", não "Registro desvinculado".
2. Botão = ação no infinitivo ou imperativo curto: **Salvar, Cancelar, Continuar, Renovar ciclo, Adicionar ao meu painel**.
   Resposta a pergunta: "Sim, já visitei" / "Ainda não".
3. Título de tela ou folha: substantivo curto ("Filtros", "Marcar status", "Novo médico"). Pergunta só quando o rep responde ("Em qual semana você está?").
4. Sem jargão técnico, sem inglês, sem gíria, sem emoji decorativo, sem pontos de exclamação em erro.
5. "Você" para o rep; nome dos colegas no formato **Nestor** ou **Nestor H.**
6. Números e horas: **16:52**, "há 6 min", "18 min", "4 de 14". Datas: **12 nov**, **20/11**.
7. Cidades e médicos de exemplo: Piauí (Parnaíba, Esperantina, Teresina). Telefone (86). UF **PI**. Médicos e clínicas fictícios.

## Vocabulário fixo
| Use | Evite |
|---|---|
| Rep. (curto) / representante | propagandista só na marca; vendedor |
| Painel / "meu painel" | dashboard, carteira |
| Roteiro padrão, Rota de hoje | rota padrão, pipeline |
| Visitado, "Já visitei" | check-in, concluído |
| Status, bandeira | flag |
| Último paciente, Rep. no consultório, Aguardando médico | termos diferentes para o mesmo status |
| Ciclo, 1ª semana … 5ª semana | sprint, rodada |
| Horário médio ("média") | tempo estimado |
| Excluir do meu painel | deletar médico |
| Avisos | push, notificações push |

## Modelos
- **Erro de salvar:** "Não foi possível salvar. Tente novamente."
- **Sem internet:** "Sem internet. Suas marcações ficam guardadas e vão sozinhas quando voltar."
- **Estado vazio:** título (o que não há) + uma frase (por quê) + **uma** ação. Ex.: "Nenhum médico nesta quinta" / "Não há ninguém marcado para a 1ª semana neste dia." / [Trocar de semana].
- **Confirmar ação perigosa:** título com o nome ("Excluir DR. X do seu painel?") + consequência real + botão com a ação por extenso ("Sim, excluir do meu painel").
- **Notificação:** "Já visitou o Dr. Rafael Moura?" + contexto ("Você marcou Rep. no consultório às 16:25.").
- **Confirmação rápida (toast):** o que foi feito + **Desfazer**. "Ordem salva · só no seu painel".

- **Status no card:** "Último paciente" (avisa a cidade), "Rep. no consultório", "Aguardando médico · 12 min", "Visitado". Quem marcou: "Arthur 16:50"; modo privado: "Rep 16:50" (só a hora se for hoje).

## Antes de entregar
- Leia em voz alta: se tropeçar, encurte.
- Mesma coisa com o mesmo nome em todas as telas (use a tabela).
- Texto não cortado em 390px nem quebrado em palavras soltas.
