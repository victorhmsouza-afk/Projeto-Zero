import { Link } from 'react-router-dom';
import { ArrowRight, Siren, WifiOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgora, useFilaPS } from '@/hooks/use-fila-ps';
import { contarPorRisco, duracao, montarPaciente } from '@/services/prontuario';

/** Cartão do Dashboard: total na fila do PS agora (API do prontuário), por classificação de risco. */
export function CartaoFilaPS() {
  const q = useFilaPS();
  const agora = useAgora();
  const registros = q.data?.registros ?? [];
  const esperando = registros.map((r) => montarPaciente(r, agora)).filter((p) => !p.atendido);
  const atrasados = esperando.filter((p) => p.atrasado).length;
  const maior = Math.max(0, ...esperando.map((p) => p.esperaMin ?? 0));
  const porRisco = contarPorRisco(registros).filter((x) => x.total > 0);

  return (
    <Card className="mt-6">
      <Link to="/fila-ps" className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5 transition-colors hover:bg-muted/60">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Siren className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-[160px]">
          <p className="text-sm font-medium text-muted-foreground">Fila do Pronto Socorro agora</p>
          {q.isLoading ? <Skeleton className="mt-1 h-8 w-24" /> : q.isError ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><WifiOff className="h-4 w-4" /> Disponível só na rede do hospital</p>
          ) : (
            <p className="tabular mt-1 text-2xl font-bold">{registros.length} <span className="text-sm font-normal text-muted-foreground">pacientes</span></p>
          )}
        </div>
        {!q.isLoading && !q.isError && (
          <>
            <div className="text-sm">
              <p className="text-muted-foreground">Aguardando médico</p>
              <p className="tabular font-semibold">
                {esperando.length}
                {esperando.length > 0 && <span className="font-normal text-muted-foreground"> · maior espera {duracao(maior)}</span>}
                {atrasados > 0 && <span className="font-normal text-destructive"> · {atrasados} acima do tempo-alvo</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {porRisco.map(({ risco, total }) => (
                <span key={risco.cor} className="tabular inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: risco.fundo, color: risco.texto }} title={risco.descricao}>
                  {risco.nome} {total}
                </span>
              ))}
            </div>
          </>
        )}
        <span className="ml-auto flex items-center gap-1 text-sm font-medium text-primary">Ver fila <ArrowRight className="h-4 w-4" /></span>
      </Link>
    </Card>
  );
}
