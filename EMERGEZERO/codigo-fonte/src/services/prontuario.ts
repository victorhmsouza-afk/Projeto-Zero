/**
 * API do Prontuário (SAMEL) — leitura da FILA DO PRONTO SOCORRO (GET).
 * Endpoint: GET {BASE}/ps/filaDeAtendimentoProntoSocorroV2/{unidade}/{setor}
 * Resposta: { status: boolean, message: string, dados: RegistroFilaPS[] }  (tipo em src/types)
 *
 * - Em desenvolvimento (npm run dev) a chamada passa pelo proxy do Vite (/api-prontuario).
 * - No index.html pronto a chamada vai direto para a API. A API responde com
 *   "Access-Control-Allow-Origin: *", então o navegador aceita — desde que o computador
 *   esteja na rede do hospital (o domínio aponta para um IP interno).
 */
import type { RegistroFilaPS, RespostaApiFilaPS } from '@/types';

export const API_PRONTUARIO = 'https://api-prontuario.samel.com.br/prontuario';
const BASE = import.meta.env.DEV ? '/api-prontuario/prontuario' : API_PRONTUARIO;

export const UNIDADE_PS = '49';
export const SETOR_PS = 'Pronto Socorro';

export interface RespostaFila {
  registros: RegistroFilaPS[];
  mensagem: string;
  bruto: unknown;
  url: string;
  recebidoEm: Date;
}

export const urlFilaPS = (unidade: string, setor: string) =>
  `${API_PRONTUARIO}/ps/filaDeAtendimentoProntoSocorroV2/${encodeURIComponent(unidade)}/${encodeURIComponent(setor)}`;

export async function buscarFilaPS(unidade: string, setor: string, sinal?: AbortSignal): Promise<RespostaFila> {
  const url = `${BASE}/ps/filaDeAtendimentoProntoSocorroV2/${encodeURIComponent(unidade)}/${encodeURIComponent(setor)}`;
  let resp: Response;
  try {
    resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: sinal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(
      'Não foi possível conectar à API do prontuário. Verifique se este computador está na rede do hospital (ou na VPN).',
    );
  }
  if (!resp.ok) throw new Error(`A API respondeu com erro ${resp.status}${resp.statusText ? ` (${resp.statusText})` : ''}.`);
  const texto = await resp.text();
  let json: Partial<RespostaApiFilaPS> | RegistroFilaPS[];
  try { json = texto ? JSON.parse(texto) : []; } catch { throw new Error('A API respondeu, mas o conteúdo não é JSON.'); }

  const lista = Array.isArray(json) ? json : json.dados;
  if (!Array.isArray(json) && json.status === false) throw new Error(json.message || 'A API informou que não conseguiu buscar a fila.');
  if (!Array.isArray(lista)) throw new Error('A API respondeu num formato inesperado (sem a lista "dados").');
  return {
    registros: lista,
    mensagem: Array.isArray(json) ? '' : json.message ?? '',
    bruto: json,
    url: urlFilaPS(unidade, setor),
    recebidoEm: new Date(),
  };
}

/* ------------------------------------------------------------------ */
/* Classificação de risco — Protocolo de Manchester                    */
/* ------------------------------------------------------------------ */

export type CorRisco = 'VERMELHO' | 'LARANJA' | 'AMARELO' | 'VERDE' | 'AZUL' | 'SEM';

export interface Risco {
  cor: CorRisco;
  nome: string;
  descricao: string;
  /** Tempo-alvo de atendimento médico no protocolo, em minutos. */
  alvoMin: number;
  /** Cor de fundo e do texto do selo. */
  fundo: string;
  texto: string;
}

export const RISCOS: Risco[] = [
  { cor: 'VERMELHO', nome: 'Vermelho', descricao: 'Emergência', alvoMin: 0, fundo: '#DC2626', texto: '#FFFFFF' },
  { cor: 'LARANJA', nome: 'Laranja', descricao: 'Muito urgente', alvoMin: 10, fundo: '#EA580C', texto: '#FFFFFF' },
  { cor: 'AMARELO', nome: 'Amarelo', descricao: 'Urgente', alvoMin: 60, fundo: '#FACC15', texto: '#422006' },
  { cor: 'VERDE', nome: 'Verde', descricao: 'Pouco urgente', alvoMin: 120, fundo: '#16A34A', texto: '#FFFFFF' },
  { cor: 'AZUL', nome: 'Azul', descricao: 'Não urgente', alvoMin: 240, fundo: '#2563EB', texto: '#FFFFFF' },
];
export const SEM_RISCO: Risco = { cor: 'SEM', nome: 'Sem classificação', descricao: 'Ainda não classificado', alvoMin: Infinity, fundo: '#9CA3AF', texto: '#FFFFFF' };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/** Descobre a cor de Manchester pelo texto da triagem (ex.: "VERDE"). */
export function riscoDe(r: Pick<RegistroFilaPS, 'DS_TRIAGEM'>): Risco {
  const t = semAcento(r.DS_TRIAGEM || '');
  return RISCOS.find((x) => t.includes(x.cor)) ?? SEM_RISCO;
}

