// ---------- Cor do sistema (verde ou azul-marinho), salva no navegador ----------
(function () {
  let cor = 'verde';
  try { cor = localStorage.getItem('ap.cor') || 'verde'; } catch (e) {}
  const aplicar = (c) => {
    document.documentElement.dataset.cor = c;
    document.querySelectorAll('.cor-opcao').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cor === c)));
  };
  aplicar(cor);
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.cor-opcao');
    if (!b) return;
    aplicar(b.dataset.cor);
    try { localStorage.setItem('ap.cor', b.dataset.cor); } catch (e) {}
  });
})();

/* =========================================================
   Caixa · Atendimento Particular · app.js
   Fluxo: consulta → pagamento → consulta realizada →
   exames pedidos pelo médico → pagamento dos exames
   (tudo de uma vez ou aos poucos) → exame realizado.
   Não existe cancelamento nem estorno de pagamento.
   ========================================================= */

// ---------- Utilitários ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const valorCampo = (v) => (v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
function lerMoeda(texto) {
  let s = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
const dataLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const agoraIso = () => { const d = new Date(); return `${dataLocal(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; };
const horaBR = (iso) => String(iso || '').slice(11, 16);
const dataBR = (iso) => { const [a, m, d] = String(iso || '').slice(0, 10).split('-'); return a ? `${d}/${m}/${a}` : ''; };
const NOMES_FORMA = { PIX: 'Pix', CREDITO: 'Cartão de crédito', DEBITO: 'Cartão de débito', DINHEIRO: 'Dinheiro' };

document.addEventListener('focusout', (e) => {
  if (e.target.classList?.contains('valor') && e.target.value.trim()) e.target.value = valorCampo(lerMoeda(e.target.value));
});

function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; }, 3500);
}

// Relógio do caixa
function atualizarRelogio() {
  const d = new Date();
  $('#relogio-hora').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $('#relogio-data').textContent = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}
atualizarRelogio();
setInterval(atualizarRelogio, 20000);

// ---------- Janelas (recibo e confirmação) ----------
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fechar]');
  if (b) b.closest('.fundo-janela').hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#janela-confirmar').hidden) { resolverConfirmacao(false); return; }
  $('#janela-recibo').hidden = true;
});
let resolverConfirmacao = () => {};
function confirmar(texto, botao = 'Confirmar') {
  $('#cf-texto').textContent = texto;
  $('#cf-sim').textContent = botao;
  $('#janela-confirmar').hidden = false;
  $('#cf-sim').focus();
  return new Promise((r) => { resolverConfirmacao = (v) => { $('#janela-confirmar').hidden = true; r(v); }; });
}
$('#janela-confirmar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cf]');
  if (b) resolverConfirmacao(b.dataset.cf === 'sim');
});

// ---------- Estado ----------
const estado = {
  precos: null,
  data: dataLocal(new Date()),
  atendimentos: [],
  modo: 'vazio',            // 'vazio' | 'novo' | 'atendimento'
  selecionadoId: null,
  atual: null,              // atendimento aberto na comanda
  pagamentosAtual: [],
  selecionados: new Set(),  // exames marcados para pagar
  rascunho: null,           // novo atendimento: { paciente, tipo, medicoId, valor }
  sugestoes: [],
};

// ---------- Navegação ----------
const carregadores = {
  caixa: () => carregarCaixa(),
  precos: () => carregarPrecos(),
  // estatisticas: definido em estatisticas.js
};
function abrirTela(nome) {
  if (!carregadores[nome]) nome = 'caixa';
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${nome}`));
  $$('[data-tela]').forEach((a) => a.classList.toggle('ativa', a.dataset.tela === nome));
  carregadores[nome]();
}
window.addEventListener('hashchange', () => abrirTela(location.hash.slice(1)));

// =========================================================
//   FILA DO DIA
// =========================================================
function situacao(a) {
  if (!a.consultaRealizadaEm) return { texto: 'Aguardando consulta', classe: 'pendente' };
  const ex = a.exames || [];
  if (!ex.length) return { texto: 'Consulta realizada', classe: 'pago' };
  const pagos = ex.filter((x) => x.status !== 'PENDENTE').length;
  const feitos = ex.filter((x) => x.status === 'REALIZADO').length;
  if (pagos < ex.length) return { texto: `Exames ${pagos}/${ex.length} pagos`, classe: 'pendente' };
  if (feitos < ex.length) return { texto: `Exames pagos · ${feitos}/${ex.length} feitos`, classe: 'pago' };
  return { texto: 'Exames concluídos', classe: 'realizado' };
}

async function carregarCaixa() {
  $('#at-data').value = estado.data;
  estado.atendimentos = (await Banco.listarAtendimentos({ inicio: estado.data, fim: estado.data }))
    .sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
  const pagamentosDia = await Banco.listarPagamentos({ inicio: estado.data, fim: estado.data });
  $('#resumo-dia').innerHTML = `
    <div><span>Atendimentos</span><strong>${estado.atendimentos.length}</strong></div>
    <div><span>Recebido</span><strong>${moeda(pagamentosDia.reduce((t, p) => t + p.valor, 0))}</strong></div>`;
  renderFila();
  if (estado.modo === 'atendimento' && estado.selecionadoId) await abrirAtendimento(estado.selecionadoId, false);
  else renderComanda();
}

