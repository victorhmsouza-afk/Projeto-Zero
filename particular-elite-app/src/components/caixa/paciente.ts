import { z } from 'zod';
import { agoraIso, cpfValido, dataLocal } from '@/lib/format';
import { Banco } from '@/services/banco';
import type { Paciente } from '@/types';
import type { Rascunho } from './tipos';

/** Regras do cadastro de novo paciente. */
export const esquemaPaciente = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo do paciente.'),
  cpf: z.string().refine((v) => !v || cpfValido(v), 'CPF inválido. Confira os números.'),
  nascimento: z.string().refine((v) => !v || (v >= '1900-01-01' && v <= dataLocal()), 'Data de nascimento inválida.'),
  telefone: z.string().refine((v) => !v || v.replace(/\D/g, '').length >= 10, 'Telefone incompleto. Use DDD + número.'),
  email: z.string().trim().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'E-mail inválido.'),
});

/** Confere e salva o novo paciente. Lança Error com a mensagem para mostrar na tela. */
export async function salvarNovoPaciente(novo: Rascunho['novo']): Promise<Paciente> {
  const r = esquemaPaciente.safeParse(novo);
  if (!r.success) throw new Error(r.error.issues[0].message);
  if (novo.cpf) {
    const cpf = novo.cpf.replace(/\D/g, '');
    const existente = (await Banco.buscarPacientes(cpf)).find((p) => (p.cpf || '').replace(/\D/g, '') === cpf);
    if (existente) throw new Error(`Já existe paciente com este CPF: ${existente.nome}. Use "Paciente já cadastrado".`);
  }
  return Banco.salvarPaciente({
    nome: r.data.nome.replace(/\s+/g, ' '),
    cpf: novo.cpf,
    nascimento: novo.nascimento,
    telefone: novo.telefone,
    email: r.data.email,
    cadastradoEm: agoraIso(),
  });
}