/* ------------------------------------------------------------------ */
/* Datas e tempos                                                      */
/* ------------------------------------------------------------------ */

/** Lê "dd/mm/aaaa hh:mm:ss" (hora local) ou ISO. */
export function lerData(v?: string | null): Date | null {
  if (!v) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v);
  const d = m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)) : new Date(v);
  return Number.isNaN(+d) ? null : d;
}

/** Minutos entre duas datas (nunca negativo). */
export const minutosEntre = (de: Date | null, ate: Date | null) => (de && ate ? Math.max(0, Math.floor((+ate - +de) / 60000)) : null);

/** 75 → "1h15"; 8 → "8 min" */
export function duracao(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export const horaCurta = (d: Date | null) => (d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

export interface PacienteFila {
  r: RegistroFilaPS;
  risco: Risco;
  chegada: Date | null;
  fimTriagem: Date | null;
  atendMedico: Date | null;
  /** Já foi atendido pelo médico? */
  atendido: boolean;
  /** Espera pelo médico: do fim da triagem até o atendimento (ou até agora, se ainda espera). */
  esperaMin: number | null;
  /** Tempo total no PS desde a chegada. */
  naUnidadeMin: number | null;
  /** Esperando o médico além do tempo-alvo de Manchester. */
  atrasado: boolean;
  situacao: string;
  reavaliacao: boolean;
}

/** Junta os campos da API num formato fácil de mostrar. */
export function montarPaciente(r: RegistroFilaPS, agora: Date): PacienteFila {
  const risco = riscoDe(r);
  // As datas "dd/mm/aaaa" vêm na hora do hospital; as "_ORIG" em UTC. A diferença entre as duas
  // versões da entrada corrige o fuso caso o computador não esteja na hora de Manaus.
  const entradaLocal = lerData(r.DT_ENTRADA);
  const entradaUtc = lerData(r.DT_ENTRADA_ORIG);
  const ajuste = entradaLocal && entradaUtc ? +entradaLocal - +entradaUtc : 0;
  const local = (v?: string | null) => { const d = lerData(v); return d ? new Date(+d - ajuste) : null; };
  const chegada = entradaUtc ?? entradaLocal;
  const fimTriagem = lerData(r.DT_FIM_TRIAGEM_ORIG) ?? local(r.DT_FIM_TRIAGEM) ?? chegada;
  const atendMedico = local(r.DT_ATEND_MEDICO);
  const atendido = !!atendMedico;
  const esperaMin = minutosEntre(fimTriagem, atendMedico ?? agora);
  return {
    r,
    risco,
    chegada,
    fimTriagem,
    atendMedico,
    atendido,
    esperaMin,
    naUnidadeMin: minutosEntre(chegada, agora),
    atrasado: !atendido && esperaMin !== null && esperaMin > risco.alvoMin,
    situacao: (r.IE_STATUS_PAC || '').replace(/^\s*\d+\s*-\s*/, '') || '—',
    reavaliacao: !!r.DT_PRONTO_REAVALIACAO_DATE,
  };
}

/** Quantos pacientes em cada cor (sempre as 5 cores, mais "sem classificação" se houver). */
export function contarPorRisco(registros: RegistroFilaPS[]) {
  const contagem = new Map<CorRisco, number>();
  registros.forEach((r) => { const c = riscoDe(r).cor; contagem.set(c, (contagem.get(c) || 0) + 1); });
  const lista = RISCOS.map((risco) => ({ risco, total: contagem.get(risco.cor) || 0 }));
  if (contagem.get('SEM')) lista.push({ risco: SEM_RISCO, total: contagem.get('SEM')! });
  return lista;
}
