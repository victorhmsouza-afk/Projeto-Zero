/**
 * API do Prontuário (SAMEL) — leitura da FILA DO PRONTO SOCORRO (GET).
 * Endpoint: GET {BASE}/ps/filaDeAtendimentoProntoSocorroV2/{unidade}/{setor}
 *
 * - Em desenvolvimento (npm run dev) a chamada passa pelo proxy do Vite (/api-prontuario), sem problema de CORS.
 * - No index.html pronto a chamada vai direto para a API; ela precisa estar acessível na rede
 *   e permitir CORS para a origem de onde o sistema é aberto.
 */
export const API_PRONTUARIO = 'https://api-prontuario.samel.com.br/prontuario';
const BASE = import.meta.env.DEV ? '/api-prontuario/prontuario' : API_PRONTUARIO;

export type Registro = Record<string, unknown>;

export interface RespostaFila {
  registros: Registro[];
  bruto: unknown;
  url: string;
  recebidoEm: Date;
}

export const urlFilaPS = (unidade: string, setor: string) =>
  `${API_PRONTUARIO}/ps/filaDeAtendimentoProntoSocorroV2/${encodeURIComponent(unidade)}/${encodeURIComponent(setor)}`;

/** Acha a lista de registros na resposta (array direto, ou dentro de data/dados/lista/...). */
export function extrairLista(json: unknown): Registro[] {
  if (Array.isArray(json)) return json.map((x) => (x && typeof x === 'object' ? (x as Registro) : { valor: x }));
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    for (const k of ['data', 'dados', 'lista', 'fila', 'content', 'result', 'resultado', 'items', 'itens', 'registros', 'pacientes']) {
      if (Array.isArray(o[k])) return extrairLista(o[k]);
      if (o[k] && typeof o[k] === 'object') { const l = extrairLista(o[k]); if (l.length) return l; }
    }
    const qualquer = Object.values(o).find(Array.isArray);
    if (qualquer) return extrairLista(qualquer);
    return Object.keys(o).length ? [o] : [];
  }
  return [];
}

export async function buscarFilaPS(unidade: string, setor: string, sinal?: AbortSignal): Promise<RespostaFila> {
  const url = `${BASE}/ps/filaDeAtendimentoProntoSocorroV2/${encodeURIComponent(unidade)}/${encodeURIComponent(setor)}`;
  let resp: Response;
  try {
    resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: sinal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(
      'Não foi possível conectar à API do prontuário. Verifique se este computador está na rede do hospital (ou na VPN) ' +
      'e se a API permite acesso a partir deste endereço (CORS).',
    );
  }
  if (!resp.ok) throw new Error(`A API respondeu com erro ${resp.status}${resp.statusText ? ` (${resp.statusText})` : ''}.`);
  const texto = await resp.text();
  let json: unknown;
  try { json = texto ? JSON.parse(texto) : []; } catch { throw new Error('A API respondeu, mas o conteúdo não é JSON.'); }
  return { registros: extrairLista(json), bruto: json, url: urlFilaPS(unidade, setor), recebidoEm: new Date() };
}
