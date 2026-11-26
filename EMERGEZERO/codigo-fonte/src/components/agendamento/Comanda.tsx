import { useState } from 'react';
import { Ban, Check, CheckCircle2, ClipboardList, Flag, FlaskConical, Lock, Plus, Receipt, RotateCcw, Stethoscope, Trash2, Wallet, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAgora } from '@/hooks/use-fila-ps';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cancelado as estaCancelado, finalizado as estaFinalizado, HORAS_PARA_REABRIR, limiteReabrir, pago as estaPago, podeFinalizar, podeReabrir } from '@/services/regras';
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
  /** Cancela o atendimento (só antes do pagamento). */
  aoCancelar: (motivo: string) => Promise<void>;
}

const MOTIVOS_RAPIDOS = ['Paciente desistiu', 'Paciente não compareceu', 'Registrado por engano', 'Paciente foi para outro hospital'];

const STATUS: Record<Exame['status'], { texto: string; variante: 'warning' | 'success' | 'info' }> = {
  PENDENTE: { texto: 'A pagar', variante: 'warning' },
  PAGO: { texto: 'Pago', variante: 'success' },
  REALIZADO: { texto: 'Realizado', variante: 'info' },
};

/** Comanda do paciente: consulta, exames pedidos pelo médico e recibos. */
export function Comanda({ a, pagamentos, precos, selecionados, setSelecionados, aoSalvar, aoRecibo, aoFechar, aoCancelar }: Props) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviandoCancel, setEnviandoCancel] = useState(false);
  const pago = estaPago(a);
  const cancelado = estaCancelado(a);
  const fin = estaFinalizado(a);
  const { usuario } = useAuth();
  const agora = useAgora(30_000);
  const [finalizando, setFinalizando] = useState(false);
  const [obsFinal, setObsFinal] = useState('');
  const limite = limiteReabrir(a);
  const reabrivel = podeReabrir(a, agora);
  const horaLimite = limite ? limite.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const confirmar = useConfirmar();
  const [exame, setExame] = useState('');
  const [contraste, setContraste] = useState(false);
  const [erroExame, setErroExame] = useState('');
  const realizada = !!a.consultaRealizadaEm;
  const pgCons = pagamentos.find((p) => p.id === a.pagamentoConsultaId);
  const pendentes = a.exames.filter((x) => x.status === 'PENDENTE');
  const todosPagos = a.exames.length > 0 && !pendentes.length;
  const ehTomografia = identificarExame(exame, precos || { exames: [], prontoSocorro: 0, adicionalContraste: 0 })?.categoria === 'Tomografia';

  async function confirmarCancelamento() {
    if (motivo.trim().length < 3) return;
    setEnviandoCancel(true);
    try { await aoCancelar(motivo.trim()); setCancelando(false); setMotivo(''); } finally { setEnviandoCancel(false); }
  }

  async function finalizar() {
    await aoSalvar({ ...a, finalizacao: { em: agoraIso(), por: usuario?.nome || 'Usuário', observacao: obsFinal.trim() || undefined } }, 'Atendimento finalizado.');
    setFinalizando(false); setObsFinal('');
  }

  async function reabrir() {
    if (!podeReabrir(a)) return;
    if (!(await confirmar({ titulo: 'Reabrir atendimento', texto: `Reabrir o atendimento nº ${a.numero} de ${a.pacienteNome}? Ele volta para "Em andamento" (ex.: retorno médico com os resultados).`, botao: 'Reabrir' }))) return;
    const { finalizacao: _f, ...resto } = a;
    await aoSalvar({ ...resto, reaberturas: [...(a.reaberturas || []), { em: agoraIso(), por: usuario?.nome || 'Usuário' }] }, 'Atendimento reaberto.');
  }

  async function registrarRetorno() {
    if (!(await confirmar({ titulo: 'Retorno médico', texto: 'Registrar que o paciente voltou ao médico com os resultados dos exames? O retorno não é cobrado.', botao: 'Registrar retorno' }))) return;
    await aoSalvar({ ...a, retornoEm: agoraIso() }, 'Retorno médico registrado.');
  }

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
          <p className="text-sm text-muted-foreground">{[`Código do paciente ${a.pacienteId}`, a.cpf && `CPF ${a.cpf}`, a.telefone].filter(Boolean).join(' · ')}</p>
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
          {cancelado ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground"><Ban className="h-3.5 w-3.5" /> Cancelado antes do pagamento</span>
          ) : (
            <>
              {etapa('Consulta paga', pago, !pago)}
              {etapa('Consulta realizada', realizada, pago && !realizada)}
              {etapa('Exames pagos', todosPagos, realizada && !todosPagos && !fin)}
              {etapa('Retorno médico', !!a.retornoEm, false)}
              {etapa('Finalizado', fin, false)}
            </>
          )}
        </div>

        {cancelado && a.cancelamento && (
          <div className="grid gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive"><Ban className="h-4 w-4" /> Atendimento cancelado</p>
            <p>Em {dataBR(a.cancelamento.em)} às {horaBR(a.cancelamento.em)} · por {a.cancelamento.por}</p>
            <p><span className="text-muted-foreground">Motivo:</span> {a.cancelamento.motivo}</p>
          </div>
        )}

        {fin && a.finalizacao && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-medical-green-light px-4 py-3 text-sm">
            <div className="grid gap-1">
              <p className="flex items-center gap-2 font-semibold text-primary"><Lock className="h-4 w-4" /> Atendimento finalizado</p>
              <p>Em {dataBR(a.finalizacao.em)} às {horaBR(a.finalizacao.em)} · por {a.finalizacao.por}</p>
              {a.finalizacao.observacao && <p><span className="text-muted-foreground">Observação:</span> {a.finalizacao.observacao}</p>}
              <p className="text-xs text-muted-foreground">
                {reabrivel
                  ? `Pode ser reaberto até ${horaLimite} (${HORAS_PARA_REABRIR} horas após finalizar), para o retorno médico.`
                  : `O prazo de ${HORAS_PARA_REABRIR} horas para reabrir terminou${horaLimite ? ` às ${horaLimite}` : ''}.`}
              </p>
            </div>
            {reabrivel && <Button variant="outline" onClick={reabrir}><RotateCcw /> Reabrir atendimento</Button>}
          </div>
        )}

        {/* Consulta */}
        <section className="overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Consulta</span>
            {pgCons && <span>{NOMES_FORMA[pgCons.forma]} · {horaBR(pgCons.dataHora)}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{nomeServico(a.tipo, a.medicoNome)}</p>
              <p className="text-xs text-muted-foreground">{cancelado ? 'Cancelada' : !pago ? 'Aguardando pagamento' : realizada ? `Realizada às ${horaBR(a.consultaRealizadaEm)}` : 'Aguardando o médico'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={cancelado ? 'destructive' : !pago ? 'warning' : realizada ? 'info' : 'success'}>{cancelado ? 'Cancelada' : !pago ? 'A pagar' : realizada ? 'Realizada' : 'Paga'}</Badge>
              <span className="tabular font-semibold">{pgCons?.cortesia ? 'Cortesia' : moeda(a.valorConsulta)}</span>
            </div>
          </div>
          {!pago && !cancelado && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-warning/10 px-4 py-3">
              <p className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4 shrink-0 text-warning" /> Aguardando pagamento: cobre no painel ao lado. Se o paciente desistir, cancele.</p>
              <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelando(true)}><Ban /> Cancelar atendimento</Button>
            </div>
          )}
          {pago && !realizada && !fin && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-warning/10 px-4 py-3">
              <p className="text-sm">Quando o médico terminar a consulta, marque aqui. Depois disso os exames podem ser lançados.</p>
              <Button onClick={marcarRealizada}><CheckCircle2 /> Consulta realizada</Button>
            </div>
          )}
        </section>

        {/* Exames */}
        {realizada && (
          <>
            {!fin && <form onSubmit={lancar} className="grid gap-2">
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
            </form>}

            <section className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-4 w-4" /> Exames ({a.exames.length})</span>
                {pendentes.length > 0 && !fin && (
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
                      {x.status === 'PENDENTE' && !fin
                        ? <Checkbox checked={selecionados.has(x.id)} onCheckedChange={(v) => alternar(x.id, !!v)} aria-label={`Pagar ${x.nome} agora`} />
                        : x.status === 'PENDENTE' ? <span className="h-1.5 w-1.5 rounded-full bg-warning" /> : <Check className="h-4 w-4 text-success" />}
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
                      {x.status === 'PENDENTE' && !fin && (
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => remover(x)}><Trash2 /> Remover</Button>
                      )}
                      {x.status === 'PAGO' && !fin && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => alterar(x, { status: 'REALIZADO', realizadoEm: agoraIso() }, `${x.nome}: realizado.`)}><Check /> Marcar realizado</Button>
                      )}
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      {x.status === 'PENDENTE' && !fin ? (
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

        {/* Retorno médico (mesmo dia, com os resultados dos exames) */}
        {realizada && (a.retornoEm || !fin) && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
            <div>
              <p className="flex items-center gap-2 font-medium"><Stethoscope className="h-4 w-4 text-primary" /> Retorno médico</p>
              <p className="text-xs text-muted-foreground">{a.retornoEm ? `Feito às ${horaBR(a.retornoEm)} · sem cobrança` : 'No mesmo dia, quando os resultados dos exames saírem. Não é cobrado.'}</p>
            </div>
            {a.retornoEm
              ? <Badge variant="success"><Check className="h-3 w-3" /> Feito</Badge>
              : <Button variant="outline" onClick={registrarRetorno}><Stethoscope /> Registrar retorno médico</Button>}
          </section>
        )}

        {/* Finalizar atendimento */}
        {podeFinalizar(a) && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-primary/50 bg-muted/40 px-4 py-3">
            <div className="max-w-md">
              <p className="flex items-center gap-2 font-medium"><Flag className="h-4 w-4 text-primary" /> Finalizar atendimento</p>
              <p className="text-xs text-muted-foreground">Encerra o atendimento mesmo que o paciente já tenha ido embora. Pode ser reaberto por até {HORAS_PARA_REABRIR} horas (retorno médico).</p>
            </div>
            <Button onClick={() => setFinalizando(true)}><Flag /> Finalizar atendimento</Button>
          </section>
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

      <Dialog open={finalizando} onOpenChange={setFinalizando}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">Finalizar atendimento nº {a.numero}</DialogTitle>
            <DialogDescription>{a.pacienteNome} sai de "Em andamento". Se precisar (ex.: retorno médico com os resultados), dá para reabrir por até {HORAS_PARA_REABRIR} horas.</DialogDescription>
          </DialogHeader>
          {pendentes.length > 0 && (
            <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">Atenção: {pendentes.length} exame(s) ainda <strong>não pago(s)</strong> ficarão em aberto: {pendentes.map((x) => x.nome).join(', ')}.</p>
          )}
          {!a.retornoEm && a.exames.length > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">O retorno médico ainda não foi registrado.</p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="obs-final">Observação (opcional)</Label>
            <Textarea id="obs-final" value={obsFinal} onChange={(e) => setObsFinal(e.target.value)} maxLength={300} rows={3} placeholder="Ex.: paciente foi embora antes do retorno" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizando(false)}>Voltar</Button>
            <Button onClick={finalizar}><Flag /> Finalizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelando} onOpenChange={(o) => { if (!enviandoCancel) setCancelando(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancelar atendimento nº {a.numero}</DialogTitle>
            <DialogDescription>{a.pacienteNome} ainda não pagou. O atendimento fica registrado como <strong>cancelado</strong> (não é apagado) e não gera recibo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_RAPIDOS.map((m) => (
                <button key={m} type="button" onClick={() => setMotivo(m)} className={cn('rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted', motivo === m && 'border-primary bg-muted font-semibold text-primary')}>{m}</button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="motivo-cancel">Motivo do cancelamento *</Label>
              <Textarea id="motivo-cancel" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} placeholder="Escolha acima ou escreva o motivo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelando(false)} disabled={enviandoCancel}>Voltar</Button>
            <Button variant="destructive" onClick={confirmarCancelamento} disabled={motivo.trim().length < 3 || enviandoCancel}><Ban /> Cancelar atendimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
