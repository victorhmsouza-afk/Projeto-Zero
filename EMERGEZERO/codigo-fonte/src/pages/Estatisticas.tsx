import { useState } from 'react';
import { CalendarClock, Gift, Loader2, Siren, Sparkles, Stethoscope, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioCard, RadioGroup } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { PeriodoFiltro, type Periodo } from '@/components/PeriodoFiltro';
import { GraficoConsultas, LegendaConsultas, type PontoGrafico } from '@/components/GraficoConsultas';
import { useConfirmar } from '@/components/Confirmar';
import { cancelado } from '@/services/regras';
import { useAtendimentos, useAtualizar, usePagamentos, useTemExemplos } from '@/hooks/use-dados';
import { toast } from '@/hooks/use-toast';
import { dataLocal, DIAS, MESES, periodoRapido } from '@/lib/format';
import { Banco } from '@/services/banco';
import { gerarExemplos } from '@/services/exemplos';
import type { Atendimento } from '@/types';

type Modo = 'mes' | 'dia' | 'hora' | 'minuto';
const dois = (n: number) => String(n).padStart(2, '0');

function chaveDe(modo: Modo, iso: string) {
  if (modo === 'mes') return iso.slice(0, 7);
  if (modo === 'dia') return iso.slice(0, 10);
  const h = Number(iso.slice(11, 13)), m = Number(iso.slice(14, 16));
  return modo === 'hora' ? String(h) : String(h * 60 + Math.floor(m / 15) * 15);
}

