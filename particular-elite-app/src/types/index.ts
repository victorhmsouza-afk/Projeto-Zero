// Tipos do domínio do atendimento particular.

export type TipoAtendimento = 'CONSULTA' | 'PRONTO_SOCORRO';
export type StatusExame = 'PENDENTE' | 'PAGO' | 'REALIZADO';
export type FormaPagamento = 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'CORTESIA';
export type Perfil = 'ADMIN' | 'CAIXA';

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
  pagamentoConsultaId?: string;
  consultaRealizadaEm: string | null;
  exames: Exame[];
  exemplo?: boolean;
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
