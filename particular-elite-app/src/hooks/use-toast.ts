import { toast as sonner } from 'sonner';

/** Avisos (Sonner) com as variantes do design system: default, success e destructive. */
export const toast = {
  default: (titulo: string, descricao?: string) => sonner(titulo, { description: descricao }),
  success: (titulo: string, descricao?: string) => sonner.success(titulo, { description: descricao }),
  destructive: (titulo: string, descricao?: string) => sonner.error(titulo, { description: descricao }),
};

export function useToast() {
  return { toast };
}
