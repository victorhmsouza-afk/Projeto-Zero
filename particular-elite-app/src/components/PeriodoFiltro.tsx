import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { periodoRapido } from '@/lib/format';
import type { ReactNode } from 'react';

export interface Periodo { inicio: string; fim: string; atalho?: string }

const ATALHOS = [
  ['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['365', '12 meses'],
];

/** Filtro de período (De / Até + atalhos). */
export function PeriodoFiltro({ valor, onChange, extra }: { valor: Periodo; onChange: (p: Periodo) => void; extra?: ReactNode }) {
  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-end gap-4 p-4 sm:p-6">
        <div className="grid gap-2">
          <Label htmlFor="periodo-inicio">De</Label>
          <Input id="periodo-inicio" type="date" value={valor.inicio} max={valor.fim} onChange={(e) => onChange({ ...valor, inicio: e.target.value, atalho: undefined })} className="w-44" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="periodo-fim">Até</Label>
          <Input id="periodo-fim" type="date" value={valor.fim} min={valor.inicio} onChange={(e) => onChange({ ...valor, fim: e.target.value, atalho: undefined })} className="w-44" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Períodos prontos">
          {ATALHOS.map(([k, t]) => (
            <Button key={k} type="button" size="sm" variant={valor.atalho === k ? 'default' : 'outline'} onClick={() => onChange({ ...periodoRapido(k), atalho: k })}>
              {k === 'hoje' && <CalendarDays />} {t}
            </Button>
          ))}
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}
