/* =========================================================
   Particular Elite · estatisticas.js
   Consultas por mês, dia, hora e minuto (faixas de 15 min),
   com o valor recebido em consultas e em exames.
   ========================================================= */
const SERIES = [
  { chave: 'consulta', nome: 'Consulta', cor: 'var(--serie-consulta)' },
  { chave: 'ps', nome: 'Pronto Socorro', cor: 'var(--serie-ps)' },
];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

carregadores.estatisticas = () => carregarEstatisticas();

function definirPeriodo(tipo) {
  const hoje = new Date();
  let ini = new Date(hoje);
  if (tipo === 'mes') ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  else if (tipo !== 'hoje') ini.setDate(hoje.getDate() - Number(tipo) + 1);
  $('#est-inicio').value = dataLocal(ini);
  $('#est-fim').value = dataLocal(hoje);
  $$('[data-periodo]').forEach((b) => b.classList.toggle('ativo', b.dataset.periodo === tipo));
}

const agrupamento = () => document.querySelector('input[name="agrupar"]:checked')?.value || 'dia';

$$('[data-periodo]').forEach((b) => b.addEventListener('click', () => { definirPeriodo(b.dataset.periodo); carregarEstatisticas(); }));
['#est-inicio', '#est-fim'].forEach((s) => $(s).addEventListener('change', () => { $$('[data-periodo]').forEach((b) => b.classList.remove('ativo')); carregarEstatisticas(); }));
$$('input[name="agrupar"]').forEach((r) => r.addEventListener('change', () => carregarEstatisticas()));

function chaveDe(modo, iso) {
  const d = String(iso);
  if (modo === 'mes') return d.slice(0, 7);
  if (modo === 'dia') return d.slice(0, 10);
  const h = Number(d.slice(11, 13)), m = Number(d.slice(14, 16));
  if (modo === 'hora') return String(h);
  return String(h * 60 + Math.floor(m / 15) * 15); // minuto: faixa de 15 min
}

