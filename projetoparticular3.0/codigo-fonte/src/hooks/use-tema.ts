import { useEffect, useState } from 'react';

export type Tema = 'light' | 'dark';

/** Tema claro/escuro, salvo no navegador. */
export function useTema() {
  const [tema, setTema] = useState<Tema>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    try { localStorage.setItem('pe.tema', tema); } catch { /* ignore */ }
  }, [tema]);
  return { tema, alternar: () => setTema((t) => (t === 'dark' ? 'light' : 'dark')) };
}
