import { useState } from 'react';
import { Check, CheckCircle2, ClipboardList, FlaskConical, Plus, Receipt, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useConfirmar } from '@/components/Confirmar';
import { cn } from '@/lib/utils';
import { agoraIso, dataBR, horaBR, lerMoeda, moeda, valorCampo } from '@/lib/format';
import { identificarExame, NOMES_FORMA, nomeServico, TIPOS } from '@/services/config';
import type { Atendimento, Exame, Pagamento, TabelaPrecos } from '@/types';

interface Props {
  a: Atendimento;
  pagamentos: Pagamento[];
  precos: TabelaPrecos | undefined;
  selecionados: Set<string>;
  setSelecionados: (s: Set<string>) => void;
  aoSalvar: (a: Atendimento, aviso?: string) => Promise<void>;
  aoRecibo: (p: Pagamento) => void;
  aoFechar: () => void;
}

const STATUS: Record<Exame['status'], { texto: string; variante: 'warning' | 'success' | 'info' }> = {
  PENDENTE: { texto: 'A pagar', variante: 'warning' },
  PAGO: { texto: 'Pago', variante: 'success' },
  REALIZADO: { texto: 'Realizado', variante: 'info' },
};

/** Comanda do paciente: consulta, exames pedidos pelo médico e recibos. */
export function Comanda({ a, pagamentos, precos, selecionados, setSelecionados, aoSalvar, aoRecibo, aoFechar }: Props) {
  const confirmar = useConfirmar();
  const [exame, setExame] = useState('');
  const [contraste, setContraste] = useState(false);
  const [erroExame, setErroExame] = useState('');
  const realizada = !!a.consultaRealizadaEm;
  const pgCons = pagamentos.find((p) => p.id === a.pagamentoConsultaId);
  const pendentes = a.exames.filter((x) => x.status === 'PENDENTE');
  const todosPagos = a.exames.length > 0 && !pendentes.length;
  const ehTomografia = identificarExame(exame, precos || { exames: [], prontoSocorro: 0, adicionalContraste: 0 })?.categoria === 'Tomografia';

  async function marcarRealizada() {
    if (!(await confirmar({ titulo: 'Consulta realizada', texto: 'Marcar a consulta como realizada? Depois disso os exames pedidos pelo médico podem ser lançados.', botao: 'Marcar realizada' }))) return;
    await aoSalvar({ ...a, consultaRealizadaEm: agoraIso() }, 'Consulta realizada.');
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!precos) return;
    const item = identificarExame(exame, precos);
    if (!item) { setErroExame('Exame não encontrado na tabela de preços. Escolha um item da lista.'); return; }
    if (item.categoria === 'Tomografia' && contraste) { item.nome += ' com contraste'; item.valor += Number(precos.adicionalContraste || 0); }
    const novo: Exame = { id: `E${Date.now()}${Math.floor(Math.random() * 100)}`, nome: item.nome, categoria: item.categoria, valor: item.valor, status: 'PENDENTE', pedidoEm: agoraIso() };
    setSelecionados(new Set([...selecionados, novo.id]));
    await aoSalvar({ ...a, exames: [...a.exames, novo] });
    setExame(''); setContraste(false); setErroExame('');
  }

  async function remover(x: Exame) {
    if (!(await confirmar({ titulo: 'Remover exame', texto: `Remover "${x.nome}" da comanda? Só exames ainda não pagos podem ser removidos.`, botao: 'Remover', perigo: true }))) return;
    const s = new Set(selecionados); s.delete(x.id); setSelecionados(s);
    await aoSalvar({ ...a, exames: a.exames.filter((y) => y.id !== x.id) }, 'Exame removido.');
  }

  const alterar = (x: Exame, mudanca: Partial<Exame>, aviso?: string) => aoSalvar({ ...a, exames: a.exames.map((y) => (y.id === x.id ? { ...y, ...mudanca } : y)) }, aviso);
  const alternar = (id: string, v: boolean) => { const s = new Set(selecionados); if (v) s.add(id); else s.delete(id); setSelecionados(s); };
  const todosMarcados = pendentes.length > 0 && pendentes.every((x) => selecionados.has(x.id));

  const etapa = (texto: string, feito: boolean, atual: boolean) => (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
      feito ? 'border-primary bg-primary text-primary-foreground' : atual ? 'border-primary text-primary' : 'text-muted-foreground')}>
      {feito ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />} {texto}
    </span>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-primary">{a.pacienteNome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {a.tipo === 'PRONTO_SOCORRO' ? 'Pronto Socorro' : `${TIPOS[a.tipo].descricao} · ${a.medicoNome}`} · {dataBR(a.abertoEm)} {horaBR(a.abertoEm)}
          </p>
          <p className="text-sm text-muted-foreground">{[a.cpf && `CPF ${a.cpf}`, a.telefone].filter(Boolean).join(' · ') || 'Sem CPF/telefone'}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Atendimento</p>
            <p className="tabular text-lg font-bold">nº {a.numero}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={aoFechar} aria-label="Fechar comanda"><X /></Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6">
        <div className="flex flex-wrap gap-2">
          {etapa('Consulta paga', true, false)}
          {etapa('Consulta realizada', realizada, !realizada)}
          {etapa('Exames pagos', todosPagos, realizada && !todosPagos)}
        </div>

        {/* Consulta */}
        <section className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Consulta</span>
            {pgCons && <span>{NOMES_FORMA[pgCons.forma]} · {horaBR(pgCons.dataHora)}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{nomeServico(a.tipo, a.medicoNome)}</p>
              <p className="text-xs text-muted-foreground">{realizada ? `Realizada às ${horaBR(a.consultaRealizadaEm)}` : 'Aguardando o médico'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={realizada ? 'info' : 'success'}>{realizada ? 'Realizada' : 'Paga'}</Badge>
              <span className="tabular font-semibold">{pgCons?.cortesia ? 'Cortesia' : moeda(a.valorConsulta)}</span>
            </div>
          </div>
          {!realizada && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-warning/10 px-4 py-3">
              <p className="text-sm">Quando o médico terminar a consulta, marque aqui. Depois disso os exames podem ser lançados.</p>
              <Button onClick={marcarRealizada}><CheckCircle2 /> Consulta realizada</Button>
            </div>
          )}
        </section>

        {/* Exames */}
        {realizada && (
          <>
            <form onSubmit={lancar} className="grid gap-2">
              <Label htmlFor="ex-nome">Lançar exame pedido pelo médico</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="ex-nome" list="lista-exames" value={exame} onChange={(e) => { setExame(e.target.value); setErroExame(''); }} placeholder="Ex.: Hemograma completo, Tomografia de crânio, Raio-X de joelho…" />
                <datalist id="lista-exames">{precos?.exames.map((x) => <option key={x.nome} value={x.nome}>{`${x.categoria} · ${moeda(x.valor)}`}</option>)}</datalist>
                <Button type="submit" variant="outline" disabled={!exame.trim()}><Plus /> Lançar</Button>
              </div>
              {ehTomografia && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={contraste} onCheckedChange={(v) => setContraste(!!v)} /> Com contraste (+ {moeda(precos?.adicionalContraste)})
                </label>
              )}
              {erroExame && <p className="text-sm text-destructive">{erroExame}</p>}
            </form>

            <section className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-4 w-4" /> Exames ({a.exames.length})</span>
                {pendentes.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Checkbox checked={todosMarcados} onCheckedChange={(v) => setSelecionados(v ? new Set(pendentes.map((x) => x.id)) : new Set())} /> Pagar todos
                  </label>
                )}
              </div>
              {!a.exames.length && (
                <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
                  <ClipboardList className="h-6 w-6" />Nenhum exame lançado. Se o médico pediu exames, lance acima.
                </div>
              )}
              <ul className="divide-y">
                {a.exames.map((x) => (
                  <li key={x.id} className={cn('grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto]', selecionados.has(x.id) && 'bg-medical-green-light/60')}>
                    <span className="flex w-5 justify-center">
                      {x.status === 'PENDENTE'
                        ? <Checkbox checked={selecionados.has(x.id)} onCheckedChange={(v) => alternar(x.id, !!v)} aria-label={`Pagar ${x.nome} agora`} />
                        : <Check className="h-4 w-4 text-success" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{x.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {x.categoria}
                        {x.pagoEm && ` · pago ${horaBR(x.pagoEm)}`}{x.realizadoEm && ` · realizado ${horaBR(x.realizadoEm)}`}
                      </p>
                    </div>
                    <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto">
                      <Badge variant={STATUS[x.status].variante}>{STATUS[x.status].texto}</Badge>
                      {x.status === 'PENDENTE' && (
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remover(x)}><Trash2 /> Remover</Button>
                      )}
                      {x.status === 'PAGO' && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => alterar(x, { status: 'REALIZADO', realizadoEm: agoraIso() }, `${x.nome}: realizado.`)}><Check /> Marcar realizado</Button>
                      )}
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      {x.status === 'PENDENTE' ? (
                        <Input
                          key={x.valor}
                          defaultValue={valorCampo(x.valor)}
                          onBlur={(e) => { const v = lerMoeda(e.target.value); if (v !== x.valor) alterar(x, { valor: v }); }}
                          inputMode="decimal"
                          className="tabular h-9 w-28 text-right"
                          aria-label={`Valor de ${x.nome}`}
                        />
                      ) : (
                        <span className="tabular block w-28 text-right font-semibold">{moeda(x.valor)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {a.exames.length > 0 && (
                <div className="flex justify-between border-t bg-muted/50 px-4 py-2 text-sm">
                  <span>Pago <strong className="tabular">{moeda(a.exames.filter((x) => x.status !== 'PENDENTE').reduce((t, x) => t + x.valor, 0))}</strong></span>
                  <span>A pagar <strong className="tabular">{moeda(pendentes.reduce((t, x) => t + x.valor, 0))}</strong></span>
                </div>
              )}
            </section>
          </>
        )}

        {/* Recibos */}
        {pagamentos.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recibos</h3>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {[...pagamentos].sort((x, y) => x.dataHora.localeCompare(y.dataHora)).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => aoRecibo(p)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      {p.referente === 'CONSULTA' ? 'Consulta' : `Exames (${p.itens.length})`} · {NOMES_FORMA[p.forma]}{(p.parcelas ?? 1) > 1 ? ` ${p.parcelas}x` : ''} · {horaBR(p.dataHora)} · nº {p.numeroRecibo}
                    </span>
                    <span className="tabular font-medium">{p.cortesia ? `cortesia ${moeda(p.cortesia.valor)}` : moeda(p.valor)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
