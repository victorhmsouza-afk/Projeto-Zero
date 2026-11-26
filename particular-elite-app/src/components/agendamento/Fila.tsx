import { Plus, Search, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { horaBR } from '@/lib/format';
import { TIPOS } from '@/services/config';
import { concluido, concluidoEm, situacao } from '@/services/regras';
import type { Atendimento } from '@/types';

interface Props {
  atendimentos: Atendimento[] | undefined;
  dia: string;
  setDia: (d: string) => void;
  busca: string;
  setBusca: (b: string) => void;
  selecionadoId: string | null;
  aoAbrir: (id: string) => void;
  aoNovo: () => void;
}

/**
 * Fila do dia — SEM valores em dinheiro.
 * Mostra os atendimentos em andamento e só o ÚLTIMO concluído; os demais aparecem pela busca.
 */
export function Fila({ atendimentos, dia, setDia, busca, setBusca, selecionadoId, aoAbrir, aoNovo }: Props) {
  const todos = [...(atendimentos || [])].sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
  const t = busca.trim().toLowerCase();
  let andamento: Atendimento[] = [], ultimo: Atendimento | undefined, achados: Atendimento[] = [];
  if (t) achados = todos.filter((a) => a.pacienteNome.toLowerCase().includes(t) || String(a.numero).includes(t));
  else {
    andamento = todos.filter((a) => !concluido(a));
    ultimo = todos.filter(concluido).sort((a, b) => concluidoEm(b).localeCompare(concluidoEm(a)))[0];
    const aberto = todos.find((a) => a.id === selecionadoId);
    if (aberto && concluido(aberto) && aberto.id !== ultimo?.id) andamento = [...andamento, aberto];
  }

  const item = (a: Atendimento) => {
    const s = situacao(a);
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => aoAbrir(a.id)}
          className={cn(
            'grid w-full grid-cols-[1fr_auto] gap-x-2 gap-y-1 border-l-4 border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/60',
            a.id === selecionadoId && 'border-primary bg-muted',
          )}
        >
          <span className="truncate font-semibold">{a.pacienteNome}</span>
          <span className="tabular text-xs text-muted-foreground">{horaBR(a.abertoEm)}</span>
          <span className="col-span-2 text-xs text-muted-foreground">{TIPOS[a.tipo].nome} · nº {a.numero}</span>
          <span className="col-span-2"><Badge variant={s.variante}>{s.texto}</Badge></span>
        </button>
      </li>
    );
  };
  const titulo = (txt: string) => <li className="bg-muted/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">{txt}</li>;
  const nAndamento = todos.filter((a) => !concluido(a)).length;

  return (
    <Card className="flex flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7.5rem)]">
      <div className="grid gap-3 p-4">
        <Button onClick={aoNovo} size="lg" className="w-full"><Plus /> Novo atendimento</Button>
        <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar paciente (nome ou nº)" className="pl-9" type="search" />
        </div>
      </div>
      <div className="grid grid-cols-2 border-y text-center">
        <div className="p-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Atendimentos</p>
          <p className="tabular text-lg font-bold">{todos.length}</p>
        </div>
        <div className="border-l p-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Em andamento</p>
          <p className="tabular text-lg font-bold">{nAndamento}</p>
        </div>
      </div>
      <ul className="flex-1 divide-y overflow-y-auto">
        {!atendimentos && [0, 1, 2].map((i) => <li key={i} className="p-4"><Skeleton className="h-12" /></li>)}
        {t ? achados.map(item) : (
          <>
            {andamento.length > 0 && titulo('Em andamento')}
            {andamento.map(item)}
            {ultimo && titulo('Último atendido')}
            {ultimo && item(ultimo)}
          </>
        )}
      </ul>
      {atendimentos && (t ? !achados.length : !andamento.length && !ultimo) && (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <Users className="h-6 w-6" />
          {t ? 'Nenhum paciente encontrado.' : 'Nenhum atendimento neste dia.'}
        </div>
      )}
    </Card>
  );
}