function renderFila() {
  const busca = $('#at-busca').value.trim().toLowerCase();
  const lista = estado.atendimentos.filter((a) => !busca || a.pacienteNome.toLowerCase().includes(busca) || String(a.numero).includes(busca));
  $('#lista-atend').innerHTML = lista.map((a) => {
    const s = situacao(a);
    return `<li><button type="button" data-atend="${esc(a.id)}" class="${estado.modo === 'atendimento' && a.id === estado.selecionadoId ? 'selecionado' : ''}">
      <strong>${esc(a.pacienteNome)}</strong><span class="hora">${horaBR(a.abertoEm)}</span>
      <span class="meta">${TIPOS[a.tipo].nome} · nº ${a.numero}</span>
      <span class="situacao"><span class="chip ${s.classe}">${s.texto}</span></span>
    </button></li>`;
  }).join('');
  $('#lista-vazia').hidden = lista.length > 0;
  $('#lista-vazia').textContent = estado.atendimentos.length ? 'Nenhum atendimento encontrado.' : 'Nenhum atendimento neste dia.';
}

$('#lista-atend').addEventListener('click', (e) => {
  const b = e.target.closest('[data-atend]');
  if (b) abrirAtendimento(b.dataset.atend, true);
});
$('#at-busca').addEventListener('input', renderFila);
$('#at-data').addEventListener('change', (e) => {
  estado.data = e.target.value || dataLocal(new Date());
  estado.modo = 'vazio'; estado.selecionadoId = null;
  carregarCaixa();
});

// =========================================================
//   COMANDA
// =========================================================
async function abrirAtendimento(id, novaSelecao) {
  const a = await Banco.obterAtendimento(id);
  if (!a) { estado.modo = 'vazio'; renderComanda(); return; }
  const trocou = estado.selecionadoId !== id;
  estado.modo = 'atendimento';
  estado.selecionadoId = id;
  estado.atual = a;
  estado.pagamentosAtual = (await Banco.listarPagamentos({ atendimentoId: id })).sort((x, y) => x.dataHora.localeCompare(y.dataHora));
  const pendentes = (a.exames || []).filter((x) => x.status === 'PENDENTE').map((x) => x.id);
  if (novaSelecao || trocou) { estado.selecionados = new Set(pendentes); limparPagamento(); }
  else estado.selecionados = new Set([...estado.selecionados].filter((x) => pendentes.includes(x)));
  renderFila();
  renderComanda();
}

