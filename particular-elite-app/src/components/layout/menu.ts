import { BarChart3, Landmark, LayoutDashboard, Tags, Wallet, type LucideIcon } from 'lucide-react';
import type { Perfil } from '@/types';

export interface ItemMenu {
  rota: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  perfis: Perfil[];
}

/** Abas do sistema (sidebar). `perfis` define quem vê cada uma. */
export const MENU: ItemMenu[] = [
  { rota: '/dashboard', titulo: 'Dashboard', descricao: 'Resumo do dia', icone: LayoutDashboard, perfis: ['ADMIN', 'CAIXA'] },
  { rota: '/caixa', titulo: 'Caixa', descricao: 'Atendimento e pagamento', icone: Wallet, perfis: ['ADMIN', 'CAIXA'] },
  { rota: '/estatisticas', titulo: 'Estatísticas', descricao: 'Consultas por período', icone: BarChart3, perfis: ['ADMIN', 'CAIXA'] },
  { rota: '/contabil', titulo: 'Contábil', descricao: 'Valores recebidos', icone: Landmark, perfis: ['ADMIN'] },
  { rota: '/precos', titulo: 'Preços', descricao: 'Tabela de valores', icone: Tags, perfis: ['ADMIN'] },
];
