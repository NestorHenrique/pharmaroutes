/** Versão dos termos: ao mudar o texto, troque a data e todos aceitam de novo */
export const TERMS_VERSION = '2026-11-12';

export interface TermsSection {
  title: string;
  body: string[];
}

/**
 * Termos de uso e aviso de privacidade (LGPD, Lei 13.709/2018) em linguagem simples.
 * Texto-modelo: vale uma revisão jurídica da empresa antes de uso em larga escala.
 */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Para que serve o app',
    body: ['O PharmaRoutes organiza a rota de visitas dos representantes e mostra, em tempo real, quem está em cada consultório.'],
  },
  {
    title: 'Quais dados usamos',
    body: [
      'Seus: nome, e-mail, foto (se você colocar), semana e cidades de trabalho, horários de visita e os status que você marca.',
      'Localização: só quando você toca em GPS para registrar o endereço de um médico. Não acompanhamos você pelo mapa.',
      'Dos médicos: dados profissionais (nome, CRM, especialidade, telefones, endereço e agenda de atendimento).',
    ],
  },
  {
    title: 'Para que usamos',
    body: [
      'Montar a rota, evitar visitas repetidas, avisar os colegas da cidade e manter o histórico de visitas e de alterações.',
      'Não usamos seus dados para propaganda e não vendemos dados.',
    ],
  },
  {
    title: 'Quem vê',
    body: [
      'Os representantes autorizados da equipe veem seu nome, foto, visitas e status. Os dados dos médicos são os mesmos para toda a equipe.',
      'Usamos provedores de infraestrutura (hospedagem e banco de dados) que guardam os dados por nós, com acesso protegido por login.',
    ],
  },
  {
    title: 'Seus direitos',
    body: [
      'Pela LGPD você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização ou exclusão, e informação sobre com quem compartilhamos.',
      'Você corrige o nome e a foto em Perfil > Editar perfil. Para os outros pedidos, fale com o administrador do app.',
    ],
  },
  {
    title: 'Seu compromisso',
    body: [
      'Use os dados dos médicos só para a visita profissional. Não repasse telefones e endereços a terceiros, nem tire prints para fora da equipe.',
      'Não compartilhe sua senha. Se perder o aparelho, troque a senha em Perfil.',
    ],
  },
];