function renderComanda() {
  const c = $('#comanda');
  if (estado.modo === 'novo') { renderNovo(); renderPagamento(); return; }
  if (estado.modo !== 'atendimento' || !estado.atual) {
    c.innerHTML = `<div class="comanda-vazia"><strong>Caixa livre</strong>
      Clique em <b>+ Novo atendimento</b> para cobrar uma consulta, ou escolha um paciente na fila para cobrar os exames.</div>`;
    renderPagamento();
    return;
  }
  const a = estado.atual;
  const ex = a.exames || [];
  const realizada = !!a.consultaRealizadaEm;
  const pgCons = estado.pagamentosAtual.find((p) => p.id === a.pagamentoConsultaId);
  const pago = ex.filter((x) => x.status !== 'PENDENTE').reduce((t, x) => t + x.valor, 0);
  const aPagar = ex.filter((x) => x.status === 'PENDENTE').reduce((t, x) => t + x.valor, 0);
  const totalPago = estado.pagamentosAtual.reduce((t, p) => t + p.valor, 0);
  const etapa = (txt, feito, atual) => `<span class="etapa ${feito ? 'feito' : atual ? 'atual' : ''}">${feito ? '✓ ' : ''}${txt}</span>`;
  const todosPagos = ex.length && !ex.some((x) => x.status === 'PENDENTE');

  c.innerHTML = `
    <div class="comanda-cabeca">
      <div>
        <h2>${esc(a.pacienteNome)}</h2>
        <p>${TIPOS[a.tipo].descricao} · ${esc(a.medicoNome)} · ${dataBR(a.abertoEm)} ${horaBR(a.abertoEm)}</p>
        <p>${[a.cpf && `CPF ${esc(a.cpf)}`, a.telefone && `Tel. ${esc(a.telefone)}`].filter(Boolean).join(' · ') || 'Sem CPF/telefone'}</p>
      </div>
      <div class="comanda-num">ATENDIMENTO<b>Nº ${a.numero}</b>pago ${moeda(totalPago)}</div>
    </div>
    <div class="comanda-corpo">
      <div class="etapas">
        ${etapa('Consulta paga', true)}
        ${etapa('Consulta realizada', realizada, !realizada)}
        ${etapa('Exames pagos', todosPagos, realizada && !todosPagos)}
      </div>

      <div class="cupom">
        <div class="cupom-titulo"><span>Consulta</span><span>${pgCons ? `${NOMES_FORMA[pgCons.forma]} · ${horaBR(pgCons.dataHora)}` : ''}</span></div>
        <div class="item pago">
          <span></span>
          <span class="descr"><strong>${TIPOS[a.tipo].nome} · ${esc(a.medicoNome)}</strong><small>${realizada ? `Realizada às ${horaBR(a.consultaRealizadaEm)}` : 'Aguardando o médico'}</small></span>
          <span class="chip ${realizada ? 'realizado' : 'pago'}">${realizada ? 'Realizada' : 'Paga'}</span>
          <span class="preco">${moeda(a.valorConsulta)}</span>
        </div>
      </div>

      ${realizada ? '' : `<div class="aviso-etapa"><span>Quando o médico terminar a consulta, marque aqui. Depois disso os exames pedidos podem ser lançados.</span>
        <button type="button" class="botao primario" id="btn-realizada">Consulta realizada</button></div>`}

      ${!realizada ? '' : `
        <form class="adicionar" id="form-exame" autocomplete="off">
          <div class="campo">
            <label for="ex-nome">Lançar exame pedido pelo médico</label>
            <input id="ex-nome" list="lista-exames" placeholder="Hemograma, Tomografia de crânio, Raio-X de joelho…">
          </div>
          <label class="check" id="ex-contraste-campo" hidden><input type="checkbox" id="ex-contraste">Com contraste (+ ${moeda(estado.precos.adicionalContraste)})</label>
          <button type="submit" class="botao">Lançar</button>
        </form>
        <div class="cupom">
          <div class="cupom-titulo">
            <span>Exames ${ex.length ? `(${ex.length})` : ''}</span>
            ${ex.some((x) => x.status === 'PENDENTE') ? '<label class="check" style="padding:2px 8px;font-size:11px"><input type="checkbox" id="sel-todos">Todos a pagar</label>' : ''}
          </div>
          ${ex.length ? ex.map(linhaExame).join('') : '<p class="vazio">Nenhum exame lançado.</p>'}
          ${ex.length ? `<div class="cupom-rodape"><span>PAGO <b>${moeda(pago)}</b></span><span>A PAGAR <b>${moeda(aPagar)}</b></span></div>` : ''}
        </div>`}

      ${estado.pagamentosAtual.length ? `
        <div>
          <div class="cupom-titulo" style="border:0;background:none;padding:0 0 6px">Recibos</div>
          <div class="recibos">
            ${estado.pagamentosAtual.map((p) => `<button type="button" data-recibo="${esc(p.id)}">
              <span>${p.referente === 'CONSULTA' ? 'Consulta' : `Exames (${p.itens.length})`} · ${NOMES_FORMA[p.forma]}${p.parcelas > 1 ? ` ${p.parcelas}x` : ''} · ${dataBR(p.dataHora)} ${horaBR(p.dataHora)} · nº ${esc(p.numeroRecibo)}</span>
              <span class="dinheiro">${moeda(p.valor)}</span></button>`).join('')}
          </div>
        </div>` : ''}
    </div>`;
  const todos = $('#sel-todos');
  if (todos) todos.checked = ex.filter((x) => x.status === 'PENDENTE').every((x) => estado.selecionados.has(x.id));
  renderPagamento();
}

function linhaExame(x) {
  const pendente = x.status === 'PENDENTE';
  const chip = { PENDENTE: '<span class="chip pendente">A pagar</span>', PAGO: '<span class="chip pago">Pago</span>', REALIZADO: '<span class="chip realizado">Realizado</span>' }[x.status];
  const acoes = pendente
    ? `<button type="button" class="link perigo" data-remover-exame="${esc(x.id)}">Remover</button>`
    : x.status === 'PAGO'
      ? `<small class="nota">pago às ${horaBR(x.pagoEm)}</small><button type="button" class="link" data-realizar-exame="${esc(x.id)}">Marcar como realizado</button>`
      : `<small class="nota">pago às ${horaBR(x.pagoEm)} · realizado às ${horaBR(x.realizadoEm)}</small>`;
  return `
    <div class="item ${pendente ? '' : 'pago'}">
      <span>${pendente ? `<input type="checkbox" class="marcar" data-sel-exame="${esc(x.id)}" ${estado.selecionados.has(x.id) ? 'checked' : ''} aria-label="Pagar ${esc(x.nome)}">` : ''}</span>
      <span class="descr"><strong>${esc(x.nome)}</strong><small>${esc(x.categoria)}</small></span>
      ${chip}
      <span class="preco">${pendente ? `<input class="valor" data-valor-exame="${esc(x.id)}" value="${valorCampo(x.valor)}" inputmode="decimal" aria-label="Valor de ${esc(x.nome)}">` : moeda(x.valor)}</span>
      <span class="acoes-item">${acoes}</span>
    </div>`;
}

