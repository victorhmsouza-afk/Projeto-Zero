import type { FormaPagamento, Paciente, TipoAtendimento } from '@/types';

/** Rascunho do "Novo atendimento" (antes do pagamento da consulta). */
export interface Rascunho {
  paciente: Paciente | null;
  modoPaciente: 'buscar' | 'novo';
  novo: { nome: string; cpf: string; nascimento: string; telefone: string; email: string };
  tipo: TipoAtendimento;
  medicoId: string;
  valor: number;
}

export const rascunhoVazio = (): Rascunho => ({
  paciente: null,
  modoPaciente: 'buscar',
  novo: { nome: '', cpf: '', nascimento: '', telefone: '', email: '' },
  tipo: 'CONSULTA',
  medicoId: '',
  valor: 0,
});

export interface ItemPagar { id?: string; nome: string; valor: number }

/** O que o painel de pagamento devolve ao clicar em Finalizar. */
export interface DadosPagamento {
  forma: FormaPagamento;
  subtotal: number;
  desconto: number;
  valor: number;
  parcelas?: number;
  autorizacao?: string;
  idTransacao?: string;
  recebido?: number;
  troco?: number;
  cortesia?: { diretorId: string; senha: string; observacao: string };
}
