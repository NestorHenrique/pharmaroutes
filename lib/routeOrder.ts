/**
 * Junta a nova ordem dos médicos VISÍVEIS com a ordem salva completa, sem mexer no lugar
 * dos que estão escondidos (fora do filtro, visitados, em atendimento, indisponíveis).
 *
 * Os visíveis ocupam as mesmas "vagas" que já ocupavam na lista salva, só que na ordem nova.
 * Visíveis que ainda não estavam na lista entram no fim.
 *
 * Antes, os escondidos iam todos para o fim; depois de renovar o ciclo (ou tirar um filtro)
 * eles voltavam fora do lugar e parecia que a ordem montada tinha se perdido.
 */
export function mergeVisibleOrder(saved: readonly string[] | undefined, visible: readonly string[]): string[] {
  const visibleSet = new Set(visible);
  const full = [...(saved ?? [])].filter((id, i, arr) => arr.indexOf(id) === i);
  const known = new Set(full);
  for (const id of visible) if (!known.has(id)) full.push(id);

  const queue = [...visible];
  return full.map((id) => (visibleSet.has(id) ? (queue.shift() as string) : id));
}