// Catálogo de exames
function identificarExame(texto) {
  const t = String(texto || '').trim();
  const sem = t.replace(/ com contraste$/i, '');
  const item = estado.precos.exames.find((e) => e.nome.toLowerCase() === sem.toLowerCase());
  if (item) return { ...item };
  if (/^(raio[\s-]?x|rx)\b/i.test(t)) {
    const rx = estado.precos.exames.find((e) => e.categoria === 'Raio-X');
    return rx ? { categoria: 'Raio-X', nome: t, valor: rx.valor } : null;
  }
  return null;
}

async function salvarAtual(msg) {
  await Banco.salvarAtendimento(estado.atual);
  if (msg) avisar(msg);
  await carregarCaixa();
}

$('#comanda').addEventListener('input', (e) => {
  if (e.target.id === 'ex-nome') {
    $('#ex-contraste-campo').hidden = identificarExame(e.target.value)?.categoria !== 'Tomografia';
    e.target.setCustomValidity('');
  }
  if (estado.modo === 'novo') atualizarRascunho(e);
});

$('#comanda').addEventListener('change', async (e) => {
  if (estado.modo === 'novo') { atualizarRascunho(e); return; }
  const id = e.target.dataset.selExame;
  if (id !== undefined) {
    if (e.target.checked) estado.selecionados.add(id); else estado.selecionados.delete(id);
    const todos = $('#sel-todos');
    if (todos) todos.checked = (estado.atual.exames || []).filter((x) => x.status === 'PENDENTE').every((x) => estado.selecionados.has(x.id));
    renderPagamento();
    return;
  }
  if (e.target.id === 'sel-todos') {
    (estado.atual.exames || []).filter((x) => x.status === 'PENDENTE').forEach((x) => { if (e.target.checked) estado.selecionados.add(x.id); else estado.selecionados.delete(x.id); });
    renderComanda();
    return;
  }
  const idValor = e.target.dataset.valorExame;
  if (idValor) {
    const x = estado.atual.exames.find((y) => y.id === idValor);
    if (x && x.status === 'PENDENTE') { x.valor = lerMoeda(e.target.value); await salvarAtual(); }
  }
});

$('#comanda').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id !== 'form-exame') return;
  const campo = $('#ex-nome');
  const item = identificarExame(campo.value);
  if (!item) { campo.setCustomValidity('Exame não encontrado na tabela de preços. Escolha um item da lista.'); campo.reportValidity(); return; }
  if (item.categoria === 'Tomografia' && $('#ex-contraste').checked) { item.nome += ' com contraste'; item.valor += Number(estado.precos.adicionalContraste || 0); }
  const novo = { id: `E${Date.now()}${Math.floor(Math.random() * 100)}`, nome: item.nome, categoria: item.categoria, valor: item.valor, status: 'PENDENTE', pedidoEm: agoraIso() };
  estado.atual.exames = [...(estado.atual.exames || []), novo];
  estado.selecionados.add(novo.id);
  await salvarAtual();
  $('#ex-nome')?.focus();
});

$('#comanda').addEventListener('click', async (e) => {
  const rec = e.target.closest('[data-recibo]');
  if (rec) { mostrarRecibo(estado.pagamentosAtual.find((p) => p.id === rec.dataset.recibo)); return; }
  if (estado.modo === 'novo') { cliqueNovo(e); return; }

  if (e.target.id === 'btn-realizada') {
    if (!(await confirmar('Marcar a consulta como realizada? Depois disso os exames pedidos pelo médico podem ser lançados.', 'Consulta realizada'))) return;
    estado.atual.consultaRealizadaEm = agoraIso();
    await salvarAtual('Consulta realizada.');
    return;
  }
  const rem = e.target.closest('[data-remover-exame]');
  if (rem) {
    const x = estado.atual.exames.find((y) => y.id === rem.dataset.removerExame);
    if (!x || x.status !== 'PENDENTE' || !(await confirmar(`Remover "${x.nome}"? Só exames ainda não pagos podem ser removidos.`, 'Remover'))) return;
    estado.atual.exames = estado.atual.exames.filter((y) => y !== x);
    estado.selecionados.delete(x.id);
    await salvarAtual('Exame removido.');
    return;
  }
  const feito = e.target.closest('[data-realizar-exame]');
  if (feito) {
    const x = estado.atual.exames.find((y) => y.id === feito.dataset.realizarExame);
    if (!x || x.status !== 'PAGO') return;
    x.status = 'REALIZADO';
    x.realizadoEm = agoraIso();
    await salvarAtual(`${x.nome}: realizado.`);
  }
});

// =========================================================
//   NOVO ATENDIMENTO (comanda em branco)
// =========================================================
$('#btn-novo').addEventListener('click', () => {
  if (location.hash !== '#caixa') location.hash = '#caixa';
  estado.modo = 'novo';
  estado.selecionadoId = null;
  estado.atual = null;
  estado.rascunho = { paciente: null, tipo: 'CONSULTA', medicoId: '', valor: 0, nome: '', cpf: '', telefone: '' };
  limparPagamento();
  renderFila();
  renderComanda();
  $('#nv-busca')?.focus();
});

