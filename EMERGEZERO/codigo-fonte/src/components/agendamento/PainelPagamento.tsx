import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Gift, Loader2, QrCode, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioCard, RadioGroup } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { lerMoeda, moeda } from '@/lib/format';
import { DIRETORIA } from '@/services/config';
import type { FormaPagamento } from '@/types';
import type { DadosPagamento, ItemPagar } from './tipos';

interface Props {
  itens: ItemPagar[];
  rotulo: string;          // ex.: "CONSULTA" ou "EXAMES"
  dicaVazio: string;       // texto quando não há nada a pagar
  resetKey: string;        // muda → limpa o painel
  aoFinalizar: (d: DadosPagamento) => Promise<string | void>; // devolve mensagem de erro, se houver
}

const FORMAS: { valor: FormaPagamento; titulo: string; sub: string; icone: typeof Wallet }[] = [
  { valor: 'PIX', titulo: 'PIX', sub: 'Transferência', icone: QrCode },
  { valor: 'CREDITO', titulo: 'CRÉDITO', sub: 'Até 6x', icone: CreditCard },
  { valor: 'DEBITO', titulo: 'DÉBITO', sub: 'À vista', icone: CreditCard },
  { valor: 'DINHEIRO', titulo: 'DINHEIRO', sub: 'Com troco', icone: Banknote },
];

