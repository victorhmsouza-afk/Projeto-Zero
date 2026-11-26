/**
 * Acesso aos dados. Hoje tudo fica no navegador (localStorage).
 * Para ligar ao banco/API do hospital, troque SÓ as funções deste arquivo por chamadas fetch:
 * todas já são assíncronas (Promise), então as telas não mudam.
 */
import type { Atendimento, Diretor, Paciente, Pagamento, TabelaPrecos } from '@/types';
import { DIRETORIA, PRECOS_PADRAO } from './config';

const CHAVES = {
  pacientes: 'ap.pacientes',
  atendimentos: 'ap.atendimentos',
  pagamentos: 'ap.pagamentos',
  precos: 'ap.precos',
  contadores: 'ap.contadores',
};

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}
const copia = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function proximo(nome: string, inicio: number) {
  const c = ler<Record<string, number>>(CHAVES.contadores, {});
  c[nome] = (c[nome] || inicio) + 1;
  gravar(CHAVES.contadores, c);
  return c[nome];
}

const noPeriodo = (data: string, inicio?: string, fim?: string) => (!inicio || data >= inicio) && (!fim || data <= fim);

export const Banco = {
  // ----- Pacientes -----
  async buscarPacientes(texto: string): Promise<Paciente[]> {
    const t = texto.trim().toLowerCase();
    const digitos = t.replace(/\D/g, '');
    const lista = ler<Paciente[]>(CHAVES.pacientes, []);
    if (!t) return lista.slice(-20).reverse();
    return lista.filter((p) => p.nome.toLowerCase().includes(t) || (digitos && (p.cpf || '').replace(/\D/g, '').includes(digitos)));
  },
  async salvarPaciente(paciente: Omit<Paciente, 'id'> & { id?: string }): Promise<Paciente> {
    const lista = ler<Paciente[]>(CHAVES.pacientes, []);
    let salvo: Paciente;
    if (paciente.id) {
      salvo = paciente as Paciente;
      const i = lista.findIndex((p) => p.id === salvo.id);
      if (i >= 0) lista[i] = salvo; else lista.push(salvo);
    } else {
      salvo = { ...paciente, id: `P${proximo('paciente', 1000)}` };
      lista.push(salvo);
    }
    gravar(CHAVES.pacientes, lista);
    return salvo;
  },

  // ----- Atendimentos (inicio/fim = 'AAAA-MM-DD', pela data de abertura) -----
  async listarAtendimentos({ inicio, fim }: { inicio?: string; fim?: string } = {}): Promise<Atendimento[]> {
    return ler<Atendimento[]>(CHAVES.atendimentos, []).filter((a) => noPeriodo(a.abertoEm.slice(0, 10), inicio, fim));
  },
  async obterAtendimento(id: string): Promise<Atendimento | null> {
    return ler<Atendimento[]>(CHAVES.atendimentos, []).find((a) => a.id === id) || null;
  },
  async salvarAtendimento(atendimento: Omit<Atendimento, 'id' | 'numero'> & { id?: string; numero?: number }): Promise<Atendimento> {
    const lista = ler<Atendimento[]>(CHAVES.atendimentos, []);
    let salvo: Atendimento;
    if (!atendimento.id) {
      salvo = { ...atendimento, id: `A${Date.now()}${Math.floor(Math.random() * 1000)}`, numero: proximo('atendimento', 10000) } as Atendimento;
      lista.push(salvo);
    } else {
      salvo = atendimento as Atendimento;
      const i = lista.findIndex((a) => a.id === salvo.id);
      if (i >= 0) lista[i] = salvo; else lista.push(salvo);
    }
    if (!gravar(CHAVES.atendimentos, lista)) throw new Error('Não foi possível salvar o atendimento.');
    return copia(salvo);
  },

  // ----- Pagamentos (depois de pago não existe cancelamento nem estorno; só se cancela atendimento ainda não pago) -----
  async registrarPagamento(pagamento: Omit<Pagamento, 'id' | 'numeroRecibo'>): Promise<Pagamento> {
    const lista = ler<Pagamento[]>(CHAVES.pagamentos, []);
    const salvo: Pagamento = {
      ...pagamento,
      id: `G${Date.now()}${Math.floor(Math.random() * 1000)}`,
      numeroRecibo: `${new Date().getFullYear()}-${String(proximo('recibo', 0)).padStart(5, '0')}`,
    };
    lista.push(salvo);
    if (!gravar(CHAVES.pagamentos, lista)) throw new Error('Não foi possível salvar o pagamento.');
    return salvo;
  },
  async listarPagamentos({ inicio, fim, atendimentoId }: { inicio?: string; fim?: string; atendimentoId?: string } = {}): Promise<Pagamento[]> {
    return ler<Pagamento[]>(CHAVES.pagamentos, []).filter(
      (p) => noPeriodo(p.dataHora.slice(0, 10), inicio, fim) && (!atendimentoId || p.atendimentoId === atendimentoId),
    );
  },

  /** Confere a autorização da diretoria para uma cortesia. NA API: conferir no servidor. */
  async autorizarCortesia({ diretorId, senha }: { diretorId: string; senha: string }): Promise<{ ok: true; diretor: Diretor } | { ok: false; motivo: string }> {
    const d = DIRETORIA.find((x) => String(x.id) === String(diretorId));
    if (!d) return { ok: false, motivo: 'Escolha quem da diretoria autorizou.' };
    if (senha !== d.senha) return { ok: false, motivo: 'Senha da diretoria incorreta.' };
    return { ok: true, diretor: { id: d.id, nome: d.nome, cargo: d.cargo } };
  },

  // ----- Preços -----
  async lerPrecos(): Promise<TabelaPrecos> {
    const salvo = ler<TabelaPrecos | null>(CHAVES.precos, null);
    if (!salvo) return copia(PRECOS_PADRAO);
    const nomes = new Set(salvo.exames.map((e) => e.nome.toLowerCase()));
    PRECOS_PADRAO.exames.forEach((e) => { if (!nomes.has(e.nome.toLowerCase())) salvo.exames.push({ ...e }); });
    return { ...copia(PRECOS_PADRAO), ...salvo };
  },
  async salvarPrecos(precos: TabelaPrecos) {
    gravar(CHAVES.precos, precos);
  },
  async restaurarPrecos(): Promise<TabelaPrecos> {
    localStorage.removeItem(CHAVES.precos);
    return copia(PRECOS_PADRAO);
  },

  // ----- Dados de exemplo (só para testar estatísticas e contábil) -----
  async gravarExemplos(atendimentos: Atendimento[], pagamentos: Pagamento[]) {
    gravar(CHAVES.atendimentos, [...ler<Atendimento[]>(CHAVES.atendimentos, []), ...atendimentos]);
    gravar(CHAVES.pagamentos, [...ler<Pagamento[]>(CHAVES.pagamentos, []), ...pagamentos]);
  },
  async removerExemplos() {
    gravar(CHAVES.atendimentos, ler<Atendimento[]>(CHAVES.atendimentos, []).filter((a) => !a.exemplo));
    gravar(CHAVES.pagamentos, ler<Pagamento[]>(CHAVES.pagamentos, []).filter((p) => !p.exemplo));
  },
  async temExemplos() {
    return ler<Atendimento[]>(CHAVES.atendimentos, []).some((a) => a.exemplo);
  },
};