function renderNovo() {
  const r = estado.rascunho;
  const p = r.paciente;
  const medico = CONFIG.medicos.find((m) => String(m.id) === String(r.medicoId));
  $('#comanda').innerHTML = `
    <div class="comanda-cabeca">
      <div><h2>Novo atendimento</h2><p>Preencha o paciente e a consulta. O valor aparece no total ao lado.</p></div>
      <div class="comanda-num">ATENDIMENTO<b>Novo</b><button type="button" class="link" id="nv-cancelar">Cancelar</button></div>
    </div>
    <div class="comanda-corpo novo-form">
      <div class="cupom">
        <div class="cupom-titulo"><span>Paciente</span></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px">
          ${p ? `<div class="paciente-escolhido"><div><strong>${esc(p.nome)}</strong><br><small class="nota">${[p.cpf && `CPF ${esc(p.cpf)}`, esc(p.telefone || '')].filter(Boolean).join(' · ') || 'Paciente cadastrado'}</small></div>
                  <button type="button" class="link" id="nv-trocar">Trocar</button></div>` : `
            <div class="campo"><label for="nv-busca">Buscar paciente já cadastrado</label><input type="search" id="nv-busca" placeholder="Nome ou CPF"></div>
            <ul class="sugestoes" id="nv-sugestoes"></ul>
            <div class="grade-campos">
              <div class="campo"><label for="nv-nome">Nome completo *</label><input id="nv-nome" maxlength="120" value="${esc(r.nome)}"></div>
              <div class="campo"><label for="nv-cpf">CPF</label><input id="nv-cpf" maxlength="14" placeholder="000.000.000-00" value="${esc(r.cpf)}"></div>
              <div class="campo"><label for="nv-telefone">Telefone</label><input id="nv-telefone" maxlength="15" value="${esc(r.telefone)}"></div>
            </div>`}
        </div>
      </div>
      <div class="cupom">
        <div class="cupom-titulo"><span>Consulta</span></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px">
          <div class="segmentos" role="radiogroup" aria-label="Tipo de consulta">
            <label><input type="radio" name="nv-tipo" value="CONSULTA" ${r.tipo === 'CONSULTA' ? 'checked' : ''}><span>Consulta</span></label>
            <label><input type="radio" name="nv-tipo" value="PRONTO_SOCORRO" ${r.tipo === 'PRONTO_SOCORRO' ? 'checked' : ''}><span>Pronto Socorro</span></label>
          </div>
          <div class="grade-campos">
            <div class="campo"><label for="nv-medico">Médico *</label><select id="nv-medico">
              <option value="">Selecione</option>
              ${CONFIG.medicos.map((m) => `<option value="${m.id}" ${String(m.id) === String(r.medicoId) ? 'selected' : ''}>${esc(m.nome)} · ${esc(m.especialidade)}</option>`).join('')}
            </select></div>
            <div class="campo"><label for="nv-valor">Valor (R$)</label><input id="nv-valor" class="valor" inputmode="decimal" value="${valorCampo(r.valor)}" placeholder="0,00"></div>
          </div>
        </div>
        ${medico && r.valor ? `<div class="item"><span></span><span class="descr"><strong>${TIPOS[r.tipo].nome} · ${esc(medico.nome)}</strong><small>${TIPOS[r.tipo].descricao}</small></span><span class="chip pendente">A pagar</span><span class="preco">${moeda(r.valor)}</span></div>` : ''}
      </div>
      <p class="erro" id="nv-erro" role="alert"></p>
    </div>`;
}

function valorPadraoConsulta() {
  const r = estado.rascunho;
  const m = CONFIG.medicos.find((x) => String(x.id) === String(r.medicoId));
  return r.tipo === 'PRONTO_SOCORRO' ? estado.precos.prontoSocorro : (m?.valorConsulta || 0);
}

async function atualizarRascunho(e) {
  const r = estado.rascunho;
  const t = e.target;
  if (t.id === 'nv-busca' && e.type === 'input') {
    const txt = t.value.trim();
    estado.sugestoes = txt.length >= 2 ? await Banco.buscarPacientes(txt) : [];
    $('#nv-sugestoes').innerHTML = estado.sugestoes.slice(0, 8).map((p) => `<li><button type="button" data-paciente="${esc(p.id)}">${esc(p.nome)}<small>${esc(p.cpf || p.telefone || '')}</small></button></li>`).join('')
      || (txt.length >= 2 ? '<li><button type="button" disabled>Nenhum paciente encontrado. Preencha os dados abaixo.</button></li>' : '');
    if (txt && !/\d/.test(txt)) { $('#nv-nome').value = txt; r.nome = txt; }
    return;
  }
  if (t.id === 'nv-nome') r.nome = t.value;
  if (t.id === 'nv-cpf') r.cpf = t.value;
  if (t.id === 'nv-telefone') r.telefone = t.value;
  if (e.type !== 'change') return;
  if (t.name === 'nv-tipo') { r.tipo = t.value; r.valor = valorPadraoConsulta(); renderNovo(); }
  if (t.id === 'nv-medico') { r.medicoId = t.value; r.valor = valorPadraoConsulta(); renderNovo(); }
  if (t.id === 'nv-valor') { r.valor = lerMoeda(t.value); renderNovo(); }
  renderPagamento();
}