function grupos(modo: Modo, ini: string, fim: string): (PontoGrafico & { chave: string })[] {
  const g: (PontoGrafico & { chave: string })[] = [];
  const novo = (chave: string, rotulo: string, longo: string) => g.push({ chave, rotulo, longo, consulta: 0, ps: 0 });
  if (modo === 'hora') for (let h = 0; h < 24; h++) novo(String(h), `${dois(h)}h`, `${dois(h)}:00 às ${dois(h)}:59`);
  else if (modo === 'minuto') for (let m = 0; m < 1440; m += 15) { const f = m + 14; novo(String(m), `${dois(Math.floor(m / 60))}:${dois(m % 60)}`, `${dois(Math.floor(m / 60))}:${dois(m % 60)} às ${dois(Math.floor(f / 60))}:${dois(f % 60)}`); }
  else {
    const d = new Date(`${ini}T00:00`), limite = new Date(`${fim}T00:00`);
    if (modo === 'mes') d.setDate(1);
    while (d <= limite) {
      if (modo === 'mes') { novo(dataLocal(d).slice(0, 7), `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, `${MESES[d.getMonth()]} de ${d.getFullYear()}`); d.setMonth(d.getMonth() + 1); }
      else { novo(dataLocal(d), `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`, `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}`); d.setDate(d.getDate() + 1); }
    }
  }
  return g;
}

/** Estatísticas — só QUANTIDADES de consultas (valores ficam no Contábil). */
export default function Estatisticas() {
  const [periodo, setPeriodo] = useState<Periodo>({ ...periodoRapido('30'), atalho: '30' });
  const [modo, setModo] = useState<Modo>('dia');
  const { data: todosAtend = [], isLoading } = useAtendimentos(periodo.inicio, periodo.fim);
  // Cancelados (antes do pagamento) não entram nas contagens; aparecem só no total de cancelados.
  const atendimentos = todosAtend.filter((a) => !cancelado(a));
  const nCancelados = todosAtend.length - atendimentos.length;
  const { data: pagamentos = [] } = usePagamentos(periodo.inicio, periodo.fim);
  const { data: temExemplos } = useTemExemplos();
  const atualizar = useAtualizar();
  const confirmar = useConfirmar();
  const [trabalhando, setTrabalhando] = useState(false);

  const g = grupos(modo, periodo.inicio, periodo.fim);
  const mapa = new Map(g.map((x) => [x.chave, x]));
  atendimentos.forEach((a: Atendimento) => { const x = mapa.get(chaveDe(modo, a.abertoEm)); if (x) x[a.tipo === 'PRONTO_SOCORRO' ? 'ps' : 'consulta']++; });
  let visiveis = g;
  if (modo === 'minuto') {
    const com = g.filter((x) => x.consulta + x.ps).map((x) => Number(x.chave));
    const de = Math.min(7 * 60, ...com), ate = Math.max(19 * 60 - 15, ...com);
    visiveis = g.filter((x) => Number(x.chave) >= de && Number(x.chave) <= ate);
  }
  const linhas = modo === 'minuto' || modo === 'hora' ? visiveis.filter((x) => x.consulta + x.ps) : visiveis;

  const total = atendimentos.length;
  const nCons = atendimentos.filter((a) => a.tipo !== 'PRONTO_SOCORRO').length;
  const nPs = total - nCons;
  const dias = Math.max(1, Math.round((+new Date(`${periodo.fim}T00:00`) - +new Date(`${periodo.inicio}T00:00`)) / 86400000) + 1);
  const porHora = new Array(24).fill(0); atendimentos.forEach((a) => porHora[Number(a.abertoEm.slice(11, 13))]++);
  const pico = porHora.indexOf(Math.max(...porHora));
  const por15 = new Map<string, number>(); atendimentos.forEach((a) => { const k = chaveDe('minuto', a.abertoEm); por15.set(k, (por15.get(k) || 0) + 1); });
  const pico15 = [...por15.entries()].sort((a, b) => b[1] - a[1])[0];
  const fmt15 = (k: number) => `${dois(Math.floor(k / 60))}:${dois(k % 60)}`;
  const nCortesias = pagamentos.filter((p) => p.cortesia && p.referente === 'CONSULTA').length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}% do total` : '—');
  const NOME = { mes: 'mês', dia: 'dia', hora: 'hora do dia', minuto: 'minuto (faixas de 15 min)' }[modo];

  async function gerar() {
    setTrabalhando(true);
    const { atend, pags } = gerarExemplos();
    await Banco.gravarExemplos(atend, pags);
    await atualizar();
    setTrabalhando(false);
    toast.success('Dados de exemplo gerados', `${atend.length} atendimentos fictícios nos últimos 90 dias.`);
  }
  async function remover() {
    if (!(await confirmar({ titulo: 'Remover dados de exemplo', texto: 'Remover todos os dados de exemplo? Os atendimentos reais não são afetados.', botao: 'Remover', perigo: true }))) return;
    await Banco.removerExemplos();
    await atualizar();
    toast.success('Dados de exemplo removidos');
  }

  return (
    <>
      <PageHeader titulo="Estatísticas de consultas" subtitulo="Quantidade de consultas por mês, dia, hora e minuto. Os valores em dinheiro ficam na aba Contábil." />
      <PeriodoFiltro
        valor={periodo}
        onChange={setPeriodo}
        extra={
          <div className="grid w-full gap-2 xl:w-auto">
            <Label>Agrupar por</Label>
            <RadioGroup value={modo} onValueChange={(v) => setModo(v as Modo)} className="grid-cols-2 sm:grid-cols-4">
              <RadioCard value="mes" className="h-9">Mês</RadioCard>
              <RadioCard value="dia" className="h-9">Dia</RadioCard>
              <RadioCard value="hora" className="h-9">Hora</RadioCard>
              <RadioCard value="minuto" className="h-9">Minuto</RadioCard>
            </RadioGroup>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Consultas no período" valor={total} detalhe={`${(total / dias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia · ${nCortesias} cortesia(s)${nCancelados ? ` · ${nCancelados} cancelado(s)` : ''}`} icone={Users} destaque />
        <StatCard titulo="Consulta eletiva" valor={nCons} detalhe={pct(nCons)} icone={Stethoscope} cor="verde" />
        <StatCard titulo="Pronto Socorro" valor={nPs} detalhe={pct(nPs)} icone={Siren} cor="laranja" />
        <StatCard titulo="Horário de pico" valor={total ? `${dois(pico)}h` : '—'} detalhe={pico15 ? `faixa mais cheia: ${fmt15(Number(pico15[0]))} (${pico15[1]})` : 'sem movimento'} icone={CalendarClock} cor="azul" />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-primary">Consultas por {NOME}</CardTitle>
            <CardDescription className="mt-1">Passe o mouse nas barras para ver os números.</CardDescription>
          </div>
          <LegendaConsultas />
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex h-[300px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            : total ? <GraficoConsultas dados={visiveis} altura={300} />
            : <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-6 w-6" />Nenhuma consulta no período. Gere dados de exemplo abaixo para testar.</div>}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-primary">Tabela</CardTitle>
          <CardDescription>Os mesmos números do gráfico.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[460px] overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>{{ mes: 'Mês', dia: 'Dia', hora: 'Hora', minuto: 'Horário' }[modo]}</TableHead>
                <TableHead className="text-right">Consulta</TableHead>
                <TableHead className="text-right">Pronto Socorro</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((x) => (
                <TableRow key={x.chave}>
                  <TableCell>{x.longo}</TableCell>
                  <TableCell className="tabular text-right">{x.consulta}</TableCell>
                  <TableCell className="tabular text-right">{x.ps}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{x.consulta + x.ps}</TableCell>
                </TableRow>
              ))}
              {!linhas.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma consulta no período.</TableCell></TableRow>}
            </TableBody>
            <TableFooter className="sticky bottom-0">
              <TableRow>
                <TableCell>Total do período</TableCell>
                <TableCell className="tabular text-right">{nCons}</TableCell>
                <TableCell className="tabular text-right">{nPs}</TableCell>
                <TableCell className="tabular text-right">{total}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6 border-dashed">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-medium"><Gift className="h-4 w-4 text-primary" /> Dados de exemplo</p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {temExemplos
                ? 'Há dados de exemplo (fictícios) misturados nas estatísticas e no contábil. Remova quando for usar de verdade.'
                : 'Para testar sem esperar o movimento real, gere 90 dias de atendimentos fictícios. Eles ficam marcados e podem ser removidos depois.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={gerar} disabled={!!temExemplos || trabalhando}>{trabalhando ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar exemplos</Button>
            <Button variant="outline" onClick={remover} disabled={!temExemplos} className="text-destructive hover:text-destructive"><Trash2 /> Remover</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