/** Painel de pagamento (visor + formas). Não existe cancelamento nem estorno. */
export function PainelPagamento({ itens, rotulo, dicaVazio, resetKey, aoFinalizar }: Props) {
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [desconto, setDesconto] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [nsu, setNsu] = useState('');
  const [pix, setPix] = useState('');
  const [recebido, setRecebido] = useState('');
  const [diretor, setDiretor] = useState('');
  const [senha, setSenha] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setForma(''); setDesconto(''); setParcelas('1'); setNsu(''); setPix(''); setRecebido('');
    setDiretor(''); setSenha(''); setObservacao(''); setErro('');
  }, [resetKey]);

  const cortesia = forma === 'CORTESIA';
  const subtotal = itens.reduce((t, i) => t + i.valor, 0);
  const desc = cortesia ? 0 : Math.min(lerMoeda(desconto), subtotal);
  const total = cortesia ? 0 : Math.round((subtotal - desc) * 100) / 100;
  const troco = Math.max(0, lerMoeda(recebido) - total);
  const vazio = !itens.length || !subtotal;
  const limparErro = () => setErro('');

  async function finalizar() {
    setErro('');
    if (vazio) return setErro('Não há valor a pagar.');
    if (!forma) return setErro('Escolha a forma de pagamento.');
    const d: DadosPagamento = { forma, subtotal, desconto: desc, valor: total };
    if (forma === 'CREDITO') Object.assign(d, { parcelas: Number(parcelas), autorizacao: nsu.trim() });
    if (forma === 'DEBITO') d.autorizacao = nsu.trim();
    if (forma === 'PIX') d.idTransacao = pix.trim();
    if (forma === 'DINHEIRO') {
      const r = lerMoeda(recebido);
      if (r < total) return setErro(`O valor recebido é menor que o total (${moeda(total)}).`);
      Object.assign(d, { recebido: r, troco: Math.round((r - total) * 100) / 100 });
    }
    if (forma === 'CORTESIA') {
      if (!diretor) return setErro('Escolha quem da diretoria autorizou a cortesia.');
      if (!senha) return setErro('Digite a senha de autorização da diretoria.');
      if (observacao.trim().length < 3) return setErro('Preencha a observação da cortesia.');
      d.cortesia = { diretorId: diretor, senha, observacao: observacao.trim() };
    }
    setEnviando(true);
    try {
      const msg = await aoFinalizar(d);
      if (msg) { setErro(msg); if (cortesia) setSenha(''); }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="lg:sticky lg:top-24">
      <CardContent className="grid gap-4 p-4 sm:p-5">
        {/* Visor */}
        <div className={cn('rounded-lg bg-medical-green p-5 text-white shadow-sm', cortesia && 'bg-gradient-to-br from-medical-green to-amber-700')}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            {cortesia ? 'Cortesia · diretoria' : `${rotulo ? `${rotulo} · ` : ''}Total a pagar`}
          </p>
          <p className="tabular mt-1 text-4xl font-bold">{moeda(total)}</p>
          <p className="mt-1 text-sm text-white/80">
            {vazio ? dicaVazio
              : cortesia ? `${itens.length} item(ns) · valor do serviço ${moeda(subtotal)} · isento`
              : `${itens.length} item(ns)${desc ? ` · subtotal ${moeda(subtotal)} · desconto ${moeda(desc)}` : ''}`}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="pg-desconto">Desconto (R$)</Label>
          <Input id="pg-desconto" value={desconto} onChange={(e) => { setDesconto(e.target.value); limparErro(); }} inputMode="decimal" placeholder="0,00" className="tabular text-right" disabled={vazio || cortesia} />
        </div>

        <div className="grid gap-2">
          <Label>Forma de pagamento</Label>
          <RadioGroup value={forma} onValueChange={(v) => { setForma(v as FormaPagamento); limparErro(); }} className="grid-cols-2" disabled={vazio}>
            {FORMAS.map((f) => (
              <RadioCard key={f.valor} value={f.valor} className="h-16 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-semibold tracking-wide"><f.icone /> {f.titulo}</span>
                <span className="text-[11px] font-normal opacity-75">{f.sub}</span>
              </RadioCard>
            ))}
            <RadioCard value="CORTESIA" className="col-span-2 h-12 border-dashed border-amber-600/60 text-amber-700 data-[state=checked]:border-amber-700 data-[state=checked]:bg-amber-700 dark:text-amber-400">
              <Gift /> <span className="font-semibold tracking-wide">CORTESIA</span> <span className="text-[11px] font-normal opacity-80">· autorização da diretoria</span>
            </RadioCard>
          </RadioGroup>
        </div>

        {forma === 'CREDITO' && (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Parcelas</Label>
              <Select value={parcelas} onValueChange={setParcelas}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}x de {moeda(total / n)}{n === 1 ? ' (à vista)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="pg-nsu">Nº de autorização da maquininha (NSU) <span className="font-normal text-muted-foreground">· opcional</span></Label><Input id="pg-nsu" value={nsu} onChange={(e) => setNsu(e.target.value)} maxLength={30} placeholder="Está no comprovante do cartão" /><p className="text-xs text-muted-foreground">Copie do comprovante impresso pela maquininha. Serve para o financeiro conferir o pagamento.</p></div>
          </div>
        )}
        {forma === 'DEBITO' && (
          <div className="grid gap-2"><Label htmlFor="pg-nsu">Nº de autorização da maquininha (NSU) <span className="font-normal text-muted-foreground">· opcional</span></Label><Input id="pg-nsu" value={nsu} onChange={(e) => setNsu(e.target.value)} maxLength={30} placeholder="Está no comprovante do cartão" /><p className="text-xs text-muted-foreground">Copie do comprovante impresso pela maquininha. Serve para o financeiro conferir o pagamento.</p></div>
        )}
        {forma === 'PIX' && (
          <div className="grid gap-2"><Label htmlFor="pg-pix">ID da transação Pix</Label><Input id="pg-pix" value={pix} onChange={(e) => setPix(e.target.value)} maxLength={40} /></div>
        )}
        {forma === 'DINHEIRO' && (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pg-recebido">Valor recebido (R$)</Label>
              <Input id="pg-recebido" value={recebido} onChange={(e) => { setRecebido(e.target.value); limparErro(); }} inputMode="decimal" placeholder="0,00" className="tabular h-12 text-right text-lg" />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Troco</span>
              <strong className="tabular text-xl">{moeda(troco)}</strong>
            </div>
          </div>
        )}
        {cortesia && (
          <div className="grid gap-3 rounded-lg border border-amber-600/40 bg-amber-500/10 p-3">
            <p className="text-sm">O paciente <strong>não paga</strong>. Só é liberada com o nome e a senha de quem autorizou na diretoria, e uma observação.</p>
            <div className="grid gap-2">
              <Label>Autorizado por (diretoria) *</Label>
              <Select value={diretor} onValueChange={(v) => { setDiretor(v); limparErro(); }}>
                <SelectTrigger aria-label="Autorizado por"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{DIRETORIA.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.nome} · {d.cargo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="pg-senha">Senha de autorização *</Label><Input id="pg-senha" type="password" autoComplete="off" value={senha} onChange={(e) => { setSenha(e.target.value); limparErro(); }} maxLength={30} /></div>
            <div className="grid gap-2"><Label htmlFor="pg-obs">Observação *</Label><Input id="pg-obs" value={observacao} onChange={(e) => { setObservacao(e.target.value); limparErro(); }} maxLength={160} placeholder="Ex.: colaborador, convênio institucional…" /></div>
          </div>
        )}

        {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{erro}</p>}

        <Button size="lg" className={cn('h-14 text-base font-bold tracking-wider', cortesia && 'bg-amber-700 hover:bg-amber-700/90')} disabled={vazio || !forma || enviando} onClick={finalizar}>
          {enviando ? <Loader2 className="animate-spin" /> : cortesia ? <Gift /> : <Wallet />}
          {cortesia ? 'AUTORIZAR CORTESIA' : 'FINALIZAR PAGAMENTO'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Depois de pago não há cancelamento nem estorno. Cada pagamento gera um recibo.</p>
      </CardContent>
    </Card>
  );
}