function montarGrupos(modo, ini, fim) {
  const g = [];
  const dois = (n) => String(n).padStart(2, '0');
  if (modo === 'hora') for (let h = 0; h < 24; h++) g.push({ chave: String(h), rotulo: `${dois(h)}h`, longo: `${dois(h)}:00 às ${dois(h)}:59` });
  else if (modo === 'minuto') for (let m = 0; m < 1440; m += 15) {
    const f = m + 14;
    g.push({ chave: String(m), rotulo: `${dois(Math.floor(m / 60))}:${dois(m % 60)}`, longo: `${dois(Math.floor(m / 60))}:${dois(m % 60)} às ${dois(Math.floor(f / 60))}:${dois(f % 60)}` });
  } else {
    const d = new Date(`${ini}T00:00`), limite = new Date(`${fim}T00:00`);
    if (modo === 'mes') d.setDate(1);
    while (d <= limite) {
      if (modo === 'mes') {
        g.push({ chave: dataLocal(d).slice(0, 7), rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, longo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` });
        d.setMonth(d.getMonth() + 1);
      } else {
        g.push({ chave: dataLocal(d), rotulo: `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`, longo: `${DIAS[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}` });
        d.setDate(d.getDate() + 1);
      }
    }
  }
  return g;
}

async function carregarEstatisticas() {
  if (!$('#est-inicio').value) definirPeriodo('30');
  const ini = $('#est-inicio').value, fim = $('#est-fim').value;
  const [atendimentos, pagamentos] = await Promise.all([
    Banco.listarAtendimentos({ inicio: ini, fim }),
    Banco.listarPagamentos({ inicio: ini, fim }),
  ]);
  renderEstatisticas(atendimentos, pagamentos, ini, fim);
  const tem = await Banco.temExemplos();
  $('#btn-remover-exemplo').disabled = !tem;
  $('#btn-gerar-exemplo').disabled = tem;
  $('#exemplo-info').textContent = tem
    ? 'Há dados de exemplo (fictícios) misturados nas estatísticas. Remova quando for usar de verdade.'
    : 'Para testar as estatísticas sem esperar o movimento real, gere 90 dias de atendimentos fictícios. Eles ficam marcados e podem ser removidos depois.';
}

function renderEstatisticas(atendimentos, pagamentos, ini, fim) {
  const modo = agrupamento();
  const grupos = montarGrupos(modo, ini, fim).map((g) => ({ ...g, consulta: 0, ps: 0, recCons: 0, recExames: 0 }));
  const mapa = new Map(grupos.map((g) => [g.chave, g]));
  atendimentos.forEach((a) => {
    const g = mapa.get(chaveDe(modo, a.abertoEm));
    if (g) g[a.tipo === 'PRONTO_SOCORRO' ? 'ps' : 'consulta']++;
  });
  pagamentos.forEach((p) => {
    const g = mapa.get(chaveDe(modo, p.dataHora));
    if (g) g[p.referente === 'CONSULTA' ? 'recCons' : 'recExames'] += p.valor;
  });
  grupos.forEach((g) => { g.total = g.consulta + g.ps; });

  // Minuto: mostra das 07:00 às 19:00, ou mais se houver movimento fora disso
  let visiveis = grupos;
  if (modo === 'minuto') {
    const com = grupos.filter((g) => g.total).map((g) => Number(g.chave));
    const de = Math.min(7 * 60, ...com), ate = Math.max(19 * 60 - 15, ...com);
    visiveis = grupos.filter((g) => Number(g.chave) >= de && Number(g.chave) <= ate);
  }

  // Indicadores
  const nCons = atendimentos.filter((a) => a.tipo !== 'PRONTO_SOCORRO').length;
  const nPs = atendimentos.length - nCons;
  const total = atendimentos.length;
  const recCons = pagamentos.filter((p) => p.referente === 'CONSULTA').reduce((t, p) => t + p.valor, 0);
  const recEx = pagamentos.filter((p) => p.referente !== 'CONSULTA').reduce((t, p) => t + p.valor, 0);
  const dias = Math.max(1, Math.round((new Date(`${fim}T00:00`) - new Date(`${ini}T00:00`)) / 86400000) + 1);
  const porHora = new Array(24).fill(0); atendimentos.forEach((a) => { porHora[Number(a.abertoEm.slice(11, 13))]++; });
  const pico = porHora.indexOf(Math.max(...porHora));
  const por15 = new Map(); atendimentos.forEach((a) => { const k = chaveDe('minuto', a.abertoEm); por15.set(k, (por15.get(k) || 0) + 1); });
  const pico15 = [...por15.entries()].sort((a, b) => b[1] - a[1])[0];
  const fmt15 = (k) => `${String(Math.floor(k / 60)).padStart(2, '0')}:${String(k % 60).padStart(2, '0')}`;
  const pct = (n) => (total ? ` · ${Math.round((n / total) * 100)}%` : '');
  $('#est-indicadores').innerHTML = [
    ['Consultas no período', total, `${(total / dias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia em média`],
    ['Consulta', nCons, `eletiva${pct(nCons)}`],
    ['Pronto Socorro', nPs, `emergência${pct(nPs)}`],
    ['Horário de pico', total ? `${String(pico).padStart(2, '0')}h` : '—', pico15 ? `faixa mais cheia: ${fmt15(Number(pico15[0]))} (${pico15[1]})` : 'sem movimento'],
    ['Recebido em consultas', moeda(recCons), ''],
    ['Recebido em exames', moeda(recEx), total ? `média ${moeda((recCons + recEx) / total)} por atendimento` : ''],
  ].map(([t, v, s]) => `<article><span>${t}</span><strong>${v}</strong><small>${s}</small></article>`).join('');

  const nome = { mes: 'mês', dia: 'dia', hora: 'hora do dia', minuto: 'minuto (faixas de 15 min)' }[modo];
  $('#est-titulo').textContent = `Consultas por ${nome}`;
  $('#est-col').textContent = { mes: 'Mês', dia: 'Dia', hora: 'Hora', minuto: 'Horário' }[modo];
  $('#est-legenda').innerHTML = SERIES.map((s) => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join('');
  $('#est-vazio').hidden = total > 0;
  desenharGrafico(visiveis, total > 0);

  const linhas = modo === 'minuto' || modo === 'hora' ? visiveis.filter((g) => g.total || g.recExames) : visiveis;
  $('#est-tabela').innerHTML = linhas.map((g) => `
    <tr><td>${esc(g.longo)}</td><td class="num">${g.consulta}</td><td class="num">${g.ps}</td><td class="num"><strong>${g.total}</strong></td>
    <td class="num">${moeda(g.recCons)}</td><td class="num">${moeda(g.recExames)}</td></tr>`).join('')
    || '<tr><td colspan="6" class="vazio">Nenhuma consulta no período.</td></tr>';
  $('#est-rodape').innerHTML = `<tr><td>Total do período</td><td class="num">${nCons}</td><td class="num">${nPs}</td><td class="num">${total}</td><td class="num">${moeda(recCons)}</td><td class="num">${moeda(recEx)}</td></tr>`;
}

// Barras empilhadas em SVG (Consulta + Pronto Socorro), com dica ao passar o mouse
function desenharGrafico(grupos, temDados) {
  const area = $('#est-grafico');
  area.hidden = !temDados;
  if (!temDados) { area.innerHTML = ''; return; }
  const largura = Math.max(area.clientWidth, Math.min(grupos.length * 9, 2400), 300);
  const altura = 260, mEsq = 34, mBaixo = 26, mTopo = 10;
  const max = Math.max(1, ...grupos.map((g) => g.total));
  const passo = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
  const topo = Math.ceil(max / passo) * passo;
  const util = altura - mTopo - mBaixo;
  const y = (v) => mTopo + util * (1 - v / topo);
  const col = (largura - mEsq - 4) / grupos.length;
  const barra = Math.max(3, Math.min(36, col * 0.62));
  const cada = Math.max(1, Math.ceil(46 / col));
  let s = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de consultas">`;
  for (let v = 0; v <= topo; v += passo) s += `<line class="grade" x1="${mEsq}" x2="${largura - 4}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${mEsq - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  grupos.forEach((g, i) => {
    const x = mEsq + i * col + (col - barra) / 2;
    let base = altura - mBaixo;
    const partes = SERIES.filter((sr) => g[sr.chave] > 0);
    partes.forEach((sr, k) => {
      const h = util * (g[sr.chave] / topo);
      const ultimo = k === partes.length - 1;
      const topoY = base - h;
      if (ultimo) {
        const r = Math.min(4, barra / 2, h);
        s += `<path fill="${sr.cor}" d="M${x},${base} V${topoY + r} Q${x},${topoY} ${x + r},${topoY} H${x + barra - r} Q${x + barra},${topoY} ${x + barra},${topoY + r} V${base} Z"/>`;
      } else {
        s += `<rect fill="${sr.cor}" x="${x}" y="${topoY + 2}" width="${barra}" height="${Math.max(1, h - 2)}"/>`; // 2 px entre as partes
      }
      base = topoY;
    });
    if (i % cada === 0) s += `<text class="eixo" x="${mEsq + i * col + col / 2}" y="${altura - 8}" text-anchor="middle">${esc(g.rotulo)}</text>`;
    s += `<rect class="alvo" data-i="${i}" x="${mEsq + i * col}" y="${mTopo}" width="${col}" height="${util}"/>`;
  });
  area.innerHTML = `${s}</svg>`;
  area._grupos = grupos;
}

$('#est-grafico').addEventListener('mousemove', (e) => {
  const alvo = e.target.closest('.alvo');
  const dica = $('#est-dica');
  $$('#est-grafico .alvo.ativo').forEach((a) => a.classList.remove('ativo'));
  if (!alvo) { dica.hidden = true; return; }
  alvo.classList.add('ativo');
  const g = $('#est-grafico')._grupos[Number(alvo.dataset.i)];
  dica.innerHTML = `<strong>${esc(g.longo)}</strong>`
    + SERIES.map((sr) => `<div><span><i style="background:${sr.cor}"></i>${sr.nome}</span><span>${g[sr.chave]}</span></div>`).join('')
    + `<div class="total"><span>Total de consultas</span><span>${g.total}</span></div>`
    + `<div><span>Recebido consultas</span><span>${moeda(g.recCons)}</span></div><div><span>Recebido exames</span><span>${moeda(g.recExames)}</span></div>`;
  dica.hidden = false;
  const c = $('#est-grafico').closest('.cartao').getBoundingClientRect();
  let x = e.clientX - c.left + 14;
  if (x + 210 > c.width) x = e.clientX - c.left - 220;
  dica.style.left = `${Math.max(8, x)}px`;
  dica.style.top = `${e.clientY - c.top + 12}px`;
});
$('#est-grafico').addEventListener('mouseleave', () => { $('#est-dica').hidden = true; $$('#est-grafico .alvo.ativo').forEach((a) => a.classList.remove('ativo')); });
window.addEventListener('resize', () => { if ($('#tela-estatisticas').classList.contains('ativa')) carregarEstatisticas(); });

// ---------- Dados de exemplo (90 dias, fictícios, marcados com exemplo: true) ----------
function gerarExemplos() {
  let semente = 11;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const pesos = [1, 1, 1, 1, 1, 1, 2, 4, 8, 10, 10, 8, 5, 5, 7, 8, 8, 9, 10, 11, 9, 6, 3, 2];
  const somaP = pesos.reduce((a, b) => a + b, 0);
  const exames = PRECOS_PADRAO.exames;
  const formas = ['PIX', 'PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'];
  const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Marina', 'Nilton', 'Olívia', 'Pedro'];
  const sobren = ['Silva', 'Souza', 'Oliveira', 'Lima', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro'];
  const atend = [], pags = [];
  let num = 50000, rec = 90000;
  const iso = (d) => `${dataLocal(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
  for (let dd = 1; dd <= 90; dd++) {
    const dia = new Date(); dia.setDate(dia.getDate() - dd);
    const fds = dia.getDay() === 0 || dia.getDay() === 6;
    const n = Math.round((fds ? 9 : 14) + rnd() * 8);
    for (let k = 0; k < n; k++) {
      let r = rnd() * somaP, h = 0; while (r > pesos[h]) { r -= pesos[h]; h++; }
      const ab = new Date(dia); ab.setHours(h, Math.floor(rnd() * 60), 0, 0);
      const ps = rnd() < (fds || h >= 19 || h < 7 ? 0.7 : 0.35);
      const medico = ps ? CONFIG.medicos[4] : CONFIG.medicos[Math.floor(rnd() * 4)];
      const valor = ps ? PRECOS_PADRAO.prontoSocorro : medico.valorConsulta;
      const id = `X${dd}-${k}`; num++;
      const paciente = `${nomes[Math.floor(rnd() * nomes.length)]} ${sobren[Math.floor(rnd() * sobren.length)]} (exemplo)`;
      const pgC = { id: `XG${dd}-${k}`, numeroRecibo: `EX-${++rec}`, exemplo: true, referente: 'CONSULTA', atendimentoId: id, atendimentoNumero: num,
        pacienteNome: paciente, cpf: '', medicoNome: medico.nome, tipoConsulta: ps ? 'PRONTO_SOCORRO' : 'CONSULTA',
        forma: formas[Math.floor(rnd() * formas.length)], valor, subtotal: valor, desconto: 0, itens: [{ nome: 'Consulta', valor }], dataHora: iso(ab) };
      pags.push(pgC);
      const realizada = new Date(ab.getTime() + (20 + rnd() * 60) * 60000);
      const lista = [];
      const qtd = rnd() < 0.45 ? 0 : 1 + Math.floor(rnd() * 3);
      for (let e = 0; e < qtd; e++) {
        const ex = exames[Math.floor(rnd() * exames.length)];
        lista.push({ id: `XE${dd}-${k}-${e}`, nome: ex.nome, categoria: ex.categoria, valor: ex.valor, status: 'PENDENTE', pedidoEm: iso(realizada) });
      }
      // a maioria paga os exames logo depois; alguns pagam depois, em partes
      lista.forEach((x, e) => {
        if (rnd() < 0.85) {
          const t = new Date(realizada.getTime() + (5 + e * (rnd() < 0.3 ? 240 : 3)) * 60000);
          const pg = { id: `XP${dd}-${k}-${e}`, numeroRecibo: `EX-${++rec}`, exemplo: true, referente: 'EXAMES', atendimentoId: id, atendimentoNumero: num,
            pacienteNome: paciente, cpf: '', medicoNome: medico.nome, tipoConsulta: pgC.tipoConsulta,
            forma: formas[Math.floor(rnd() * formas.length)], valor: x.valor, subtotal: x.valor, desconto: 0, itens: [{ nome: x.nome, valor: x.valor }], dataHora: iso(t) };
          pags.push(pg);
          Object.assign(x, { status: rnd() < 0.8 ? 'REALIZADO' : 'PAGO', pagoEm: pg.dataHora, pagamentoId: pg.id, realizadoEm: pg.dataHora });
        }
      });
      atend.push({ id, numero: num, exemplo: true, pacienteId: '', pacienteNome: paciente, cpf: '', telefone: '', tipo: pgC.tipoConsulta,
        medicoId: medico.id, medicoNome: medico.nome, valorConsulta: valor, abertoEm: pgC.dataHora, pagamentoConsultaId: pgC.id,
        consultaRealizadaEm: iso(realizada), exames: lista });
    }
  }
  return { atend, pags };
}

$('#btn-gerar-exemplo').addEventListener('click', async () => {
  if (await Banco.temExemplos()) return;
  const { atend, pags } = gerarExemplos();
  await Banco.gravarExemplos(atend, pags);
  avisar(`${atend.length} atendimentos de exemplo gerados (últimos 90 dias).`);
  carregarEstatisticas();
});
$('#btn-remover-exemplo').addEventListener('click', async () => {
  if (!(await confirmar('Remover todos os dados de exemplo? Os atendimentos reais não são afetados.', 'Remover exemplos'))) return;
  await Banco.removerExemplos();
  avisar('Dados de exemplo removidos.');
  carregarEstatisticas();
});
