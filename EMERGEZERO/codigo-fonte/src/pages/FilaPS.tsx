import { useMemo, useState } from 'react';
import { AlertTriangle, Braces, Clock, Hospital, Hourglass, Loader2, RefreshCw, RotateCcw, Search, Siren, Stethoscope, Users, WifiOff, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { useAuth } from '@/hooks/use-auth';
import { useAgora, useFilaPS } from '@/hooks/use-fila-ps';
import { cn } from '@/lib/utils';
import {
  contarPorRisco, duracao, horaCurta, montarPaciente, SETOR_PS, UNIDADE_PS, urlFilaPS,
  type CorRisco, type PacienteFila, type Risco,
} from '@/services/prontuario';

/** Selo colorido da classificação de risco (Manchester). */
export function SeloRisco({ risco, className }: { risco: Risco; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}
      style={{ backgroundColor: risco.fundo, color: risco.texto }}
      title={risco.descricao}
    >
      {risco.nome}
    </span>
  );
}

/** Cor do selo de situação pela sigla que a API envia. */
function varianteSituacao(sigla: string): BadgeProps['variant'] {
  switch (sigla) {
    case 'SP': return 'warning'; // sem prescrição = ainda não passou pelo médico
    case 'AM': return 'info';
    case 'AEI':
    case 'AEL': return 'secondary';
    default: return 'outline';
  }
}

