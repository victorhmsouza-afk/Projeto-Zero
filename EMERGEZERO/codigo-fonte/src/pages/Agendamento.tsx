import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MousePointerClick, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReciboDialog } from '@/components/Recibo';
import { Fila } from '@/components/agendamento/Fila';
import { NovoAtendimento } from '@/components/agendamento/NovoAtendimento';
import { Comanda } from '@/components/agendamento/Comanda';
import { PainelPagamento } from '@/components/agendamento/PainelPagamento';
import { salvarNovoPaciente } from '@/components/agendamento/paciente';
import { rascunhoVazio, type DadosPagamento, type ItemPagar, type Rascunho } from '@/components/agendamento/tipos';
import { useAtendimentos, useAtualizar, usePagamentosDoAtendimento, usePrecos } from '@/hooks/use-dados';
import { toast } from '@/hooks/use-toast';
import { agoraIso, dataLocal } from '@/lib/format';
import { Banco } from '@/services/banco';
import { MEDICOS, nomeServico } from '@/services/config';
import { cancelado, finalizado, pago, podeCancelar } from '@/services/regras';
import { useAuth } from '@/hooks/use-auth';
import type { Atendimento, Medico, Paciente, Pagamento } from '@/types';

type Modo = 'vazio' | 'novo' | 'atendimento';

/**
 * AGENDAMENTO — três colunas: fila do dia | comanda (ou novo atendimento) | pagamento.
 * Fluxo: consulta → pagamento → consulta realizada → exames → pagamento dos exames (aos poucos).
 */
