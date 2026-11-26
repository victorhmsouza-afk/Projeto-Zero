// Leitura dos dados com TanStack Query. Depois de gravar algo, chame `atualizar()`.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banco } from '@/services/banco';

export function useAtendimentos(inicio: string, fim: string) {
  return useQuery({ queryKey: ['atendimentos', inicio, fim], queryFn: () => Banco.listarAtendimentos({ inicio, fim }) });
}

export function usePagamentos(inicio: string, fim: string) {
  return useQuery({ queryKey: ['pagamentos', inicio, fim], queryFn: () => Banco.listarPagamentos({ inicio, fim }) });
}

export function usePagamentosDoAtendimento(atendimentoId?: string) {
  return useQuery({
    queryKey: ['pagamentos', 'atendimento', atendimentoId],
    queryFn: () => Banco.listarPagamentos({ atendimentoId }),
    enabled: !!atendimentoId,
  });
}

export function usePrecos() {
  return useQuery({ queryKey: ['precos'], queryFn: () => Banco.lerPrecos() });
}

export function useTemExemplos() {
  return useQuery({ queryKey: ['exemplos'], queryFn: () => Banco.temExemplos() });
}

/** Recarrega tudo depois de uma gravação (e atualiza o "atualizado às" do topo). */
export function useAtualizar() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
