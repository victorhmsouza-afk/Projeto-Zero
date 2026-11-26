// Formatação e validação usadas em todo o sistema (pt-BR).

export const moeda = (v: number | undefined | null) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Converte "1.234,56", "1234,5" ou "1234.56" em número. */
export function lerMoeda(texto: string | number | undefined | null): number {
  if (typeof texto === 'number') return texto;
  const t = String(texto ?? '').trim().replace(/[R$\s]/g, '');
  if (!t) return 0;
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export const valorCampo = (v: number | undefined | null) =>
  v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

const dois = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' no fuso local. */
export const dataLocal = (d: Date = new Date()) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/** 'AAAA-MM-DDTHH:MM:SS' no fuso local. */
export const agoraIso = (d: Date = new Date()) =>
  `${dataLocal(d)}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;

export const dataBR = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
export const horaBR = (iso?: string | null) => (iso ? String(iso).slice(11, 16) : '');

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function diaPorExtenso(dia: string) {
  return `${DIAS[new Date(`${dia}T00:00`).getDay()]}, ${dataBR(dia)}`;
}

export function idade(nascimento: string) {
  const n = new Date(`${nascimento}T00:00`), h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

export function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function cpfValido(v: string) {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

/** Valor por extenso para o recibo (até milhões). */
export function valorPorExtenso(valor: number) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n: number) => {
    if (n === 100) return 'cem';
    const p: string[] = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return p.join(' e ');
  };
  const inteiro = (n: number) => {
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    const g: [number, string][] = [];
    if (mi) g.push([mi, mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`]);
    if (mil) g.push([mil, mil === 1 ? 'mil' : `${ate999(mil)} mil`]);
    if (resto) g.push([resto, ate999(resto)]);
    const u = g[g.length - 1];
    if (g.length > 1 && (u[0] < 100 || u[0] % 100 === 0)) u[1] = 'e ' + u[1];
    return g.map((x) => x[1]).join(' ');
  };
  const cent = Math.round(Number(valor || 0) * 100), reais = Math.floor(cent / 100), c = cent % 100;
  const pr = reais ? `${inteiro(reais)}${reais % 1e6 === 0 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}` : '';
  const pc = c ? `${ate999(c)} ${c === 1 ? 'centavo' : 'centavos'}` : '';
  return pr && pc ? `${pr} e ${pc}` : pr || pc || 'zero real';
}

/** Período rápido: hoje, últimos N dias, este mês. */
export function periodoRapido(tipo: string): { inicio: string; fim: string } {
  const hoje = new Date();
  let ini = new Date(hoje);
  if (tipo === 'mes') ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  else if (tipo !== 'hoje') ini.setDate(hoje.getDate() - Number(tipo) + 1);
  return { inicio: dataLocal(ini), fim: dataLocal(hoje) };
}
