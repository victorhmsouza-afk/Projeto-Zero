import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/** Moldura das páginas internas: sidebar à esquerda, topo fixo e conteúdo. */
export function AppLayout() {
  const [menuAberto, setMenuAberto] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
      <div className="md:pl-16">
        <Header aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
