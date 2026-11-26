import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Perfil, Usuario } from '@/types';
import { entrar, sair, sessaoAtual } from '@/services/auth';

interface AuthContexto {
  usuario: Usuario | null;
  login: (login: string, senha: string) => Promise<Usuario>;
  logout: () => void;
  pode: (...perfis: Perfil[]) => boolean;
}

const Ctx = createContext<AuthContexto | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => sessaoAtual());
  const valor: AuthContexto = {
    usuario,
    async login(l, s) {
      const u = await entrar(l, s);
      setUsuario(u);
      return u;
    },
    logout() {
      sair();
      setUsuario(null);
    },
    pode: (...perfis) => !!usuario && perfis.includes(usuario.perfil),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return c;
}
