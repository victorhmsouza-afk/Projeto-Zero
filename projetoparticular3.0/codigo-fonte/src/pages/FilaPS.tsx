import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Braces, Clock, Hospital, Loader2, RefreshCw, Search, Siren, Users, WifiOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { buscarFilaPS, urlFilaPS, type Registro } from '@/services/prontuario';

const UNIDADE_PADRAO = '49';
const SETOR_PADRAO = 'Pronto Socorro';

/** "nomePaciente" / "NM_PACIENTE" → "Nome Paciente" */
function rotulo(chave: string) {
  return chave
    .replace(/_/g, ' ')
    .replace(/([a-zà-ú0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;
function mostrar(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR'); // códigos sem ponto de milhar
  if (typeof v === 'string') {
    if (ISO.test(v)) {
      const d = new Date(v.length === 10 ? `${v}T00:00` : v.replace(' ', 'T'));
      if (!Number.isNaN(+d)) return v.length === 10 ? d.toLocaleDateString('pt-BR') : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return v;
  }
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

/** FILA DO PRONTO SOCORRO — dados ao vivo da API do prontuário (GET). */
export default function FilaPS() {
  const [unidade, setUnidade] = useState(UNIDADE_PADRAO);
  const [setor, setSetor] = useState(SETOR_PADRAO);
  const [filtro, setFiltro] = useState('');
  const [automatico, setAutomatico] = useState(true);
  const [verJson, setVerJson] = useState(false);
  const [params, setParams] = useState({ unidade: UNIDADE_PADRAO, setor: SETOR_PADRAO });

  const q = useQuery({
    queryKey: ['fila-ps', params.unidade, params.setor],
    queryFn: ({ signal }) => buscarFilaPS(params.unidade, params.setor, signal),
    refetchInterval: automatico ? 60_000 : false,
    retry: 1,
    staleTime: 20_000,
  });

  const registros = q.data?.registros ?? [];
  const colunas = useMemo(() => {
    const vistas: string[] = [];
    registros.slice(0, 100).forEach((r) => Object.keys(r).forEach((k) => { if (!vistas.includes(k)) vistas.push(k); }));
    return vistas;
  }, [registros]);

  // Se a API trouxer um campo de classificação/risco, mostra a contagem por valor.
  const campoClassif = colunas.find((k) => /classifica|risco|prioridade|cor/i.test(k) && registros.some((r) => typeof r[k] === 'string'));
  const porClassif = useMemo(() => {
    if (!campoClassif) return [];
    const m = new Map<string, number>();
    registros.forEach((r) => { const v = String(r[campoClassif] ?? 'Sem classificação'); m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [registros, campoClassif]);

  const t = filtro.trim().toLowerCase();
  const visiveis = t ? registros.filter((r) => Object.values(r).some((v) => mostrar(v).toLowerCase().includes(t))) : registros;

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ unidade: unidade.trim() || UNIDADE_PADRAO, setor: setor.trim() || SETOR_PADRAO });
  };
  const hora = (d?: Date) => (d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

  return (
    <>
      <PageHeader
        titulo="Fila do Pronto Socorro"
        subtitulo="Dados ao vivo da API do prontuário (consulta GET). Nada é gravado neste sistema."
        acoes={
          <Button onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Atualizar agora
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={aplicar} className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fps-unidade">Unidade</Label>
              <Input id="fps-unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} className="w-28" inputMode="numeric" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fps-setor">Setor</Label>
              <Input id="fps-setor" value={setor} onChange={(e) => setSetor(e.target.value)} className="w-56" />
            </div>
            <Button type="submit" variant="outline"><Search /> Consultar</Button>
            <label className="flex h-10 items-center gap-2 text-sm">
              <Checkbox checked={automatico} onCheckedChange={(v) => setAutomatico(!!v)} /> Atualizar sozinho a cada 1 minuto
            </label>
          </form>
          <p className="mt-3 break-all text-xs text-muted-foreground">
            <span className="font-medium text-primary">GET</span> {urlFilaPS(params.unidade, params.setor)}
          </p>
        </CardContent>
      </Card>

      {q.isError && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="flex gap-4 p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><WifiOff className="h-5 w-5" /></span>
            <div className="grid gap-2 text-sm">
              <p className="font-semibold text-destructive">Não foi possível carregar a fila</p>
              <p>{(q.error as Error).message}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Abra o sistema num computador da rede do hospital (ou conectado à VPN).</li>
                <li>Se o erro continuar, a equipe de TI precisa liberar o acesso (CORS) da API para o endereço onde o sistema é aberto.</li>
                <li>Confira a unidade e o setor acima e clique em <strong>Consultar</strong>.</li>
              </ul>
              <div><Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw /> Tentar de novo</Button></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {q.isLoading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />) : (
          <>
            <StatCard titulo="Pacientes na fila" valor={q.isError ? '—' : registros.length} detalhe={`${params.setor} · unidade ${params.unidade}`} icone={Users} destaque />
            <StatCard titulo="Atualizado às" valor={hora(q.data?.recebidoEm)} detalhe={automatico ? 'atualiza sozinho a cada 1 minuto' : 'atualização manual'} icone={Clock} cor="azul" />
            <StatCard titulo="Campos recebidos" valor={colunas.length} detalhe="colunas montadas a partir da API" icone={Braces} cor="cinza" />
            <StatCard titulo="Encontrados" valor={visiveis.length} detalhe={t ? `filtro: "${filtro}"` : 'sem filtro'} icone={Search} cor="laranja" />
          </>
        )}
      </div>

      {porClassif.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary"><Siren className="h-5 w-5" /> Por {rotulo(campoClassif!).toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {porClassif.map(([v, n]) => (
              <button key={v} type="button" onClick={() => setFiltro(v)} className="transition-opacity hover:opacity-80">
                <Badge variant="outline" className="px-3 py-1 text-sm">{v} <span className="ml-1 font-bold">{n}</span></Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary"><Hospital className="h-5 w-5" /> Pacientes</CardTitle>
            <CardDescription className="mt-1">Na ordem em que a API enviou.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar em qualquer coluna" className="pl-9" type="search" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="grid gap-2 p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : !registros.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              {q.isError ? <AlertTriangle className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              {q.isError ? 'Sem dados: a API não respondeu.' : 'Nenhum paciente na fila agora.'}
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {colunas.map((c) => <TableHead key={c} className="whitespace-nowrap">{rotulo(c)}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.slice(0, 500).map((r: Registro, i) => (
                    <TableRow key={i}>
                      <TableCell className="tabular text-muted-foreground">{i + 1}</TableCell>
                      {colunas.map((c) => <TableCell key={c} className="whitespace-nowrap">{mostrar(r[c])}</TableCell>)}
                    </TableRow>
                  ))}
                  {!visiveis.length && <TableRow><TableCell colSpan={colunas.length + 1} className="py-8 text-center text-muted-foreground">Nenhum resultado para o filtro.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {q.data && (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary"><Braces className="h-5 w-5" /> Resposta da API</CardTitle>
              <CardDescription className="mt-1">O JSON exatamente como chegou (útil para conferir os campos).</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setVerJson((v) => !v)}>{verJson ? 'Esconder' : 'Mostrar'}</Button>
          </CardHeader>
          {verJson && (
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(q.data.bruto, null, 2)}</pre>
            </CardContent>
          )}
        </Card>
      )}
    </>
  );
}
