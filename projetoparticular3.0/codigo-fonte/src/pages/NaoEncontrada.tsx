import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NaoEncontrada() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary"><Compass className="h-7 w-7" /></span>
      <h1 className="mt-4 text-2xl font-bold text-primary">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">O endereço não existe ou você não tem acesso a ele.</p>
      <Button asChild className="mt-6"><Link to="/dashboard">Voltar ao Dashboard</Link></Button>
    </div>
  );
}
