// Regras do atendimento usadas em várias telas.
import type { Atendimento } from '@/types';

/** Concluído = consulta realizada e nenhum exame esperando pagamento. */
export const concluido = (a: Atendimento) => !!a.consultaRealizadaEm && !a.exames.some((x) => x.status === 'PENDENTE');

/** Quando o atendimento foi concluído (último pagamento de exame ou a consulta realizada). */
export const concluidoEm = (a: Atendimento) =>
  [a.consultaRealizadaEm, ...a.exames.map((x) => x.pagoEm)].filter(Boolean).sort().pop() || a.abertoEm;

export type Situacao = { texto: string; variante: 'warning' | 'success' | 'info' };

export function situacao(a: Atendimento): Situacao {
  if (!a.consultaRealizadaEm) return { texto: 'Aguardando consulta', variante: 'warning' };
  const ex = a.exames;
  if (!ex.length) return { texto: 'Consulta realizada', variante: 'success' };
  const pagos = ex.filter((x) => x.status !== 'PENDENTE').length;
  const feitos = ex.filter((x) => x.status === 'REALIZADO').length;
  if (pagos < ex.length) return { texto: `Exames ${pagos}/${ex.length} pagos`, variante: 'warning' };
  if (feitos < ex.length) return { texto: `Exames pagos · ${feitos}/${ex.length} feitos`, variante: 'success' };
  return { texto: 'Exames concluídos', variante: 'info' };
}
