import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { HOSPITAL } from '@/services/config';
import { MENU } from './menu';
import { Logo } from './Logo';

/**
 * Sidebar verde e autorretrátil:
 * - no computador fica recolhida (só ícones) e se expande ao passar o mouse;
 * - no celular abre como gaveta pelo botão de menu do topo.
 */
export function Sidebar({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const { usuario, pode, logout } = useAuth();
  const itens = MENU.filter((m) => pode(...m.perfis));
  // Depois de escolher uma aba, a sidebar se recolhe e só volta a abrir quando o mouse sair e entrar de novo.
  const [recolher, setRecolher] = useState(false);
  const escolher = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.blur(); setRecolher(true); aoFechar(); };

  return (
    <>
      {/* fundo escuro da gaveta no celular */}
      <div
        className={cn('fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden', aberta ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={aoFechar}
        aria-hidden="true"
      />
      <aside
        aria-label="Menu principal"
        onMouseLeave={() => setRecolher(false)}
        data-recolher={recolher || undefined}
        className={cn(
          'group/sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-[width,transform] duration-200 ease-out',
          'md:w-16 md:translate-x-0 md:shadow-none md:has-[:focus-visible]:w-64',
          !recolher && 'md:hover:w-64 md:hover:shadow-xl',
          aberta ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-3">
          <Logo className="bg-white text-medical-green" />
          <div className="min-w-0 transition-opacity duration-150 md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-data-[recolher]/sidebar:opacity-0 md:group-has-[:focus-visible]/sidebar:opacity-100">
            <p className="truncate text-sm font-bold text-white">Particular Elite</p>
            <p className="truncate text-xs text-sidebar-foreground/80">{HOSPITAL.nome}</p>
          </div>
          <button type="button" onClick={aoFechar} className="ml-auto rounded-md p-1 hover:bg-sidebar-accent md:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
          {itens.map((m) => (
            <NavLink
              key={m.rota}
              to={m.rota}
              onClick={escolher}
              title={m.titulo}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-muted text-primary shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
                )
              }
            >
              <m.icone className="h-5 w-5 shrink-0" strokeWidth={2.2} />
              <span className="min-w-0 flex-1 truncate transition-opacity duration-150 md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-data-[recolher]/sidebar:opacity-0 md:group-has-[:focus-visible]/sidebar:opacity-100">
                {m.titulo}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="mb-1 truncate px-3 py-1 text-xs text-sidebar-foreground/80 transition-opacity md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-data-[recolher]/sidebar:opacity-0">
            {usuario?.nome}
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sair"
            className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="truncate transition-opacity md:opacity-0 md:group-hover/sidebar:opacity-100 md:group-data-[recolher]/sidebar:opacity-0">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
