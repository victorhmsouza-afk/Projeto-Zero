import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const CORES = {
  verde: 'bg-primary/10 text-primary',
  azul: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  laranja: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  roxo: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  vermelho: 'bg-destructive/10 text-destructive',
  cinza: 'bg-secondary/15 text-secondary dark:text-secondary-foreground',
};

/** Cartão de indicador com ícone colorido. */
export function StatCard({
  titulo, valor, detalhe, icone: Icone, cor = 'verde', destaque = false,
}: { titulo: string; valor: string | number; detalhe?: string; icone: LucideIcon; cor?: keyof typeof CORES; destaque?: boolean }) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', destaque && 'border-primary bg-primary text-primary-foreground')}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', destaque ? 'text-primary-foreground/85' : 'text-muted-foreground')}>{titulo}</p>
          <p className="tabular mt-1 truncate text-2xl font-bold">{valor}</p>
          {detalhe && <p className={cn('mt-1 text-xs', destaque ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{detalhe}</p>}
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', destaque ? 'bg-white/15 text-white' : CORES[cor])}>
          <Icone className="h-5 w-5" strokeWidth={2.2} />
        </span>
      </CardContent>
    </Card>
  );
}
