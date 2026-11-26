import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Clock3, Plus, Siren, Stethoscope, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { GraficoConsultas, LegendaConsultas } from '@/components/GraficoConsultas';
import { useAtendimentos } from '@/hooks/use-dados';
import { useAuth } from '@/hooks/use-auth';
import { dataLocal, horaBR } from '@/lib/format';
import { TIPOS } from '@/services/config';
import { concluido, situacao } from '@/services/regras';

/** Resumo do dia — só quantidades (os valores ficam no Contábil). */
export default function Dashboard() {
  const { usuario } = useAuth();
  const hoje = dataLocal();
  const ontemD = new Date(); ontemD.setDate(ontemD.getDate() - 1);
  const ontem = dataLocal(ontemD);
  const { data: lista, isLoading } = useAtendimentos(ontem, hoje);
  const doDia = (lista || []).filter((a) => a.abertoEm.startsWith(hoje));
  const nOntem = (lista || []).filter((a) => a.abertoEm.startsWith(ontem)).length;
  const andamento = doDia.filter((a) => !concluido(a)).sort((a, b) => a.abertoEm.localeCompare(b.abertoEm));
  const aguardando = doDia.filter((a) => !a.consultaRealizadaEm).length;
  const nCons = doDia.filter((a) => a.tipo === 'CONSULTA').length;
  const nPs = doDia.length - nCons;
  const horas = Array.from({ length: 24 }, (_, h) => ({ rotulo: `${String(h).padStart(2, '0')}h`, longo: `${String(h).padStart(2, '0')}:00 às ${String(h).padStart(2, '0')}:59`, consulta: 0, ps: 0 }));
  doDia.forEach((a) => { const h = Number(a.abertoEm.slice(11, 13)); horas[h][a.tipo === 'PRONTO_SOCORRO' ? 'ps' : 'consulta']++; });
  const hAtual = new Date().getHours();
  const visiveis = horas.slice(Math.min(7, ...doDia.map((a) => Number(a.abertoEm.slice(11, 13)))), Math.max(hAtual + 1, 19));
  const saudacao = hAtual < 12 ? 'Bom dia' : hAtual < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <PageHeader
        titulo={`${saudacao}, ${usuario?.nome.split(' ')[0]}!`}
        subtitulo="Resumo do atendimento particular de hoje."
        acoes={<>
          <Button asChild variant="outline"><Link to="/estatisticas"><BarChart3 /> Estatísticas</Link></Button>
          <Button asChild><Link to="/agendamento?novo=1"><Plus /> Novo atendimento</Link></Button>
        </>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />) : (
          <>
            <StatCard titulo="Atendimentos hoje" valor={doDia.length} detalhe={`ontem: ${nOntem}`} icone={Users} destaque />
            <StatCard titulo="Em andamento" valor={andamento.length} detalhe={`${aguardando} aguardando consulta`} icone={Activity} cor="laranja" />
            <StatCard titulo="Consultas eletivas" valor={nCons} detalhe={doDia.length ? `${Math.round((nCons / doDia.length) * 100)}% do dia` : 'nenhuma ainda'} icone={Stethoscope} cor="azul" />
            <StatCard titulo="Pronto Socorro" valor={nPs} detalhe={doDia.length ? `${Math.round((nPs / doDia.length) * 100)}% do dia` : 'nenhum ainda'} icone={Siren} cor="vermelho" />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-primary">Atendimentos por hora</CardTitle>
              <CardDescription className="mt-1">Hoje, pela hora de abertura.</CardDescription>
            </div>
            <LegendaConsultas />
          </CardHeader>
          <CardContent>
            {doDia.length ? <GraficoConsultas dados={visiveis} altura={260} /> : (
              <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-6 w-6" /> Nenhum atendimento hoje ainda.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Em andamento agora</CardTitle>
            <CardDescription>Pacientes que ainda não terminaram. Clique para abrir no agendamento.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {!andamento.length && <p className="px-6 pb-6 text-sm text-muted-foreground">Ninguém em andamento. 🎉</p>}
            <ul className="divide-y">
              {andamento.slice(0, 8).map((a) => {
                const s = situacao(a);
                return (
                  <li key={a.id}>
                    <Link to={`/agendamento?at=${a.id}&dia=${hoje}`} className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-muted/60">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.pacienteNome}</p>
                        <p className="text-xs text-muted-foreground">{horaBR(a.abertoEm)} · {TIPOS[a.tipo].nome} · nº {a.numero}</p>
                      </div>
                      <div className="flex items-center gap-2"><Badge variant={s.variante}>{s.texto}</Badge><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {andamento.length > 8 && <p className="px-6 pt-2 text-xs text-muted-foreground">+ {andamento.length - 8} no agendamento</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