function cliqueNovo(e) {
  const r = estado.rascunho;
  if (e.target.id === 'nv-cancelar') { estado.modo = 'vazio'; limparPagamento(); renderComanda(); return; }
  if (e.target.id === 'nv-trocar') { r.paciente = null; renderNovo(); renderPagamento(); $('#nv-busca').focus(); return; }
  const b = e.target.closest('[data-paciente]');
  if (b) { r.paciente = estado.sugestoes.find((p) => p.id === b.dataset.paciente) || null; renderNovo(); renderPagamento(); }
}

// =========================================================
//   PAINEL DE PAGAMENTO
// =========================================================
function itensParaPagar() {
  if (estado.modo === 'novo') {
    const r = estado.rascunho;
    const m = CONFIG.medicos.find((x) => String(x.id) === String(r.medicoId));
    return m && r.valor ? [{ nome: `${TIPOS[r.tipo].nome} · ${m.nome}`, valor: r.valor }] : [];
  }
  if (estado.modo === 'atendimento' && estado.atual) {
    return (estado.atual.exames || []).filter((x) => x.status === 'PENDENTE' && estado.selecionados.has(x.id)).map((x) => ({ id: x.id, nome: x.nome, valor: x.valor }));
  }
  return [];
}

function totais() {
  const itens = itensParaPagar();
  const subtotal = itens.reduce((t, i) => t + Number(i.valor || 0), 0);
  const desconto = Math.min(lerMoeda($('#pg-desconto').value), subtotal);
  return { itens, subtotal, desconto, total: Math.round((subtotal - desconto) * 100) / 100 };
}

const formaEscolhida = () => document.querySelector('input[name="forma"]:checked')?.value || '';

