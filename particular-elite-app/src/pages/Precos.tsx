import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, RotateCcw, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { useConfirmar } from '@/components/Confirmar';
import { useAtualizar, usePrecos } from '@/hooks/use-dados';
import { toast } from '@/hooks/use-toast';
import { lerMoeda, moeda, valorCampo } from '@/lib/format';
import { Banco } from '@/services/banco';
import { DIRETORIA, MEDICOS } from '@/services/config';
import type { TabelaPrecos } from '@/types';

const esquemaExame = z.object({
  categoria: z.string().trim().min(2, 'Informe a categoria.'),
  nome: z.string().trim().min(2, 'Informe o nome do exame.'),
  valor: z.string().refine((v) => lerMoeda(v) > 0, 'Informe um valor maior que zero.'),
});
type NovoExame = z.infer<typeof esquemaExame>;

/** PREÇOS — valores usados no caixa (salvos ao sair de cada campo). */
export default function Precos() {
  const { data: precos } = usePrecos();
  const atualizar = useAtualizar();
  const confirmar = useConfirmar();
  const [filtro, setFiltro] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const form = useForm<NovoExame>({ resolver: zodResolver(esquemaExame), defaultValues: { categoria: '', nome: '', valor: '' } });
  const categorias = useMemo(() => [...new Set(precos?.exames.map((e) => e.categoria))], [precos]);

  async function salvar(novo: TabelaPrecos, aviso = 'Preço salvo') {
    await Banco.salvarPrecos(novo);
    await atualizar();
    toast.success(aviso);
  }
  if (!precos) return null;

  const mudarCampo = (campo: 'prontoSocorro' | 'adicionalContraste', texto: string) => {
    const v = lerMoeda(texto);
    if (v !== precos[campo]) salvar({ ...precos, [campo]: v });
  };
  const mudarExame = (nome: string, texto: string) => {
    const v = lerMoeda(texto);
    const atual = precos.exames.find((e) => e.nome === nome);
    if (atual && v !== atual.valor) salvar({ ...precos, exames: precos.exames.map((e) => (e.nome === nome ? { ...e, valor: v } : e)) }, `${nome}: ${moeda(v)}`);
  };
  async function incluir(d: NovoExame) {
    if (precos!.exames.some((e) => e.nome.toLowerCase() === d.nome.trim().toLowerCase())) {
      form.setError('nome', { message: 'Já existe um exame com esse nome.' });
      return;
    }
    await salvar({ ...precos!, exames: [...precos!.exames, { categoria: d.categoria.trim(), nome: d.nome.trim(), valor: lerMoeda(d.valor) }] }, 'Exame incluído');
    form.reset();
  }
  async function restaurar() {
    if (!(await confirmar({ titulo: 'Restaurar preços', texto: 'Voltar todos os preços para a tabela padrão? Exames incluídos por você serão removidos.', botao: 'Restaurar', perigo: true }))) return;
    await Banco.restaurarPrecos();
    await atualizar();
    toast.success('Preços restaurados');
  }

  const t = filtro.trim().toLowerCase();
  const lista = precos.exames.filter((e) => (categoria === 'todas' || e.categoria === categoria) && (!t || e.nome.toLowerCase().includes(t)));

  return (
    <>
      <PageHeader
        titulo="Preços"
        subtitulo="Valores usados no caixa. Cada alteração é salva ao sair do campo."
        acoes={<Button variant="outline" onClick={restaurar}><RotateCcw /> Restaurar padrão</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><Stethoscope className="h-5 w-5" /> Consultas</CardTitle>
            <CardDescription>Pronto Socorro tem valor único; a consulta eletiva usa o valor de cada médico.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pr-ps">Pronto Socorro (R$)</Label>
                <Input id="pr-ps" key={precos.prontoSocorro} defaultValue={valorCampo(precos.prontoSocorro)} onBlur={(e) => mudarCampo('prontoSocorro', e.target.value)} inputMode="decimal" className="tabular text-right" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pr-contraste">Adicional de contraste (R$)</Label>
                <Input id="pr-contraste" key={precos.adicionalContraste} defaultValue={valorCampo(precos.adicionalContraste)} onBlur={(e) => mudarCampo('adicionalContraste', e.target.value)} inputMode="decimal" className="tabular text-right" />
              </div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Médico (consulta eletiva)</TableHead><TableHead>Especialidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>{MEDICOS.map((m) => <TableRow key={m.id}><TableCell className="font-medium">{m.nome}</TableCell><TableCell>{m.especialidade}</TableCell><TableCell className="tabular text-right">{moeda(m.valorConsulta)}</TableCell></TableRow>)}</TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">Os médicos e o valor de cada um ficam em <code className="rounded bg-muted px-1">src/services/config.ts</code>.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /> Diretoria · autoriza cortesias</CardTitle>
            <CardDescription>Cortesia = o paciente não paga, com nome e senha de alguém desta lista e uma observação.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cargo</TableHead></TableRow></TableHeader>
              <TableBody>{DIRETORIA.map((d) => <TableRow key={d.id}><TableCell className="font-medium">{d.nome}</TableCell><TableCell>{d.cargo}</TableCell></TableRow>)}</TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">Nomes e senhas em <code className="rounded bg-muted px-1">src/services/config.ts</code>. No sistema do hospital, a senha deve ser conferida no servidor.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-primary">Exames</CardTitle>
          <CardDescription>{precos.exames.length} exames na tabela. Qualquer "Raio-X de …" usa o preço do Raio-X.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form onSubmit={form.handleSubmit(incluir)} className="grid gap-4 rounded-lg border border-dashed p-4 md:grid-cols-[1fr_2fr_1fr_auto] md:items-end" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="nx-cat">Categoria</Label>
              <Input id="nx-cat" list="nx-categorias" placeholder="Ex.: Laboratório" {...form.register('categoria')} />
              <datalist id="nx-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              {form.formState.errors.categoria && <p className="text-xs text-destructive">{form.formState.errors.categoria.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nx-nome">Nome do exame</Label>
              <Input id="nx-nome" {...form.register('nome')} />
              {form.formState.errors.nome && <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nx-valor">Valor (R$)</Label>
              <Input id="nx-valor" inputMode="decimal" placeholder="0,00" className="tabular text-right" {...form.register('valor')} />
              {form.formState.errors.valor && <p className="text-xs text-destructive">{form.formState.errors.valor.message}</p>}
            </div>
            <Button type="submit"><Plus /> Incluir exame</Button>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar exame" className="pl-9" type="search" />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="sm:w-60" aria-label="Categoria"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead>Categoria</TableHead><TableHead>Exame</TableHead><TableHead className="text-right">Valor (R$)</TableHead></TableRow></TableHeader>
              <TableBody>
                {lista.map((e) => (
                  <TableRow key={e.nome}>
                    <TableCell><Badge variant="outline">{e.categoria}</Badge></TableCell>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="text-right">
                      <Input key={e.valor} defaultValue={valorCampo(e.valor)} onBlur={(ev) => mudarExame(e.nome, ev.target.value)} inputMode="decimal" className="tabular ml-auto h-9 w-28 text-right" aria-label={`Valor de ${e.nome}`} />
                    </TableCell>
                  </TableRow>
                ))}
                {!lista.length && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nenhum exame encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