const so = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** FILA DO PRONTO SOCORRO — dados ao vivo da API do prontuário (GET). Nada é gravado neste sistema. */
export default function FilaPS() {
  const { usuario } = useAuth();
  const [unidade, setUnidade] = useState(UNIDADE_PS);
  const [setor, setSetor] = useState(SETOR_PS);
  const [params, setParams] = useState({ unidade: UNIDADE_PS, setor: SETOR_PS });
  const [filtro, setFiltro] = useState('');
  const [cor, setCor] = useState<CorRisco | null>(null);
  const [automatico, setAutomatico] = useState(true);
  const [verJson, setVerJson] = useState(false);

  const q = useFilaPS(params.unidade, params.setor, automatico);
  const agora = useAgora();
  const registros = useMemo(() => q.data?.registros ?? [], [q.data]);
  const pacientes = useMemo(() => registros.map((r) => montarPaciente(r, agora)), [registros, agora]);
  const porRisco = useMemo(() => contarPorRisco(registros), [registros]);

  const esperando = pacientes.filter((p) => !p.atendido);
  const maiorEspera = esperando.reduce<PacienteFila | null>((m, p) => (!m || (p.esperaMin ?? 0) > (m.esperaMin ?? 0) ? p : m), null);
  const atrasados = esperando.filter((p) => p.atrasado).length;

  const t = so(filtro.trim());
  const soDigitos = filtro.replace(/\D/g, '');
  const visiveis = pacientes.filter((p) => {
    if (cor && p.risco.cor !== cor) return false;
    if (!t) return true;
    const r = p.r;
    const texto = so([r.NM_PESSOA_FISICA, r.NR_ATENDIMENTO, r.DS_QUEIXA_PRINC, r.NM_PESSOA_FISICA_MEDICO, p.situacao, p.risco.nome].join(' '));
    return texto.includes(t) || (soDigitos.length >= 3 && (r.NR_CPF || '').includes(soDigitos));
  });

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ unidade: unidade.trim() || UNIDADE_PS, setor: setor.trim() || SETOR_PS });
  };
  const hora = (d?: Date) => (d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');

  return (
    <>
      <PageHeader
        titulo="Fila do Pronto Socorro"
        subtitulo="Dados ao vivo do prontuário do hospital (somente leitura). Nada é gravado neste sistema."
        acoes={
          <Button onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Atualizar agora
          </Button>
        }
      />

      {q.isError && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="flex gap-4 p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><WifiOff className="h-5 w-5" /></span>
            <div className="grid gap-2 text-sm">
              <p className="font-semibold text-destructive">Não foi possível carregar a fila</p>
              <p>{(q.error as Error).message}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>A fila só aparece em computadores da rede do hospital (ou conectados à VPN).</li>
                <li>Confira a unidade e o setor no fim da página e clique em <strong>Consultar</strong>.</li>
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
            <StatCard titulo="Aguardando médico" valor={q.isError ? '—' : esperando.length} detalhe={atrasados ? `${atrasados} acima do tempo-alvo` : 'nenhum acima do tempo-alvo'} icone={Stethoscope} cor={atrasados ? 'vermelho' : 'laranja'} />
            <StatCard titulo="Maior espera pelo médico" valor={maiorEspera ? duracao(maiorEspera.esperaMin) : '—'} detalhe={maiorEspera ? `classificação ${maiorEspera.risco.nome.toLowerCase()}` : 'ninguém aguardando'} icone={Hourglass} cor="roxo" />
            <StatCard titulo="Atualizado às" valor={hora(q.data?.recebidoEm)} detalhe={automatico ? 'atualiza sozinho a cada 1 minuto' : 'atualização manual'} icone={Clock} cor="azul" />
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-primary"><Siren className="h-5 w-5" /> Classificação de risco</CardTitle>
          <CardDescription>Protocolo de Manchester. Clique numa cor para ver só esses pacientes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {porRisco.map(({ risco, total }) => {
            const ativo = cor === risco.cor;
            return (
              <button
                key={risco.cor}
                type="button"
                onClick={() => setCor(ativo ? null : risco.cor)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-md',
                  ativo && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                  cor && !ativo && 'opacity-50',
                )}
                aria-pressed={ativo}
              >
                <span className="tabular flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold" style={{ backgroundColor: risco.fundo, color: risco.texto }}>
                  {total}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{risco.nome}</span>
                  <span className="block text-xs text-muted-foreground">{risco.descricao}</span>
                  {Number.isFinite(risco.alvoMin) && (
                    <span className="block text-xs text-muted-foreground">{risco.alvoMin === 0 ? 'atendimento imediato' : `médico em até ${duracao(risco.alvoMin)}`}</span>
                  )}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary"><Hospital className="h-5 w-5" /> Pacientes</CardTitle>
            <CardDescription className="mt-1">
              Na ordem da fila do hospital (por prioridade).{' '}
              {visiveis.length !== pacientes.length && <>Mostrando {visiveis.length} de {pacientes.length}.</>}
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {cor && (
              <Button variant="outline" size="sm" onClick={() => setCor(null)}><X /> Tirar filtro de cor</Button>
            )}
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nome, atendimento, CPF, queixa…" className="pl-9" type="search" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="grid gap-2 p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : !pacientes.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              {q.isError ? <AlertTriangle className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              {q.isError ? 'Sem dados: a API não respondeu.' : 'Nenhum paciente na fila agora.'}
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Atendimento</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Chegada</TableHead>
                    <TableHead className="whitespace-nowrap">Espera pelo médico</TableHead>
                    <TableHead className="whitespace-nowrap">No PS há</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="whitespace-nowrap">Queixa principal</TableHead>
                    <TableHead>Médico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((p) => (
                    <TableRow key={p.r.NR_ATENDIMENTO} className={cn(p.atrasado && 'bg-destructive/5')}>
                      <TableCell className="tabular font-medium">{p.r.NR_ATENDIMENTO}</TableCell>
                      <TableCell className="min-w-[200px]">
                        <span className="font-medium">{p.r.NM_PESSOA_FISICA}</span>
                        {p.reavaliacao && <Badge variant="outline" className="ml-2 align-middle"><RotateCcw className="h-3 w-3" /> Reavaliação</Badge>}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap" title={p.r.IDADE_DETALHADA}>{p.r.IDADE ? `${p.r.IDADE} anos` : '—'}</TableCell>
                      <TableCell><SeloRisco risco={p.risco} /></TableCell>
                      <TableCell className="tabular">{horaCurta(p.chegada)}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">
                        {p.atendido ? (
                          <span className="text-muted-foreground" title={`Atendido pelo médico às ${horaCurta(p.atendMedico)}`}>
                            {duracao(p.esperaMin)} <span className="text-xs">(atendido {horaCurta(p.atendMedico)})</span>
                          </span>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn('font-semibold', p.atrasado ? 'text-destructive' : 'text-foreground')}>
                                {p.atrasado && <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                                {duracao(p.esperaMin)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Aguardando médico desde {horaCurta(p.fimTriagem)} (fim da triagem).
                              {Number.isFinite(p.risco.alvoMin) && <> Tempo-alvo do {p.risco.nome.toLowerCase()}: {duracao(p.risco.alvoMin)}.</>}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap">{duracao(p.naUnidadeMin)}</TableCell>
                      <TableCell><Badge variant={varianteSituacao(p.r.IE_STATUS_SIGLA)} className="whitespace-nowrap">{p.situacao}</Badge></TableCell>
                      <TableCell className="max-w-[220px] truncate" title={p.r.DS_QUEIXA_PRINC}>{p.r.DS_QUEIXA_PRINC || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.atendido ? p.r.NM_PESSOA_FISICA_MEDICO || '—' : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                  {!visiveis.length && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum paciente com esse filtro.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
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

      {q.data && usuario?.perfil === 'ADMIN' && (
        <Card className="mt-6">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary"><Braces className="h-5 w-5" /> Resposta da API</CardTitle>
              <CardDescription className="mt-1">Só para o administrador: o JSON exatamente como chegou (contém dados pessoais).</CardDescription>
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
