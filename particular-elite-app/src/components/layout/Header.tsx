import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Clock, Menu, Moon, RefreshCw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { useTema } from '@/hooks/use-tema';
import { HOSPITAL } from '@/services/config';
import { cn } from '@/lib/utils';
import { MENU } from './menu';
import { Logo } from './Logo';

const iniciais = (nome: string) => {
  const p = nome.split(' ').filter((x) => x.length > 2);
  return (p.length > 1 ? p[0][0] + p[1][0] : nome.slice(0, 2)).toUpperCase();
};

/** Topo fixo: logo, nome do sistema, página atual, última atualização, tema e usuário. */
export function Header({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const { usuario } = useAuth();
  const { tema, alternar } = useTema();
  const { pathname } = useLocation();
  const pagina = MENU.find((m) => pathname.startsWith(m.rota));
  const qc = useQueryClient();
  const carregando = useIsFetching() > 0;
  const [atualizado, setAtualizado] = useState(() => new Date());
  const [agora, setAgora] = useState(() => new Date());

  // "Atualizado às": hora da última leitura dos dados
  useEffect(() => {
    return qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'success') setAtualizado(new Date());
    });
  }, [qc]);
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <header className="sticky top-0 z-30 border-b bg-card">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={aoAbrirMenu} aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </Button>
        <Logo tamanho="sm" className="md:hidden" />
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight text-primary">
            Particular Elite
            {pagina && <span className="hidden font-medium text-muted-foreground sm:inline"> · {pagina.titulo}</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {HOSPITAL.nome} · {agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => qc.invalidateQueries()}
                className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted sm:flex"
              >
                {carregando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                <span className="tabular">Atualizado às {hora(atualizado)}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Clique para atualizar os dados</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={alternar} aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
                {tema === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tema === 'dark' ? 'Tema claro' : 'Tema escuro'}</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2 border-l pl-2 sm:pl-3">
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-primary')}>
              {iniciais(usuario?.nome || '')}
            </span>
            <div className="hidden leading-tight lg:block">
              <p className="text-sm font-medium">{usuario?.nome}</p>
              <Badge variant={usuario?.perfil === 'ADMIN' ? 'default' : 'secondary'} className="mt-0.5 px-2 py-0 text-[10px]">
                {usuario?.perfil === 'ADMIN' ? 'Administrador' : 'Caixa'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
