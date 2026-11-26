import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarFilaPS, SETOR_PS, UNIDADE_PS } from '@/services/prontuario';

/** Fila do PS (API do prontuário). Atualiza sozinha a cada 1 minuto. Tela e Dashboard compartilham o mesmo cache. */
export function useFilaPS(unidade = UNIDADE_PS, setor = SETOR_PS, automatico = true) {
  return useQuery({
    queryKey: ['fila-ps', unidade, setor],
    queryFn: ({ signal }) => buscarFilaPS(unidade, setor, signal),
    refetchInterval: automatico ? 60_000 : false,
    retry: 1,
    staleTime: 20_000,
  });
}

/** Relógio que muda a cada `ms` — para os tempos de espera andarem sem chamar a API de novo. */
export function useAgora(ms = 30_000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return agora;
}
