// Tipos do domínio do atendimento particular.

export type TipoAtendimento = 'CONSULTA' | 'PRONTO_SOCORRO';
export type StatusExame = 'PENDENTE' | 'PAGO' | 'REALIZADO';
export type FormaPagamento = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'CORTESIA';
export type Perfil = 'ADMIN' | 'AGENDAMENTO';

export interface Paciente {
  id: string;
  nome: string;
  cpf?: string;
  nascimento?: string; // AAAA-MM-DD
  telefone?: string;
  email?: string;
  cadastradoEm?: string;
}

export interface Exame {
  id: string;
  nome: string;
  categoria: string;
  valor: number;
  status: StatusExame;
  pedidoEm: string;
  pagoEm?: string;
  pagamentoId?: string;
  realizadoEm?: string;
}

export interface Atendimento {
  id: string;
  numero: number;
  pacienteId: string;
  pacienteNome: string;
  cpf?: string;
  telefone?: string;
  tipo: TipoAtendimento;
  medicoId: number | null;
  medicoNome: string;
  valorConsulta: number;
  abertoEm: string;
  /** Vazio = consulta ainda não paga ("Aguardando pagamento"). */
  pagamentoConsultaId?: string;
  /** Só é possível cancelar ANTES do pagamento da consulta. */
  cancelamento?: Cancelamento;
  /** Finalizado manualmente pela equipe (pode ser reaberto por até 6 horas). */
  finalizacao?: Finalizacao;
  /** Histórico de reaberturas (para o retorno médico). */
  reaberturas?: { em: string; por: string }[];
  /** Retorno médico no mesmo dia (com os resultados dos exames). Sem cobrança. */
  retornoEm?: string;
  consultaRealizadaEm: string | null;
  exames: Exame[];
  exemplo?: boolean;
}

/** Finalização manual do atendimento. */
export interface Finalizacao {
  em: string;
  por: string;
  observacao?: string;
}

/** Cancelamento de um atendimento que ainda não foi pago. */
export interface Cancelamento {
  motivo: string;
  /** Nome do usuário que cancelou. */
  por: string;
  em: string;
}

export interface Cortesia {
  valor: number;
  autorizadoPor: string;
  cargo: string;
  diretorId: number;
  observacao?: string;
  motivo?: string; // registros antigos
  autorizadoEm: string;
}

export interface Pagamento {
  id: string;
  numeroRecibo: string;
  referente: 'CONSULTA' | 'EXAMES';
  atendimentoId: string;
  atendimentoNumero: number;
  pacienteNome: string;
  cpf?: string;
  medicoNome: string;
  tipoConsulta: TipoAtendimento;
  forma: FormaPagamento;
  valor: number;
  subtotal: number;
  desconto: number;
  itens: { nome: string; valor: number }[];
  parcelas?: number;
  autorizacao?: string;
  idTransacao?: string;
  recebido?: number;
  troco?: number;
  cortesia?: Cortesia;
  dataHora: string;
  exemplo?: boolean;
}

export interface ItemPreco {
  categoria: string;
  nome: string;
  valor: number;
}

export interface TabelaPrecos {
  prontoSocorro: number;
  adicionalContraste: number;
  exames: ItemPreco[];
}

export interface Medico {
  id: number;
  nome: string;
  especialidade: string;
  valorConsulta: number;
}

export interface Diretor {
  id: number;
  nome: string;
  cargo: string;
}

export interface Usuario {
  login: string;
  nome: string;
  perfil: Perfil;
}

/* ------------------------------------------------------------------ */
/* API do Prontuário — Fila do Pronto Socorro                          */
/* GET /prontuario/ps/filaDeAtendimentoProntoSocorroV2/{unidade}/{setor} */
/* ------------------------------------------------------------------ */

/** Resposta da API: { status, message, dados: [...] } */
export interface RespostaApiFilaPS {
  status: boolean;
  message: string;
  dados: RegistroFilaPS[];
}

/**
 * Um paciente na fila do PS, exatamente como a API envia (nomes em MAIÚSCULAS, padrão Tasy).
 * Datas "DT_*" vêm como "dd/mm/aaaa hh:mm:ss" (hora de Manaus); as "*_ORIG" vêm em ISO/UTC.
 */
export interface RegistroFilaPS {
  /** Nº do atendimento (identifica o paciente na fila). */
  NR_ATENDIMENTO: number;
  /** Ordem da classificação de risco (menor = mais grave). */
  NR_SEQ_CLASSIF: number;
  /** Cor da classificação de risco: VERMELHO, LARANJA, AMARELO, VERDE, AZUL. */
  DS_TRIAGEM: string;
  /** Cor que o sistema do hospital usa na tela dele (ex.: "#00BA2F"). */
  DS_HEXA_COR: string;
  DS_CLASSIFICACAO: string | null;
  DS_CURTA_CLASSIFICACAO: string | null;
  DS_MOTIVO_CLASSIFICACAO: string | null;

  DT_ENTRADA: string;
  DT_ENTRADA_ORIG: string;
  DT_INICIO_TRIAGEM: string;
  DT_FIM_TRIAGEM: string;
  DT_FIM_TRIAGEM_ORIG: string | null;
  /** Quando o médico atendeu (null = ainda não foi atendido pelo médico). */
  DT_ATEND_MEDICO: string | null;
  /** Preenchido quando o paciente está pronto para reavaliação médica. */
  DT_PRONTO_REAVALIACAO_DATE: string | null;
  /** Tempos calculados pela API no momento em que ela montou a fila ("hh:mm:ss"). */
  TEMPO_ESPERA_TRIAGEM: string;
  TEMPO_ESPERA_TRIAGEM_ENTRADA: string;

  /** Situação, ex.: "3 - Aguardando Medicação". */
  IE_STATUS_PAC: string;
  /** Sigla da situação, ex.: "AM", "AEI", "AEL", "SP". */
  IE_STATUS_SIGLA: string;
  IE_PRIORIDADE: number;
  IE_SEM_PRIORIDADE: number;
  STATUS_IMAGEM: number;
  STATUS_LAB: number;
  STATUS_MEDICACAO: number;

  /* Dados pessoais — LGPD: não copiar para código, prints ou mensagens. */
  CD_PESSOA_FISICA: string;
  NM_PESSOA_FISICA: string;
  NR_CPF: string;
  NR_TELEFONE_CELULAR: string;
  IE_SEXO: string;
  IDADE: string;
  IDADE_DETALHADA: string;

  DS_QUEIXA_PRINC: string;
  CD_MEDICO_RESP: string;
  NM_PESSOA_FISICA_MEDICO: string;
  CD_MEDICO_RESP_PADRAO: string;
  CD_CONVENIO: number;
  DS_CONVENIO: string;
  CD_SETOR_ATENDIMENTO: number;
  CD_UNIDADE_BASICA: string;
  CD_UNIDADE_COMPL: string;

  FEZ_PRE_TRIAGEM: string;
  QT_PONTUACAO_PRE: number;
  NR_PRIORIDADE_PRE_TRIAGEM: number;
}
