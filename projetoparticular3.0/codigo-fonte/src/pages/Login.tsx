import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart3, CalendarCheck2, Eye, EyeOff, Landmark, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { HOSPITAL } from '@/services/config';

const esquema = z.object({
  login: z.string().trim().min(1, 'Informe o usuário.'),
  senha: z.string().min(1, 'Informe a senha.'),
});
type Dados = z.infer<typeof esquema>;

const RECURSOS = [
  { icone: CalendarCheck2, titulo: 'Agendamento simples', texto: 'Consulta, pagamento e exames pagos aos poucos, com recibo na hora.' },
  { icone: ShieldCheck, titulo: 'Cortesia com autorização', texto: 'Só sai com nome, senha e observação da diretoria.' },
  { icone: BarChart3, titulo: 'Estatísticas', texto: 'Consultas por mês, dia, hora e minuto.' },
  { icone: Landmark, titulo: 'Contábil separado', texto: 'Valores recebidos só para quem tem acesso.' },
];

export default function Login() {
  const { usuario, login } = useAuth();
  const navegar = useNavigate();
  const local = useLocation() as { state?: { de?: string } };
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const form = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { login: '', senha: '' } });

  if (usuario) return <Navigate to="/dashboard" replace />;

  async function enviar(d: Dados) {
    setErro('');
    try {
      const u = await login(d.login, d.senha);
      toast.success(`Bem-vindo(a), ${u.nome}!`);
      navegar(local.state?.de || '/dashboard', { replace: true });
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  const demo = (l: string, s: string) => {
    form.setValue('login', l, { shouldValidate: true });
    form.setValue('senha', s, { shouldValidate: true });
    setErro('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] dark:bg-background lg:flex-row">
      {/* 40% — boas-vindas e sobre o sistema */}
      <section className="relative overflow-hidden bg-medical-green px-6 py-8 text-white sm:px-10 lg:flex lg:w-2/5 lg:flex-col lg:justify-between lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <Logo tamanho="md" className="bg-white text-medical-green" />
          <div>
            <p className="text-lg font-bold">Particular Elite</p>
            <p className="text-sm text-white/75">{HOSPITAL.nome}</p>
          </div>
        </div>
        <div className="relative mt-8 lg:mt-0">
          <h2 className="text-3xl font-bold leading-tight lg:text-4xl">Bem-vindo(a) ao agendamento do atendimento particular</h2>
          <p className="mt-3 max-w-md text-white/80">
            Do pagamento da consulta até o último exame, tudo num só lugar — com recibo, cortesia autorizada e números claros.
          </p>
          <ul className="mt-8 hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-1">
            {RECURSOS.map((r) => (
              <li key={r.titulo} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><r.icone className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold">{r.titulo}</p>
                  <p className="text-sm text-white/75">{r.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-8 hidden text-xs text-white/60 lg:block">© {new Date().getFullYear()} {HOSPITAL.nome} · Protótipo</p>
      </section>

      {/* 60% — formulário */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader className="items-center text-center">
            <Logo tamanho="lg" />
            <CardTitle className="mt-3 text-2xl font-bold text-medical-green dark:text-primary">Entrar no sistema</CardTitle>
            <CardDescription className="text-[#666] dark:text-muted-foreground">Use seu usuário e senha do agendamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="login">Usuário</Label>
                <Input id="login" autoComplete="username" placeholder="Ex.: agendamento" autoFocus {...form.register('login')} aria-invalid={!!form.formState.errors.login} />
                {form.formState.errors.login && <p className="text-sm text-destructive">{form.formState.errors.login.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input id="senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...form.register('senha')} aria-invalid={!!form.formState.errors.senha} />
                  <button type="button" onClick={() => setVerSenha((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}>
                    {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.senha && <p className="text-sm text-destructive">{form.formState.errors.senha.message}</p>}
              </div>
              {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" role="alert">{erro}</p>}
              <Button type="submit" className="w-full bg-medical-green hover:opacity-90 hover:bg-medical-green" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />} Entrar
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium text-primary">Acesso de demonstração</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Clique para preencher e depois em Entrar.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => demo('admin', 'admin123')}>Administrador</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => demo('agendamento', 'agenda123')}>Agendamento</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