export default function Agendamento() {
  const [params, setParams] = useSearchParams();
  const { usuario } = useAuth();
  const [dia, setDia] = useState(dataLocal());
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState<Modo>('vazio');
  const [selId, setSelId] = useState<string | null>(null);
  const [r, setR] = useState<Rascunho>(rascunhoVazio);
  const [erroNovo, setErroNovo] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [recibo, setRecibo] = useState<Pagamento | null>(null);
  const [resetKey, setResetKey] = useState('0');

  const { data: atendimentos } = useAtendimentos(dia, dia);
  const { data: precos } = usePrecos();
  const atual = modo === 'atendimento' ? atendimentos?.find((a) => a.id === selId) : undefined;
  const { data: pagamentosAtual = [] } = usePagamentosDoAtendimento(atual?.id);
  const atualizar = useAtualizar();
  const limparPainel = () => setResetKey(String(Date.now()));

  // Atalhos vindos do Dashboard: #/agendamento?novo=1 ou #/agendamento?at=ID&dia=AAAA-MM-DD
  useEffect(() => {
    if (params.get('novo')) abrirNovo();
    const at = params.get('at');
    if (at) { if (params.get('dia')) setDia(params.get('dia')!); abrir(at); }
    if (params.toString()) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNovo() {
    setModo('novo'); setSelId(null); setR(rascunhoVazio()); setErroNovo(''); limparPainel();
  }
  function abrir(id: string) {
    setModo('atendimento'); setSelId(id); limparPainel();
    setSelecionados(new Set());
  }
  // ao abrir um atendimento, já marca todos os exames pendentes para pagar
  useEffect(() => {
    if (atual) setSelecionados(new Set(atual.exames.filter((x) => x.status === 'PENDENTE').map((x) => x.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, atual?.exames.length]);

  const fechar = () => { setModo('vazio'); setSelId(null); limparPainel(); };

  // ---------- O que está sendo cobrado ----------
  const itens: ItemPagar[] = useMemo(() => {
    if (modo === 'novo') {
      const ps = r.tipo === 'PRONTO_SOCORRO';
      const m = MEDICOS.find((x) => String(x.id) === r.medicoId);
      return (ps || m) && r.valor > 0 ? [{ nome: nomeServico(r.tipo, m?.nome), valor: r.valor }] : [];
    }
    if (atual && (cancelado(atual) || finalizado(atual))) return [];
    if (atual && !pago(atual)) return [{ nome: nomeServico(atual.tipo, atual.medicoNome), valor: atual.valorConsulta }];
    if (atual) return atual.exames.filter((x) => x.status === 'PENDENTE' && selecionados.has(x.id)).map((x) => ({ id: x.id, nome: x.nome, valor: x.valor }));
    return [];
  }, [modo, r, atual, selecionados]);

  const consultaAPagar = modo === 'novo' || (!!atual && !pago(atual));
  const dica = modo === 'novo'
    ? r.tipo === 'PRONTO_SOCORRO' ? 'Informe o valor do Pronto Socorro' : 'Escolha o médico para ver o valor'
    : modo === 'atendimento'
      ? atual && cancelado(atual) ? 'Atendimento cancelado. Nada a pagar.'
        : atual && finalizado(atual) ? 'Atendimento finalizado. Reabra para cobrar.'
        : atual?.consultaRealizadaEm ? 'Marque os exames que o paciente vai pagar agora' : 'Consulta já paga. Aguardando o médico.'
      : 'Nada a pagar';

  /** Confere o "Novo atendimento" e salva o paciente novo, se for o caso. */
  async function prepararNovo(): Promise<{ pac: Paciente; medico: Medico | null } | string> {
    const ps = r.tipo === 'PRONTO_SOCORRO';
    const medico = ps ? null : MEDICOS.find((m) => String(m.id) === r.medicoId) ?? null;
    if (!r.paciente && r.modoPaciente !== 'novo') return 'Escolha um paciente já cadastrado ou clique em "Novo paciente".';
    if (!ps && !medico) return 'Escolha o médico da consulta.';
    if (!(r.valor > 0)) return ps ? 'Informe o valor do Pronto Socorro.' : 'Informe o valor da consulta.';
    let pac = r.paciente;
    if (!pac) {
      try { pac = await salvarNovoPaciente(r.novo); } catch (e) { setErroNovo((e as Error).message); return 'Confira o cadastro do paciente.'; }
    }
    return { pac, medico };
  }

  const novoAtendimento = (pac: Paciente, medico: Medico | null, valor: number, quando: string) => Banco.salvarAtendimento({
    pacienteId: pac.id, pacienteNome: pac.nome, cpf: pac.cpf || '', telefone: pac.telefone || '',
    tipo: r.tipo, medicoId: medico?.id ?? null, medicoNome: medico?.nome || '', valorConsulta: valor, abertoEm: quando,
    consultaRealizadaEm: null, exames: [],
  });

  // ---------- Registrar na fila sem pagar (o paciente paga depois, ou desiste e é cancelado) ----------
  async function registrarSemPagar() {
    const ok = await prepararNovo();
    if (typeof ok === 'string') { setErroNovo(ok); return; }
    const at = await novoAtendimento(ok.pac, ok.medico, r.valor, agoraIso());
    setDia(dataLocal());
    await atualizar();
    abrir(at.id);
    toast.success('Atendimento registrado', `${ok.pac.nome} · nº ${at.numero} · aguardando pagamento`);
  }

  // ---------- Cancelar (só antes do pagamento) ----------
  async function cancelarAtendimento(motivo: string) {
    if (!atual || !podeCancelar(atual)) { toast.destructive('Não é possível cancelar', 'Este atendimento já tem pagamento.'); return; }
    await Banco.salvarAtendimento({ ...atual, cancelamento: { motivo, por: usuario?.nome || 'Usuário', em: agoraIso() } });
    await atualizar();
    limparPainel();
    toast.success('Atendimento cancelado', `${atual.pacienteNome} · nº ${atual.numero}`);
  }

  async function salvarAtendimento(a: Atendimento, aviso?: string) {
    await Banco.salvarAtendimento(a);
    await atualizar();
    if (aviso) toast.success(aviso);
  }

  // ---------- Finalizar pagamento ----------
  async function finalizar(d: DadosPagamento): Promise<string | void> {
    const base = {
      forma: d.forma, valor: d.valor, subtotal: d.subtotal, desconto: d.desconto,
      itens: itens.map(({ nome, valor }) => ({ nome, valor })), dataHora: agoraIso(),
      parcelas: d.parcelas, autorizacao: d.autorizacao, idTransacao: d.idTransacao, recebido: d.recebido, troco: d.troco,
    } as Omit<Pagamento, 'id' | 'numeroRecibo' | 'referente' | 'atendimentoId' | 'atendimentoNumero' | 'pacienteNome' | 'medicoNome' | 'tipoConsulta'>;

    if (d.cortesia) {
      const aut = await Banco.autorizarCortesia({ diretorId: d.cortesia.diretorId, senha: d.cortesia.senha });
      if (!aut.ok) return aut.motivo;
      base.cortesia = { valor: d.subtotal, autorizadoPor: aut.diretor.nome, cargo: aut.diretor.cargo, diretorId: aut.diretor.id, observacao: d.cortesia.observacao, autorizadoEm: base.dataHora };
    }

    if (modo === 'novo') {
      const ok = await prepararNovo();
      if (typeof ok === 'string') return ok;
      const { pac, medico } = ok;
      let at = await novoAtendimento(pac, medico, d.subtotal, base.dataHora);
      const salvo = await Banco.registrarPagamento({
        ...base, referente: 'CONSULTA', atendimentoId: at.id, atendimentoNumero: at.numero,
        pacienteNome: pac.nome, cpf: pac.cpf || '', medicoNome: medico?.nome || '', tipoConsulta: r.tipo,
      });
      at = await Banco.salvarAtendimento({ ...at, pagamentoConsultaId: salvo.id });
      setDia(dataLocal());
      await atualizar();
      abrir(at.id);
      setRecibo(salvo);
      toast.success(d.cortesia ? 'Cortesia autorizada' : 'Pagamento registrado', `${pac.nome} · recibo nº ${salvo.numeroRecibo}`);
      return;
    }

    // Consulta registrada antes e paga agora
    if (atual && !pago(atual)) {
      if (cancelado(atual)) return 'Este atendimento foi cancelado.';
      const salvo = await Banco.registrarPagamento({
        ...base, referente: 'CONSULTA', atendimentoId: atual.id, atendimentoNumero: atual.numero,
        pacienteNome: atual.pacienteNome, cpf: atual.cpf || '', medicoNome: atual.medicoNome, tipoConsulta: atual.tipo,
      });
      await Banco.salvarAtendimento({ ...atual, valorConsulta: d.subtotal, pagamentoConsultaId: salvo.id });
      limparPainel();
      await atualizar();
      setRecibo(salvo);
      toast.success(d.cortesia ? 'Cortesia autorizada' : 'Pagamento registrado', `${atual.pacienteNome} · recibo nº ${salvo.numeroRecibo}`);
      return;
    }

    if (atual) {
      const ids = itens.map((i) => i.id);
      const salvo = await Banco.registrarPagamento({
        ...base, referente: 'EXAMES', atendimentoId: atual.id, atendimentoNumero: atual.numero,
        pacienteNome: atual.pacienteNome, cpf: atual.cpf || '', medicoNome: atual.tipo === 'PRONTO_SOCORRO' ? '' : atual.medicoNome, tipoConsulta: atual.tipo,
      });
      await Banco.salvarAtendimento({
        ...atual,
        exames: atual.exames.map((x) => (ids.includes(x.id) ? { ...x, status: 'PAGO', pagoEm: salvo.dataHora, pagamentoId: salvo.id } : x)),
      });
      setSelecionados(new Set());
      limparPainel();
      await atualizar();
      setRecibo(salvo);
      toast.success(d.cortesia ? 'Cortesia autorizada' : 'Pagamento dos exames registrado', `Recibo nº ${salvo.numeroRecibo}`);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Agendamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">Consulta → pagamento → consulta realizada → exames → pagamento dos exames.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_340px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Fila
          atendimentos={atendimentos}
          dia={dia}
          setDia={(d) => { setDia(d || dataLocal()); fechar(); }}
          busca={busca}
          setBusca={setBusca}
          selecionadoId={modo === 'atendimento' ? selId : null}
          aoAbrir={abrir}
          aoNovo={abrirNovo}
        />
        <div className="min-w-0">
          {modo === 'novo' && <NovoAtendimento r={r} setR={(f) => { setR(f); }} precos={precos} erro={erroNovo} setErro={setErroNovo} aoCancelar={fechar} aoRegistrar={registrarSemPagar} />}
          {modo === 'atendimento' && atual && (
            <Comanda
              a={atual}
              pagamentos={pagamentosAtual}
              precos={precos}
              selecionados={selecionados}
              setSelecionados={setSelecionados}
              aoSalvar={salvarAtendimento}
              aoRecibo={setRecibo}
              aoFechar={fechar}
              aoCancelar={cancelarAtendimento}
            />
          )}
          {(modo === 'vazio' || (modo === 'atendimento' && !atual)) && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary"><MousePointerClick className="h-7 w-7" /></span>
                <h2 className="text-lg font-semibold">Nenhum paciente aberto</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Clique em <strong>Novo atendimento</strong> para cobrar uma consulta, ou escolha um paciente na fila para cobrar os exames.
                </p>
                <Button onClick={abrirNovo} className="mt-2"><Plus /> Novo atendimento</Button>
              </CardContent>
            </Card>
          )}
        </div>
        <PainelPagamento
          itens={itens}
          rotulo={consultaAPagar ? 'Consulta' : modo === 'atendimento' ? 'Exames' : ''}
          dicaVazio={dica}
          resetKey={resetKey}
          aoFinalizar={finalizar}
        />
      </div>
      <ReciboDialog pagamento={recibo} aoFechar={() => setRecibo(null)} />
    </>
  );
}
