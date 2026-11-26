// Gera 90 dias de atendimentos FICTÍCIOS (marcados com exemplo: true) para testar gráficos e contábil.
import type { Atendimento, Exame, FormaPagamento, Pagamento } from '@/types';
import { dataLocal } from '@/lib/format';
import { DIRETORIA, MEDICOS, PRECOS_PADRAO } from './config';

export function gerarExemplos() {
  let semente = 11;
  const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const pesos = [1, 1, 1, 1, 1, 1, 2, 4, 8, 10, 10, 8, 5, 5, 7, 8, 8, 9, 10, 11, 9, 6, 3, 2];
  const somaP = pesos.reduce((a, b) => a + b, 0);
  const exames = PRECOS_PADRAO.exames;
  const formas: FormaPagamento[] = ['PIX', 'PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'];
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Marina', 'Nilton', 'Olívia', 'Pedro'];
  const sobren = ['Silva', 'Souza', 'Oliveira', 'Lima', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro'];
  const atend: Atendimento[] = [], pags: Pagamento[] = [];
  let num = 50000, rec = 90000;
  const iso = (d: Date) => `${dataLocal(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

  for (let dd = 1; dd <= 90; dd++) {
    const dia = new Date(); dia.setDate(dia.getDate() - dd);
    const fds = dia.getDay() === 0 || dia.getDay() === 6;
    const n = Math.round((fds ? 9 : 14) + rnd() * 8);
    for (let k = 0; k < n; k++) {
      let r = rnd() * somaP, h = 0;
      while (r > pesos[h]) { r -= pesos[h]; h++; }
      const ab = new Date(dia); ab.setHours(h, Math.floor(rnd() * 60), 0, 0);
      const ps = rnd() < (fds || h >= 19 || h < 7 ? 0.7 : 0.35);
      const medico = ps ? null : MEDICOS[Math.floor(rnd() * MEDICOS.length)];
      const valor = ps ? PRECOS_PADRAO.prontoSocorro : medico!.valorConsulta;
      const id = `X${dd}-${k}`; num++;
      const paciente = `${nomes[Math.floor(rnd() * nomes.length)]} ${sobren[Math.floor(rnd() * sobren.length)]} (exemplo)`;
      const tipo = ps ? 'PRONTO_SOCORRO' : 'CONSULTA';
      const pgC: Pagamento = {
        id: `XG${dd}-${k}`, numeroRecibo: `EX-${++rec}`, exemplo: true, referente: 'CONSULTA', atendimentoId: id, atendimentoNumero: num,
        pacienteNome: paciente, cpf: '', medicoNome: medico?.nome || '', tipoConsulta: tipo,
        forma: formas[Math.floor(rnd() * formas.length)], valor, subtotal: valor, desconto: 0, itens: [{ nome: 'Consulta', valor }], dataHora: iso(ab),
      };
      if (rnd() < 0.03) {
        const d = DIRETORIA[Math.floor(rnd() * DIRETORIA.length)];
        Object.assign(pgC, { forma: 'CORTESIA', valor: 0, cortesia: { valor, autorizadoPor: d.nome, cargo: d.cargo, diretorId: d.id, observacao: 'Exemplo', autorizadoEm: pgC.dataHora } });
      }
      pags.push(pgC);
      const realizada = new Date(ab.getTime() + (20 + rnd() * 60) * 60000);
      const lista: Exame[] = [];
      const qtd = rnd() < 0.45 ? 0 : 1 + Math.floor(rnd() * 3);
      for (let e = 0; e < qtd; e++) {
        const ex = exames[Math.floor(rnd() * exames.length)];
        lista.push({ id: `XE${dd}-${k}-${e}`, nome: ex.nome, categoria: ex.categoria, valor: ex.valor, status: 'PENDENTE', pedidoEm: iso(realizada) });
      }
      lista.forEach((x, e) => {
        if (rnd() < 0.85) {
          const t = new Date(realizada.getTime() + (5 + e * (rnd() < 0.3 ? 240 : 3)) * 60000);
          const pg: Pagamento = {
            id: `XP${dd}-${k}-${e}`, numeroRecibo: `EX-${++rec}`, exemplo: true, referente: 'EXAMES', atendimentoId: id, atendimentoNumero: num,
            pacienteNome: paciente, cpf: '', medicoNome: medico?.nome || '', tipoConsulta: tipo,
            forma: formas[Math.floor(rnd() * formas.length)], valor: x.valor, subtotal: x.valor, desconto: 0, itens: [{ nome: x.nome, valor: x.valor }], dataHora: iso(t),
          };
          pags.push(pg);
          Object.assign(x, { status: rnd() < 0.8 ? 'REALIZADO' : 'PAGO', pagoEm: pg.dataHora, pagamentoId: pg.id, realizadoEm: pg.dataHora });
        }
      });
      atend.push({
        id, numero: num, exemplo: true, pacienteId: '', pacienteNome: paciente, cpf: '', telefone: '', tipo,
        medicoId: medico?.id ?? null, medicoNome: medico?.nome || '', valorConsulta: valor, abertoEm: pgC.dataHora, pagamentoConsultaId: pgC.id,
        consultaRealizadaEm: iso(realizada), exames: lista,
      });
    }
  }
  return { atend, pags };
}
