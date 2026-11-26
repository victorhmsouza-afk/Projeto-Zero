// Regras do atendimento usadas em várias telas.
import type { Atendimento } from '@/types';
import { dataLocal } from '@/lib/format';

/** Por quantas horas um atendimento finalizado ainda pode ser reaberto (retorno médico no mesmo dia). */
export const HORAS_PARA_REABRIR = 6;

/** A consulta já foi paga? (antes disso o atendimento fica "Aguardando pagamento" e pode ser cancelado) */
export const pago = (a: Atendimento) => !!a.pagamentoConsultaId;

/** Cancelado antes do pagamento. */
export const cancelado = (a: Atendimento) => !!a.cancelamento;

/** Finalizado manualmente pela equipe. */
export const finalizado = (a: Atendimento) => !!a.finalizacao;

/** Pode cancelar? Só se ainda não pagou nada. */
export const podeCancelar = (a: Atendimento) => !pago(a) && !cancelado(a);

/** Pode finalizar? Consulta paga, e ainda não cancelado nem finalizado. */
export const podeFinalizar = (a: Atendimento) => pago(a) && !cancelado(a) && !finalizado(a);

/** Até quando o atendimento finalizado pode ser reaberto. */
export const limiteReabrir = (a: Atendimento) =>
  a.finalizacao ? new Date(new Date(a.finalizacao.em).getTime() + HORAS_PARA_REABRIR * 3600_000) : null;

/** Pode reabrir? Só nas 6 horas seguintes à finalização. */
export const podeReabrir = (a: Atendimento, agora = new Date()) => {
  const limite = limiteReabrir(a);
  return !!limite && agora < limite;
};

/**
 * Concluído (sai de "Em andamento") quando:
 * - foi cancelado, ou
 * - foi finalizado pela equipe, ou
 * - é de um dia anterior (o retorno médico só acontece no mesmo dia).
 */
export const concluido = (a: Atendimento) =>
  cancelado(a) || finalizado(a) || a.abertoEm.slice(0, 10) < dataLocal();

/** Quando o atendimento foi concluído. */
export const concluidoEm = (a: Atendimento) =>
  a.cancelamento?.em || a.finalizacao?.em
  || [a.consultaRealizadaEm, a.retornoEm, ...a.exames.map((x) => x.pagoEm)].filter(Boolean).sort().pop() || a.abertoEm;

export type Situacao = { texto: string; variante: 'warning' | 'success' | 'info' | 'destructive' };

export function situacao(a: Atendimento): Situacao {
  if (cancelado(a)) return { texto: 'Cancelado', variante: 'destructive' };
  if (finalizado(a)) return { texto: 'Finalizado', variante: 'info' };
  if (!pago(a)) return { texto: 'Aguardando pagamento', variante: 'warning' };
  if (!a.consultaRealizadaEm) return { texto: 'Aguardando consulta', variante: 'warning' };
  if (a.retornoEm) return { texto: 'Retorno médico feito', variante: 'success' };
  const ex = a.exames;
  if (!ex.length) return { texto: 'Consulta realizada', variante: 'success' };
  const pagos = ex.filter((x) => x.status !== 'PENDENTE').length;
  const feitos = ex.filter((x) => x.status === 'REALIZADO').length;
  if (pagos < ex.length) return { texto: `Exames ${pagos}/${ex.length} pagos`, variante: 'warning' };
  if (feitos < ex.length) return { texto: `Exames pagos · ${feitos}/${ex.length} feitos`, variante: 'success' };
  return { texto: 'Exames feitos · aguardando retorno', variante: 'info' };
}
