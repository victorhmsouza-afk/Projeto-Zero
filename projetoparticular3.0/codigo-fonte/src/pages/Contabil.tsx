import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, Download, Gift, Receipt, Stethoscope, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { PeriodoFiltro, type Periodo } from '@/components/PeriodoFiltro';
import { ReciboDialog } from '@/components/Recibo';
import { useAtendimentos, usePagamentos } from '@/hooks/use-dados';
import { toast } from '@/hooks/use-toast';
import { dataBR, diaPorExtenso, horaBR, moeda, periodoRapido } from '@/lib/format';
import { NOMES_FORMA, nomeServico, TIPOS } from '@/services/config';
import type { FormaPagamento, Pagamento } from '@/types';

const soma = (l: Pagamento[], f: (p: Pagamento) => number | undefined) => l.reduce((t, p) => t + Number(f(p) || 0), 0);
const FORMAS: FormaPagamento[] = ['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'CORTESIA'];

/** CONTÁBIL — único lugar com os valores recebidos. */
export default function Contabil() {
  const [periodo, setPeriodo] = useState<Periodo>({ ...periodoRapido('hoje'), atalho: 'hoje' });
  const [limite, setLimite] = useState(100);
  const [recibo, setRecibo] = useState<Pagamento | null>(null);
  const { data: pagsBrutos = [] } = usePagamentos(periodo.inicio, periodo.fim);
  const { data: atendimentos = [] } = useAtendimentos(periodo.inicio, periodo.fim);
  const pags = useMemo(() => [...pagsBrutos].sort((a, b) => b.dataHora.localeCompare(a.dataHora)), [pagsBrutos]);

  const recebido = soma(pags, (p) => p.valor);
  const recCons = soma(pags.filter((p) => p.referente === 'CONSULTA'), (p) => p.valor);
  const recEx = recebido - recCons;
  const descontos = soma(pags, (p) => p.desconto);
  const cortesias = pags.filter((p) => p.cortesia);
  const valCort = soma(cortesias, (p) => p.cortesia?.valor);
  const nPagos = pags.filter((p) => !p.cortesia).length;

  const formas = FORMAS.map((f) => {
    const l = pags.filter((p) => p.forma === f);
    return { f, qtd: l.length, valor: f === 'CORTESIA' ? soma(l, (p) => p.cortesia?.valor) : soma(l, (p) => p.valor) };
  });

  const dias = useMemo(() => {
    const m = new Map<string, { cons: number; ex: number; desc: number; cort: number }>();
    pags.forEach((p) => {
      const d = p.dataHora.slice(0, 10);
      const g = m.get(d) || { cons: 0, ex: 0, desc: 0, cort: 0 };
      g[p.referente === 'CONSULTA' ? 'cons' : 'ex'] += p.valor;
      g.desc += Number(p.desconto || 0);
      g.cort += Number(p.cortesia?.valor || 0);
      m.set(d, g);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [pags]);
  const grafico = [...dias].reverse().map(([d, g]) => ({ dia: d.slice(8, 10) + '/' + d.slice(5, 7), longo: diaPorExtenso(d), consultas: g.cons, exames: g.ex }));

  function exportar() {
    const cab = ['Data', 'Hora', 'Recibo', 'Paciente', 'CPF', 'Referente', 'Serviço', 'Forma', 'Parcelas', 'Subtotal', 'Desconto', 'Cortesia', 'Valor recebido', 'Autorizado por', 'Observação'];
    const num = (v?: number) => Number(v || 0).toFixed(2).replace('.', ',');
    const linhas = pags.map((p) => [dataBR(p.dataHora), horaBR(p.dataHora), p.numeroRecibo, p.pacienteNome, p.cpf || '',
      p.referente === 'CONSULTA' ? 'Consulta' : 'Exames', nomeServico(p.tipoConsulta, p.medicoNome), NOMES_FORMA[p.forma], p.parcelas || '',
      num(p.subtotal), num(p.desconto), num(p.cortesia?.valor), num(p.valor), p.cortesia?.autorizadoPor || '', p.cortesia?.observacao || p.cortesia?.motivo || '']);
    const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `contabil_${periodo.inicio}_a_${periodo.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success('Planilha gerada', `${pags.length} lançamentos. Abra no Excel.`);
  }

  return (
    <>
      <PageHeader
        titulo="Contábil"
        subtitulo="Valores recebidos no agendamento: por forma de pagamento, por dia e cada recibo emitido."
        acoes={<Button variant="outline" onClick={exportar} disabled={!pags.length}><Download /> Exportar planilha (CSV)</Button>}
      />
      <PeriodoFiltro valor={periodo} onChange={(p) => { setPeriodo(p); setLimite(100); }} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Total recebido" valor={moeda(recebido)} detalhe={`${nPagos} recibos · ticket médio ${atendimentos.length ? moeda(recebido / atendimentos.length) : '—'}`} icone={Banknote} destaque />
        <StatCard titulo="Consultas" valor={moeda(recCons)} detalhe="eletiva e Pronto Socorro" icone={Stethoscope} cor="verde" />
        <StatCard titulo="Exames" valor={moeda(recEx)} detalhe={recebido ? `${Math.round((recEx / recebido) * 100)}% do recebido` : '—'} icone={FlaskConical} cor="azul" />
        <StatCard titulo="Cortesias (diretoria)" valor={moeda(valCort)} detalhe={`${cortesias.length} cortesia(s) · descontos ${moeda(descontos)}`} icone={Gift} cor="laranja" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Por forma de pagamento</CardTitle>
            <CardDescription>Cortesia não entra no total recebido.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Forma</TableHead><TableHead className="text-right">Lançamentos</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
              <TableBody>
                {formas.map((x) => (
                  <TableRow key={x.f}>
                    <TableCell className="font-medium">{NOMES_FORMA[x.f]}</TableCell>
                    <TableCell className="tabular text-right">{x.qtd}</TableCell>
                    <TableCell className="tabular text-right">{x.f === 'CORTESIA' ? <><Badge variant="warning" className="mr-2">isento</Badge>{moeda(x.valor)}</> : moeda(x.valor)}</TableCell>
                    <TableCell className="tabular text-right">{x.f === 'CORTESIA' ? '—' : recebido ? `${((x.valor / recebido) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '0%'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow><TableCell>Total recebido</TableCell><TableCell className="tabular text-right">{nPagos}</TableCell><TableCell className="tabular text-right">{moeda(recebido)}</TableCell><TableCell className="text-right">100%</TableCell></TableRow></TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Recebido por dia</CardTitle>
            <CardDescription>Consultas e exames, empilhados.</CardDescription>
          </CardHeader>
          <CardContent>
            {grafico.length ? (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafico} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} minTickGap={12} />
                    <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof grafico)[number];
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                          <p className="mb-1 font-semibold">{p.longo}</p>
                          <p className="flex justify-between gap-6"><span>Consultas</span><b className="tabular">{moeda(p.consultas)}</b></p>
                          <p className="flex justify-between gap-6"><span>Exames</span><b className="tabular">{moeda(p.exames)}</b></p>
                          <p className="mt-1 flex justify-between gap-6 border-t pt-1"><span>Total</span><b className="tabular">{moeda(p.consultas + p.exames)}</b></p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="consultas" stackId="a" fill="hsl(var(--chart-consulta))" />
                    <Bar dataKey="exames" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="py-16 text-center text-sm text-muted-foreground">Nenhum recebimento no período.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-primary">Por dia</CardTitle></CardHeader>
        <CardContent className="max-h-[380px] overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">Consultas</TableHead><TableHead className="text-right">Exames</TableHead><TableHead className="text-right">Descontos</TableHead><TableHead className="text-right">Cortesias</TableHead><TableHead className="text-right">Recebido</TableHead></TableRow></TableHeader>
            <TableBody>
              {dias.map(([d, g]) => (
                <TableRow key={d}>
                  <TableCell>{diaPorExtenso(d)}</TableCell>
                  <TableCell className="tabular text-right">{moeda(g.cons)}</TableCell>
                  <TableCell className="tabular text-right">{moeda(g.ex)}</TableCell>
                  <TableCell className="tabular text-right">{g.desc ? moeda(g.desc) : '—'}</TableCell>
                  <TableCell className="tabular text-right">{g.cort ? moeda(g.cort) : '—'}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{moeda(g.cons + g.ex)}</TableCell>
                </TableRow>
              ))}
              {!dias.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum recebimento no período.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-primary">Recibos emitidos</CardTitle>
            <CardDescription className="mt-1">Clique numa linha para abrir o recibo.</CardDescription>
          </div>
          {pags.length > 0 && <span className="text-sm text-muted-foreground">{Math.min(pags.length, limite)} de {pags.length}</span>}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Data e hora</TableHead><TableHead>Recibo</TableHead><TableHead>Paciente</TableHead><TableHead>Referente</TableHead><TableHead>Forma</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {pags.slice(0, limite).map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setRecibo(p)}>
                  <TableCell className="tabular whitespace-nowrap">{dataBR(p.dataHora)} {horaBR(p.dataHora)}</TableCell>
                  <TableCell className="tabular"><span className="inline-flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-primary" />{p.numeroRecibo}</span></TableCell>
                  <TableCell className="max-w-[220px] truncate">{p.pacienteNome}</TableCell>
                  <TableCell>{p.referente === 'CONSULTA' ? TIPOS[p.tipoConsulta]?.nome : `Exames (${p.itens.length})`}</TableCell>
                  <TableCell>{NOMES_FORMA[p.forma]}{(p.parcelas ?? 1) > 1 ? ` ${p.parcelas}x` : ''}</TableCell>
                  <TableCell className="tabular whitespace-nowrap text-right">{p.cortesia ? <><Badge variant="warning" className="mr-2">cortesia</Badge>{moeda(p.cortesia.valor)}</> : moeda(p.valor)}</TableCell>
                </TableRow>
              ))}
              {!pags.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum recibo no período.</TableCell></TableRow>}
            </TableBody>
          </Table>
          {pags.length > limite && <div className="flex justify-center p-4"><Button variant="outline" onClick={() => setLimite((l) => l + 200)}>Mostrar mais</Button></div>}
        </CardContent>
      </Card>
      <ReciboDialog pagamento={recibo} aoFechar={() => setRecibo(null)} />
    </>
  );
}
