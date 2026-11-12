/**
 * Modo privado do representante (só na tela): para os colegas, ele aparece como "Rep.",
 * sem nome e sem foto. O banco continua gravando o usuário real; só o administrador vê o nome.
 * Guardado fora do React para qualquer componente poder mascarar sem receber props novas.
 */
export const PRIVATE_LABEL = 'Rep.';

interface PrivacyState {
  /** ids dos representantes em modo privado */
  privateIds: ReadonlySet<string>;
  /** nomes (minúsculos) deles, sem o de quem está vendo, para textos que só guardam o nome */
  privateNames: ReadonlySet<string>;
  isAdmin: boolean;
  myId: string | null;
}

let state: PrivacyState = { privateIds: new Set(), privateNames: new Set(), isAdmin: false, myId: null };

export function setPrivacy(next: PrivacyState): void {
  state = next;
}

/** O nome/foto deste usuário deve ser escondido de quem está vendo? */
export function isHidden(userId: string | null | undefined): boolean {
  return Boolean(userId) && state.privateIds.has(userId as string) && !state.isAdmin && userId !== state.myId;
}

/** Nome para exibir: "Rep." quando o dono está em modo privado */
export function maskRep<T extends string | null | undefined>(userId: string | null | undefined, name: T): T | string {
  return isHidden(userId) ? PRIVATE_LABEL : name;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Autor de um cadastro/edição: usa o ID (único) quando existe; só cai para o nome nos registros antigos, sem ID */
export function maskAuthor<T extends string | null | undefined>(authorId: string | null | undefined, name: T): T | string {
  return authorId && UUID.test(authorId) ? maskRep(authorId, name) : maskByName(name);
}

/** Para textos que só têm o nome (ex.: "Cadastrado por ..."): compara com os nomes dos privados */
export function maskByName<T extends string | null | undefined>(name: T): T | string {
  if (!name || state.isAdmin) return name;
  return state.privateNames.has(name.trim().toLowerCase()) ? PRIVATE_LABEL : name;
}
