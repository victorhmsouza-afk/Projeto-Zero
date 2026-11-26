import { useEffect, useState } from 'react';
import { Search, Stethoscope, Siren, UserPlus, UserRoundCheck, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioCard, RadioGroup } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dataBR, idade, lerMoeda, mascaraCpf, mascaraTelefone, moeda, valorCampo } from '@/lib/format';
import { MEDICOS, nomeServico, TIPOS } from '@/services/config';
import { Banco } from '@/services/banco';
import { toast } from '@/hooks/use-toast';
import type { Paciente, TabelaPrecos } from '@/types';
import { salvarNovoPaciente } from './paciente';
import type { Rascunho } from './tipos';

interface Props {
  r: Rascunho;
  setR: (f: (r: Rascunho) => Rascunho) => void;
  precos: TabelaPrecos | undefined;
  erro: string;
  setErro: (e: string) => void;
  aoCancelar: () => void;
}

/** Passo 1: escolher/cadastrar o paciente e o serviço (Consulta ou Pronto Socorro). */
export function NovoAtendimento({ r, setR, precos, erro, setErro, aoCancelar }: Props) {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Paciente[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = busca.trim();
    if (t.length < 2) { setAchados([]); return; }
    let vivo = true;
    Banco.buscarPacientes(t).then((l) => vivo && setAchados(l.slice(0, 8)));
    return () => { vivo = false; };
  }, [busca]);

  const valorPadrao = (tipo: Rascunho['tipo'], medicoId: string) =>
    tipo === 'PRONTO_SOCORRO' ? precos?.prontoSocorro || 0 : MEDICOS.find((m) => String(m.id) === medicoId)?.valorConsulta || 0;
  const campoNovo = (k: keyof Rascunho['novo'], v: string) => { setErro(''); setR((x) => ({ ...x, novo: { ...x.novo, [k]: v } })); };
  const irParaNovo = () => {
    const t = busca.trim();
    setR((x) => ({ ...x, modoPaciente: 'novo', novo: { ...x.novo, nome: t && !/\d/.test(t) ? t : x.novo.nome, cpf: /\d/.test(t) ? mascaraCpf(t) : x.novo.cpf } }));
  };
  async function salvarPaciente() {
    setSalvando(true);
    try {
      const p = await salvarNovoPaciente(r.novo);
      setR((x) => ({ ...x, paciente: p, modoPaciente: 'buscar', novo: { nome: '', cpf: '', nascimento: '', telefone: '', email: '' } }));
      toast.success('Paciente cadastrado', p.nome);
      setErro('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const p = r.paciente;
  const ps = r.tipo === 'PRONTO_SOCORRO';
  const medico = MEDICOS.find((m) => String(m.id) === r.medicoId);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b">
        <div>
          <CardTitle className="text-xl text-primary">Novo atendimento</CardTitle>
          <CardDescription className="mt-1">1. Paciente · 2. Serviço · 3. Pagamento no painel ao lado.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={aoCancelar}><X /> Cancelar</Button>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6">
        {/* ---------- 1. Paciente ---------- */}
        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> Paciente
          </h3>
          {p ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-medical-green-light p-4">
              <div className="flex items-center gap-3">
                <UserRoundCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">{p.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.cpf && `CPF ${p.cpf}`, p.nascimento && `${dataBR(p.nascimento)} (${idade(p.nascimento)} anos)`, p.telefone, p.email].filter(Boolean).join(' · ') || 'Paciente cadastrado'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setR((x) => ({ ...x, paciente: null }))}>Trocar</Button>
            </div>
          ) : (
            <>
              <RadioGroup value={r.modoPaciente} onValueChange={(v) => { setErro(''); setR((x) => ({ ...x, modoPaciente: v as Rascunho['modoPaciente'] })); }} className="grid-cols-2">
                <RadioCard value="buscar" className="h-11"><Search /> Paciente já cadastrado</RadioCard>
                <RadioCard value="novo" className="h-11"><UserPlus /> Novo paciente</RadioCard>
              </RadioGroup>

              {r.modoPaciente === 'buscar' ? (
                <div className="grid gap-2">
                  <Label htmlFor="busca-paciente">Buscar por nome ou CPF</Label>
                  <Input id="busca-paciente" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite ao menos 2 letras ou números" autoFocus />
                  {busca.trim().length >= 2 && (
                    <ul className="divide-y overflow-hidden rounded-md border">
                      {achados.map((a) => (
                        <li key={a.id}>
                          <button type="button" onClick={() => setR((x) => ({ ...x, paciente: a }))} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted">
                            <span className="font-medium">{a.nome}</span>
                            <span className="text-xs text-muted-foreground">{a.cpf || a.telefone}</span>
                          </button>
                        </li>
                      ))}
                      {!achados.length && (
                        <li>
                          <button type="button" onClick={irParaNovo} className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted">
                            Nenhum paciente encontrado. <strong className="text-primary">+ Cadastrar como novo paciente</strong>
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Não achou? <button type="button" className="font-medium text-primary hover:underline" onClick={irParaNovo}>+ Cadastrar novo paciente</button>
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 rounded-lg border border-dashed border-primary/40 bg-muted/40 p-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nv-nome">Nome completo *</Label>
                    <Input id="nv-nome" value={r.novo.nome} onChange={(e) => campoNovo('nome', e.target.value)} maxLength={120} autoFocus />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="nv-cpf">CPF</Label>
                      <Input id="nv-cpf" value={r.novo.cpf} onChange={(e) => campoNovo('cpf', mascaraCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nv-nascimento">Data de nascimento</Label>
                      <Input id="nv-nascimento" type="date" value={r.novo.nascimento} onChange={(e) => campoNovo('nascimento', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nv-telefone">Telefone</Label>
                      <Input id="nv-telefone" value={r.novo.telefone} onChange={(e) => campoNovo('telefone', mascaraTelefone(e.target.value))} inputMode="tel" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="nv-email">E-mail</Label>
                    <Input id="nv-email" type="email" value={r.novo.email} onChange={(e) => campoNovo('email', e.target.value)} maxLength={120} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">* obrigatório. O cadastro também é salvo ao finalizar o pagamento.</p>
                    <Button type="button" onClick={salvarPaciente} disabled={salvando}><UserPlus /> Salvar paciente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ---------- 2. Serviço ---------- */}
        <section className="grid gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span> Serviço
          </h3>
          <RadioGroup
            value={r.tipo}
            onValueChange={(v) => setR((x) => ({ ...x, tipo: v as Rascunho['tipo'], valor: valorPadrao(v as Rascunho['tipo'], x.medicoId) }))}
            className="grid-cols-2"
          >
            <RadioCard value="CONSULTA" className="h-auto flex-col py-3"><Stethoscope className="!h-5 !w-5" /> Consulta <span className="text-xs font-normal opacity-80">eletiva, com médico</span></RadioCard>
            <RadioCard value="PRONTO_SOCORRO" className="h-auto flex-col py-3"><Siren className="!h-5 !w-5" /> Pronto Socorro <span className="text-xs font-normal opacity-80">médico de plantão</span></RadioCard>
          </RadioGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            {ps ? (
              <div className="grid gap-2">
                <Label>Serviço</Label>
                <div className="flex h-10 items-center rounded-md border border-l-4 border-l-primary bg-muted/50 px-3 text-sm">
                  <strong>Pronto Socorro</strong><span className="ml-2 text-muted-foreground">· médico de plantão</span>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="nv-medico">Médico *</Label>
                <Select value={r.medicoId} onValueChange={(v) => setR((x) => ({ ...x, medicoId: v, valor: valorPadrao(x.tipo, v) }))}>
                  <SelectTrigger id="nv-medico"><SelectValue placeholder="Selecione o médico" /></SelectTrigger>
                  <SelectContent>
                    {MEDICOS.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.nome} · {m.especialidade} · {moeda(m.valorConsulta)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="nv-valor">Valor (R$)</Label>
              <Input
                id="nv-valor"
                key={`${r.tipo}-${r.medicoId}-${r.valor}`}
                defaultValue={valorCampo(r.valor)}
                onBlur={(e) => setR((x) => ({ ...x, valor: lerMoeda(e.target.value) }))}
                inputMode="decimal"
                placeholder="0,00"
                className="tabular text-right"
              />
            </div>
          </div>
          {(ps || medico) && r.valor > 0 && (
            <div className="flex items-center justify-between rounded-md border bg-card px-4 py-3">
              <div>
                <p className="font-medium">{nomeServico(r.tipo, medico?.nome)}</p>
                <p className="text-xs text-muted-foreground">{TIPOS[r.tipo].descricao}</p>
              </div>
              <div className="flex items-center gap-3"><Badge variant="warning">A pagar</Badge><span className="tabular font-semibold">{moeda(r.valor)}</span></div>
            </div>
          )}
        </section>

        {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{erro}</p>}
      </CardContent>
    </Card>
  );
}
