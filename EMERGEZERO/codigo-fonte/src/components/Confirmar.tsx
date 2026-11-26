import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Pedido { titulo: string; texto: string; botao: string; perigo?: boolean }
type Fn = (p: Pedido) => Promise<boolean>;
const Ctx = createContext<Fn>(async () => false);

/** Janela "Tem certeza?" usada no sistema todo: `const confirmar = useConfirmar(); if (await confirmar({...}))`. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const resolver = useRef<(v: boolean) => void>();
  const confirmar = useCallback<Fn>((p) => {
    setPedido(p);
    return new Promise<boolean>((r) => { resolver.current = r; });
  }, []);
  const responder = (v: boolean) => {
    resolver.current?.(v);
    setPedido(null);
  };
  return (
    <Ctx.Provider value={confirmar}>
      {children}
      <Dialog open={!!pedido} onOpenChange={(o) => !o && responder(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">{pedido?.titulo}</DialogTitle>
            <DialogDescription>{pedido?.texto}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => responder(false)}>Cancelar</Button>
            <Button variant={pedido?.perigo ? 'destructive' : 'default'} onClick={() => responder(true)} autoFocus>{pedido?.botao}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirmar = () => useContext(Ctx);
