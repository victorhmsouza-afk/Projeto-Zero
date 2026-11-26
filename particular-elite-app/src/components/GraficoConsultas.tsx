import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface PontoGrafico { rotulo: string; longo: string; consulta: number; ps: number }

/** Barras empilhadas: Consulta (verde) + Pronto Socorro (laranja). */
export function GraficoConsultas({ dados, altura = 280 }: { dados: PontoGrafico[]; altura?: number }) {
  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PontoGrafico;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                  <p className="mb-1 font-semibold">{p.longo}</p>
                  <p className="flex items-center justify-between gap-6"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-chart-consulta" />Consulta</span><b className="tabular">{p.consulta}</b></p>
                  <p className="flex items-center justify-between gap-6"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-chart-ps" />Pronto Socorro</span><b className="tabular">{p.ps}</b></p>
                  <p className="mt-1 flex justify-between gap-6 border-t pt-1"><span>Total</span><b className="tabular">{p.consulta + p.ps}</b></p>
                </div>
              );
            }}
          />
          <Bar dataKey="consulta" name="Consulta" stackId="a" fill="hsl(var(--chart-consulta))" />
          <Bar dataKey="ps" name="Pronto Socorro" stackId="a" fill="hsl(var(--chart-ps))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LegendaConsultas() {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-chart-consulta" />Consulta</span>
      <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-chart-ps" />Pronto Socorro</span>
    </div>
  );
}
