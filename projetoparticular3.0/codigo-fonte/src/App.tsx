import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmarProvider } from '@/components/Confirmar';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import type { Perfil } from '@/types';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Agendamento from '@/pages/Agendamento';
import Estatisticas from '@/pages/Estatisticas';
import FilaPS from '@/pages/FilaPS';
import Contabil from '@/pages/Contabil';
import Precos from '@/pages/Precos';
import NaoEncontrada from '@/pages/NaoEncontrada';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } } });

/** Só entra quem fez login (e, se informado, com o perfil certo). */
function Protegida({ children, perfis }: { children: ReactNode; perfis?: Perfil[] }) {
  const { usuario, pode } = useAuth();
  const { pathname } = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ de: pathname }} />;
  if (perfis && !pode(...perfis)) return <NaoEncontrada />;
  return <>{children}</>;
}

// HashRouter: as rotas ficam depois do "#" (ex.: index.html#/agendamento) — nunca dá 404 no servidor.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <AuthProvider>
          <ConfirmarProvider>
            <HashRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Protegida><AppLayout /></Protegida>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/agendamento" element={<Agendamento />} />
                  <Route path="/caixa" element={<Navigate to="/agendamento" replace />} />
                  <Route path="/fila-ps" element={<FilaPS />} />
                  <Route path="/estatisticas" element={<Estatisticas />} />
                  <Route path="/contabil" element={<Protegida perfis={['ADMIN']}><Contabil /></Protegida>} />
                  <Route path="/precos" element={<Protegida perfis={['ADMIN']}><Precos /></Protegida>} />
                  <Route path="*" element={<NaoEncontrada />} />
                </Route>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </HashRouter>
            <Toaster />
          </ConfirmarProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
