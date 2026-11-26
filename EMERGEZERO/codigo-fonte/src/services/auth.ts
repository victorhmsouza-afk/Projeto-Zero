/**
 * Autenticação de DEMONSTRAÇÃO (fica no navegador).
 * No sistema do hospital: trocar `entrar` por uma chamada à API que devolva um token (JWT).
 */
import type { Usuario } from '@/types';
import { USUARIOS } from './config';

const CHAVE = 'pe.sessao';
const DURACAO_MS = 8 * 60 * 60 * 1000; // 8 horas

export async function entrar(login: string, senha: string): Promise<Usuario> {
  await new Promise((r) => setTimeout(r, 450)); // simula a ida ao servidor
  const u = USUARIOS.find((x) => x.login === login.trim().toLowerCase() && x.senha === senha);
  if (!u) throw new Error('Usuário ou senha incorretos.');
  const usuario: Usuario = { login: u.login, nome: u.nome, perfil: u.perfil };
  try { localStorage.setItem(CHAVE, JSON.stringify({ usuario, expira: Date.now() + DURACAO_MS })); } catch { /* sem armazenamento */ }
  return usuario;
}

export function sessaoAtual(): Usuario | null {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (!s || s.expira < Date.now()) return null;
    if (s.usuario?.perfil === 'CAIXA') return null; // sessão da versão antiga: pede login de novo
    return s.usuario as Usuario;
  } catch {
    return null;
  }
}

export function sair() {
  try { localStorage.removeItem(CHAVE); } catch { /* ignore */ }
}
