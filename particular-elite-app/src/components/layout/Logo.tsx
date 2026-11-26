import { Cross } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Logo circular verde com ícone branco. */
export function Logo({ className, tamanho = 'md' }: { className?: string; tamanho?: 'sm' | 'md' | 'lg' }) {
  const t = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' }[tamanho];
  const i = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' }[tamanho];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-medical-green text-white shadow-sm', t, className)} aria-hidden="true">
      <Cross className={i} strokeWidth={2.5} />
    </span>
  );
}