function renderPagamento() {
  const { itens, subtotal, desconto, total } = totais();
  const forma = formaEscolhida();
  $('#visor-rotulo').textContent = estado.modo === 'novo' ? 'CONSULTA · TOTAL A PAGAR' : estado.modo === 'atendimento' ? 'EXAMES · TOTAL A PAGAR' : 'TOTAL A PAGAR';
  $('#visor-total').textContent = moeda(total);
  $('#visor-detalhe').textContent = !itens.length
    ? (estado.modo === 'atendimento' ? 'Marque os exames que o paciente vai pagar agora' : estado.modo === 'novo' ? 'Escolha o médico para ver o valor' : 'Nada a pagar')
    : `${itens.length} item(ns)${desconto ? ` · subtotal ${moeda(subtotal)} · desconto ${moeda(desconto)}` : ''}`;
  ['credito', 'debito', 'pix', 'dinheiro'].forEach((f) => { $(`#pg-campos-${f}`).hidden = forma !== f.toUpperCase(); });
  const sel = $('#pg-parcelas'); const atual = sel.value || '1';
  sel.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}x de ${moeda(total / n)}${n === 1 ? ' (à vista)' : ''}</option>`).join('');
  sel.value = atual;
  const troco = lerMoeda($('#pg-recebido').value) - total;
  $('#pg-troco').textContent = moeda(troco > 0 ? troco : 0);
  $('#btn-finalizar').disabled = !(itens.length && total && forma);
  $$('input[name="forma"]').forEach((r) => { r.disabled = !itens.length; });
  $('#pg-desconto').disabled = !itens.length;
}

function limparPagamento() {
  $$('#painel-pagamento input').forEach((i) => { if (i.type === 'radio') i.checked = false; else i.value = ''; });
  $('#pg-erro').textContent = '';
}

$('#painel-pagamento').addEventListener('input', () => { $('#pg-erro').textContent = ''; renderPagamento(); });
$('#painel-pagamento').addEventListener('change', renderPagamento);

$('#btn-finalizar').addEventListener('click', async () => {
  const erro = (t) => { $('#pg-erro').textContent = t; };
  const { itens, subtotal, desconto, total } = totais();
  const forma = formaEscolhida();
  if (!itens.length || !total) return erro('Não há valor a pagar.');
  if (!forma) return erro('Escolha a forma de pagamento.');
  const pg = { forma, valor: total, subtotal, desconto, itens: itens.map(({ nome, valor }) => ({ nome, valor })), dataHora: agoraIso() };
  if (forma === 'CREDITO') Object.assign(pg, { parcelas: Number($('#pg-parcelas').value), autorizacao: $('#pg-nsu-credito').value.trim() });
  if (forma === 'DEBITO') pg.autorizacao = $('#pg-nsu-debito').value.trim();
  if (forma === 'PIX') pg.idTransacao = $('#pg-pix').value.trim();
  if (forma === 'DINHEIRO') {
    const recebido = lerMoeda($('#pg-recebido').value);
    if (recebido < total) return erro(`O valor recebido é menor que o total (${moeda(total)}).`);
    Object.assign(pg, { recebido, troco: Math.round((recebido - total) * 100) / 100 });
  }

  if (estado.modo === 'novo') {
    const r = estado.rascunho;
    const paciente = r.paciente || { nome: (r.nome || '').trim(), cpf: (r.cpf || '').trim(), telefone: (r.telefone || '').trim() };
    if (!paciente.nome) return erro('Informe o nome do paciente (ou escolha um já cadastrado).');
    const medico = CONFIG.medicos.find((m) => String(m.id) === String(r.medicoId));
    const pac = paciente.id ? paciente : await Banco.salvarPaciente(paciente);
    let at = await Banco.salvarAtendimento({
      pacienteId: pac.id, pacienteNome: pac.nome, cpf: pac.cpf || '', telefone: pac.telefone || '',
      tipo: r.tipo, medicoId: medico.id, medicoNome: medico.nome, valorConsulta: total, abertoEm: pg.dataHora,
      consultaRealizadaEm: null, exames: [],
    });
    const salvo = await Banco.registrarPagamento({ ...pg, referente: 'CONSULTA', atendimentoId: at.id, atendimentoNumero: at.numero,
      pacienteNome: pac.nome, cpf: pac.cpf || '', medicoNome: medico.nome, tipoConsulta: r.tipo });
    at.pagamentoConsultaId = salvo.id;
    at = await Banco.salvarAtendimento(at);
    estado.data = dataLocal(new Date());
    estado.modo = 'atendimento';
    estado.selecionadoId = at.id;
    limparPagamento();
    await carregarCaixa();
    mostrarRecibo(salvo);
    return;
  }

  // Exames do atendimento aberto
  const a = estado.atual;
  const ids = itens.map((i) => i.id);
  const salvo = await Banco.registrarPagamento({ ...pg, referente: 'EXAMES', atendimentoId: a.id, atendimentoNumero: a.numero,
    pacienteNome: a.pacienteNome, cpf: a.cpf || '', medicoNome: a.medicoNome, tipoConsulta: a.tipo });
  a.exames.forEach((x) => { if (ids.includes(x.id)) Object.assign(x, { status: 'PAGO', pagoEm: salvo.dataHora, pagamentoId: salvo.id }); });
  await Banco.salvarAtendimento(a);
  estado.selecionados = new Set();
  limparPagamento();
  await carregarCaixa();
  mostrarRecibo(salvo);
});

// =========================================================
//   RECIBO
// =========================================================
function valorPorExtenso(valor) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n) => {
    if (n === 100) return 'cem';
    const p = []; const c = Math.floor(n / 100), r = n % 100;
    if (c) p.push(C[c]);
    if (r) p.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return p.join(' e ');
  };
  const inteiro = (n) => {
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    const g = [];
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

function mostrarRecibo(p) {
  if (!p) return;
  const h = CONFIG.hospital;
  const referente = p.referente === 'CONSULTA' ? (TIPOS[p.tipoConsulta]?.descricao.toLowerCase() || 'consulta') : 'exames';
  const det = [
    ['Forma de pagamento', NOMES_FORMA[p.forma]],
    p.parcelas > 1 && ['Parcelas', `${p.parcelas}x de ${moeda(p.valor / p.parcelas)}`],
    p.autorizacao && ['Autorização (NSU)', p.autorizacao],
    p.idTransacao && ['ID da transação Pix', p.idTransacao],
    p.forma === 'DINHEIRO' && ['Valor recebido', moeda(p.recebido)],
    p.forma === 'DINHEIRO' && ['Troco', moeda(p.troco || 0)],
    ['Médico', p.medicoNome],
    ['Atendimento', `nº ${p.atendimentoNumero}`],
  ].filter(Boolean);
  $('#recibo').innerHTML = `
    <div class="recibo">
      <div class="recibo-topo">
        <div><strong>${esc(h.nome)}</strong><span>CNPJ ${esc(h.cnpj)}</span><span>${esc(h.endereco)}</span><span>Tel. ${esc(h.telefone)}</span></div>
        <div class="recibo-num"><h3>RECIBO</h3><span>Nº ${esc(p.numeroRecibo)}</span><span>${dataBR(p.dataHora)} às ${horaBR(p.dataHora)}</span><span class="recibo-valor">${moeda(p.valor)}</span></div>
      </div>
      <p class="recibo-texto">Recebemos de <strong>${esc(p.pacienteNome)}</strong>${p.cpf ? `, CPF ${esc(p.cpf)},` : ''} a importância de
        <strong>${moeda(p.valor)}</strong> (${valorPorExtenso(p.valor)}), referente a ${esc(referente)} em atendimento particular, conforme os itens abaixo.</p>
      <table>
        <thead><tr><th>Descrição</th><th>Valor</th></tr></thead>
        <tbody>${p.itens.map((i) => `<tr><td>${esc(i.nome)}</td><td>${moeda(i.valor)}</td></tr>`).join('')}</tbody>
        <tfoot>
          ${p.desconto ? `<tr><td>Subtotal</td><td>${moeda(p.subtotal)}</td></tr><tr><td>Desconto</td><td>− ${moeda(p.desconto)}</td></tr>` : ''}
          <tr class="total"><td>Total pago</td><td>${moeda(p.valor)}</td></tr>
        </tfoot>
      </table>
      <div class="recibo-forma">${det.map(([k, v]) => `<div><span>${esc(k)}:</span> <strong>${esc(v)}</strong></div>`).join('')}</div>
      <div class="recibo-assinaturas"><div>Atendente</div><div>Assinatura / carimbo</div></div>
      <p class="recibo-rodape">Este recibo comprova o pagamento e não substitui a nota fiscal.</p>
    </div>`;
  $('#janela-recibo').hidden = false;
}
$('#btn-imprimir').addEventListener('click', () => window.print());

// =========================================================
//   PREÇOS
// =========================================================
function carregarPrecos() {
  const p = estado.precos;
  $('#pr-ps').value = valorCampo(p.prontoSocorro);
  $('#pr-contraste').value = valorCampo(p.adicionalContraste);
  $('#pr-medicos').innerHTML = CONFIG.medicos.map((m) => `<tr><td>${esc(m.nome)}</td><td>${esc(m.especialidade)}</td><td class="num">${moeda(m.valorConsulta)}</td></tr>`).join('');
  $('#pr-categorias').innerHTML = [...new Set(p.exames.map((e) => e.categoria))].map((c) => `<option value="${esc(c)}">`).join('');
  $('#pr-exames').innerHTML = p.exames.map((e, i) => `
    <tr><td>${esc(e.categoria)}</td><td>${esc(e.nome)}</td>
    <td class="num"><input class="valor" data-preco-exame="${i}" value="${valorCampo(e.valor)}" inputmode="decimal" aria-label="Valor de ${esc(e.nome)}"></td></tr>`).join('');
  $('#pr-qtd').textContent = `${p.exames.length} exames`;
  atualizarListaExames();
}

function atualizarListaExames() {
  let dl = $('#lista-exames');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'lista-exames'; document.body.appendChild(dl); }
  dl.innerHTML = estado.precos.exames.map((e) => `<option value="${esc(e.nome)}" label="${esc(e.categoria)} · ${moeda(e.valor)}">`).join('');
}

async function salvarPrecos(msg) {
  await Banco.salvarPrecos(estado.precos);
  $('#pr-status').textContent = msg;
  atualizarListaExames();
}
$('#pr-ps').addEventListener('change', (e) => { estado.precos.prontoSocorro = lerMoeda(e.target.value); salvarPrecos(`Consulta de Pronto Socorro: ${moeda(estado.precos.prontoSocorro)}.`); });
$('#pr-contraste').addEventListener('change', (e) => { estado.precos.adicionalContraste = lerMoeda(e.target.value); salvarPrecos(`Adicional de contraste: ${moeda(estado.precos.adicionalContraste)}.`); });
$('#pr-exames').addEventListener('change', (e) => {
  const i = e.target.dataset.precoExame;
  if (i === undefined) return;
  const ex = estado.precos.exames[i];
  ex.valor = lerMoeda(e.target.value);
  salvarPrecos(`${ex.nome}: ${moeda(ex.valor)}.`);
});
$('#form-novo-exame').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = $('#pr-nome').value.trim(), categoria = $('#pr-cat').value.trim(), valor = lerMoeda($('#pr-valor').value);
  if (!nome || !categoria || !valor) { $('#pr-status').textContent = 'Preencha categoria, nome e valor.'; return; }
  const ex = estado.precos.exames.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
  if (ex) Object.assign(ex, { categoria, valor }); else estado.precos.exames.push({ categoria, nome, valor });
  await salvarPrecos(ex ? `${nome}: valor atualizado.` : `${nome} incluído.`);
  e.target.reset();
  carregarPrecos();
});
$('#btn-restaurar-precos').addEventListener('click', async () => {
  if (!(await confirmar('Voltar todos os preços para o padrão? As alterações feitas aqui serão perdidas.', 'Restaurar'))) return;
  estado.precos = await Banco.restaurarPrecos();
  carregarPrecos();
  $('#pr-status').textContent = 'Preços restaurados para o padrão.';
});

// =========================================================
//   INÍCIO
// =========================================================
$('#nome-hospital').textContent = CONFIG.hospital.nome;
document.addEventListener('DOMContentLoaded', async () => {
  estado.precos = await Banco.lerPrecos();
  atualizarListaExames();
  abrirTela(location.hash.slice(1) || 'caixa');
});
