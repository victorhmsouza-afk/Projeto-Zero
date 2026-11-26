import { BarChart3, CalendarCheck2, Landmark, LayoutDashboard, Tags, type LucideIcon } from 'lucide-react';
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
  { rota: '/dashboard', titulo: 'Dashboard', descricao: 'Resumo do dia', icone: LayoutDashboard, perfis: ['ADMIN', 'AGENDAMENTO'] },
  { rota: '/agendamento', titulo: 'Agendamento', descricao: 'Atendimento e pagamento', icone: CalendarCheck2, perfis: ['ADMIN', 'AGENDAMENTO'] },
  { rota: '/estatisticas', titulo: 'Estatísticas', descricao: 'Consultas por período', icone: BarChart3, perfis: ['ADMIN', 'AGENDAMENTO'] },
  { rota: '/contabil', titulo: 'Contábil', descricao: 'Valores recebidos', icone: Landmark, perfis: ['ADMIN'] },
  { rota: '/precos', titulo: 'Preços', descricao: 'Tabela de valores', icone: Tags, perfis: ['ADMIN'] },
];
