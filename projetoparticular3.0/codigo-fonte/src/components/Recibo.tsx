import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HOSPITAL, NOMES_FORMA, TIPOS } from '@/services/config';
import { dataBR, horaBR, moeda, valorPorExtenso } from '@/lib/format';
import type { Pagamento } from '@/types';

/** Recibo (ou comprovante de cortesia) com impressão só do recibo. */
export function ReciboDialog({ pagamento, aoFechar }: { pagamento: Pagamento | null; aoFechar: () => void }) {
  const p = pagamento;
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="sr-only">Recibo</DialogTitle>
        <DialogDescription className="sr-only">Recibo do pagamento</DialogDescription>
        {p && <ConteudoRecibo p={p} />}
        <DialogFooter className="nao-imprimir">
          <Button variant="outline" onClick={aoFechar}>Fechar</Button>
          <Button onClick={() => window.print()}><Printer /> Imprimir recibo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoRecibo({ p }: { p: Pagamento }) {
  const referente = p.referente === 'CONSULTA' ? (TIPOS[p.tipoConsulta]?.descricao.toLowerCase() || 'consulta') : 'exames';
  const det = ([
    ['Forma de pagamento', NOMES_FORMA[p.forma]],
    p.cortesia && ['Autorizado por', `${p.cortesia.autorizadoPor} · ${p.cortesia.cargo}`],
    p.cortesia && ['Observação', p.cortesia.observacao || p.cortesia.motivo || '—'],
    (p.parcelas ?? 1) > 1 && ['Parcelas', `${p.parcelas}x de ${moeda(p.valor / (p.parcelas || 1))}`],
    p.autorizacao && ['Autorização (NSU)', p.autorizacao],
    p.idTransacao && ['ID da transação Pix', p.idTransacao],
    p.forma === 'DINHEIRO' && ['Valor recebido', moeda(p.recebido)],
    p.forma === 'DINHEIRO' && ['Troco', moeda(p.troco)],
    p.tipoConsulta === 'PRONTO_SOCORRO' ? ['Serviço', 'Pronto Socorro'] : p.medicoNome && ['Médico', p.medicoNome],
    ['Atendimento', `nº ${p.atendimentoNumero}`],
  ].filter(Boolean)) as [string, string][];

  return (
    <div id="area-recibo" className="rounded-md bg-white p-1 text-[13px] leading-relaxed text-neutral-900">
      <div className="flex flex-wrap justify-between gap-4 border-b-2 border-neutral-900 pb-3">
        <div className="flex flex-col">
          <strong className="text-base">{HOSPITAL.nome}</strong>
          <span>CNPJ {HOSPITAL.cnpj}</span>
          <span>{HOSPITAL.endereco}</span>
          <span>Tel. {HOSPITAL.telefone}</span>
        </div>
        <div className="flex flex-col items-end text-right">
          <h3 className="text-xl font-bold tracking-[0.2em]">{p.cortesia ? 'CORTESIA' : 'RECIBO'}</h3>
          <span>Nº {p.numeroRecibo}</span>
          <span>{dataBR(p.dataHora)} às {horaBR(p.dataHora)}</span>
          <span className="tabular mt-1 border-2 border-neutral-900 px-3 py-0.5 text-base font-bold">{moeda(p.valor)}</span>
        </div>
      </div>
      {p.cortesia ? (
        <p className="my-4">
          Declaramos que <strong>{p.pacienteNome}</strong>{p.cpf ? `, CPF ${p.cpf},` : ''} recebeu como <strong>cortesia</strong>, autorizada pela
          diretoria, o atendimento referente a {referente} no valor de <strong>{moeda(p.cortesia.valor)}</strong> ({valorPorExtenso(p.cortesia.valor)}),{' '}
          <strong>sem cobrança</strong>, conforme os itens abaixo.
        </p>
      ) : (
        <p className="my-4">
          Recebemos de <strong>{p.pacienteNome}</strong>{p.cpf ? `, CPF ${p.cpf},` : ''} a importância de <strong>{moeda(p.valor)}</strong> (
          {valorPorExtenso(p.valor)}), referente a {referente} em atendimento particular, conforme os itens abaixo.
        </p>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-900 text-left text-[11px] uppercase tracking-wide">
            <th className="py-1">Descrição</th><th className="py-1 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {p.itens.map((i, k) => (
            <tr key={k} className="border-b border-dotted border-neutral-300"><td className="py-1.5">{i.nome}</td><td className="tabular py-1.5 text-right">{moeda(i.valor)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          {p.desconto > 0 && (
            <>
              <tr><td className="pt-2">Subtotal</td><td className="tabular pt-2 text-right">{moeda(p.subtotal)}</td></tr>
              <tr><td>Desconto</td><td className="tabular text-right">− {moeda(p.desconto)}</td></tr>
            </>
          )}
          {p.cortesia && (
            <>
              <tr><td className="pt-2">Valor do serviço</td><td className="tabular pt-2 text-right">{moeda(p.subtotal)}</td></tr>
              <tr><td>Cortesia (diretoria)</td><td className="tabular text-right">− {moeda(p.cortesia.valor)}</td></tr>
            </>
          )}
          <tr className="border-t border-neutral-900 font-bold"><td className="pt-2">Total pago</td><td className="tabular pt-2 text-right">{moeda(p.valor)}</td></tr>
        </tfoot>
      </table>
      <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md bg-neutral-100 p-3 sm:grid-cols-2">
        {det.map(([k, v]) => (
          <div key={k}><span className="text-neutral-600">{k}:</span> <strong>{v}</strong></div>
        ))}
      </div>
      <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-neutral-600">
        <div className="border-t border-neutral-900 pt-1">Atendente</div>
        <div className="border-t border-neutral-900 pt-1">{p.cortesia ? `Diretoria · ${p.cortesia.autorizadoPor}` : 'Assinatura / carimbo'}</div>
      </div>
      <p className="mt-4 text-center text-[11px] text-neutral-500">
        {p.cortesia ? 'Comprovante de cortesia autorizada pela diretoria. Não houve pagamento.' : 'Este recibo comprova o pagamento e não substitui a nota fiscal.'}
      </p>
    </div>
  );
}
