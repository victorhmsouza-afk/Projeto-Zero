/* =========================================================
   Atendimento Particular · app.js
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

// Formata campos de valor ao sair deles (0,00)
document.addEventListener('focusout', (e) => {
  if (e.target.classList?.contains('valor') && e.target.value.trim()) e.target.value = valorCampo(lerMoeda(e.target.value));
});

// Aviso rápido no canto da tela
function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; }, 3500);
}

// ---------- Janelas ----------
function abrirJanela(id) { $(id).hidden = false; }
function fecharJanela(el) { el.closest('.fundo-janela').hidden = true; }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fechar]');
  if (b) { fecharJanela(b); if (b.closest('#janela-pagamento')) resolverPagamento(null); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const aberta = $$('.fundo-janela').reverse().find((j) => !j.hidden);
  if (!aberta) return;
  aberta.hidden = true;
  if (aberta.id === 'janela-pagamento') resolverPagamento(null);
  if (aberta.id === 'janela-confirmar') resolverConfirmacao(false);
});

// Confirmação dentro da página
let resolverConfirmacao = () => {};
function confirmar(texto, botao = 'Confirmar') {
  $('#cf-texto').textContent = texto;
  $('#cf-sim').textContent = botao;
  abrirJanela('#janela-confirmar');
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
  data: dataLocal(new Date()),  // dia mostrado em Atendimentos
  atendimentos: [],             // atendimentos do dia
  selecionadoId: null,
  novoPaciente: null,           // paciente escolhido na janela Novo atendimento
};

// ---------- Navegação ----------
const carregadores = {
  atendimentos: () => carregarAtendimentos(),
  precos: () => carregarPrecos(),
  // estatisticas: definido em estatisticas.js
};
function abrirTela(nome) {
  if (!carregadores[nome]) nome = 'atendimentos';
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${nome}`));
  $$('[data-tela]').forEach((a) => a.classList.toggle('ativa', a.dataset.tela === nome));
  carregadores[nome]();
}
window.addEventListener('hashchange', () => abrirTela(location.hash.slice(1)));

// =========================================================
//   ATENDIMENTOS
// =========================================================
function statusAtendimento(a) {
  if (!a.consultaRealizadaEm) return { texto: 'Aguardando consulta', classe: 'pendente' };
  const ex = a.exames || [];
  if (!ex.length) return { texto: 'Consulta realizada', classe: 'pago' };
  const pagos = ex.filter((x) => x.status !== 'PENDENTE').length;
  const feitos = ex.filter((x) => x.status === 'REALIZADO').length;
  if (pagos < ex.length) return { texto: `Exames: ${pagos} de ${ex.length} pagos`, classe: 'pendente' };
  if (feitos < ex.length) return { texto: `Exames pagos · ${feitos} de ${ex.length} feitos`, classe: 'pago' };
  return { texto: 'Exames concluídos', classe: 'realizado' };
}

async function carregarAtendimentos() {
  $('#at-data').value = estado.data;
  estado.atendimentos = (await Banco.listarAtendimentos({ inicio: estado.data, fim: estado.data }))
    .sort((a, b) => b.abertoEm.localeCompare(a.abertoEm));
  const pagamentos = await Banco.listarPagamentos({ inicio: estado.data, fim: estado.data });
  renderResumo(pagamentos);
  renderLista();
  await renderDetalhe();
}

function renderResumo(pagamentosDoDia) {
  const lista = estado.atendimentos;
  const consultas = lista.filter((a) => a.tipo === 'CONSULTA').length;
  const ps = lista.length - consultas;
  const recebido = pagamentosDoDia.reduce((t, p) => t + p.valor, 0);
  const pendentes = lista.flatMap((a) => (a.exames || []).filter((x) => x.status === 'PENDENTE'));
  const aPagar = pendentes.reduce((t, x) => t + x.valor, 0);
  const hoje = estado.data === dataLocal(new Date());
  $('#resumo-dia').innerHTML = [
    [hoje ? 'Atendimentos hoje' : 'Atendimentos no dia', lista.length, `${consultas} consulta(s) · ${ps} pronto socorro`],
    ['Recebido', moeda(recebido), `${pagamentosDoDia.length} pagamento(s)`],
    ['Exames a pagar', pendentes.length, pendentes.length ? `${moeda(aPagar)} em aberto` : 'nenhum em aberto'],
  ].map(([t, v, s]) => `<article><span>${t}</span><strong>${v}</strong><small>${s}</small></article>`).join('');
}

function renderLista() {
  const busca = $('#at-busca').value.trim().toLowerCase();
  const lista = estado.atendimentos.filter((a) => !busca || a.pacienteNome.toLowerCase().includes(busca) || String(a.numero).includes(busca));
  $('#lista-atend').innerHTML = lista.map((a) => {
    const s = statusAtendimento(a);
    return `
      <li><button type="button" data-atend="${esc(a.id)}" class="${a.id === estado.selecionadoId ? 'selecionado' : ''}">
        <span class="lista-linha"><strong>${esc(a.pacienteNome)}</strong><small>${horaBR(a.abertoEm)}</small></span>
        <span class="lista-meta"><span class="chip tipo">${TIPOS[a.tipo].nome}</span>${esc(a.medicoNome)} · nº ${a.numero}</span>
        <span><span class="chip ${s.classe}">${s.texto}</span></span>
      </button></li>`;
  }).join('');
  $('#lista-vazia').hidden = lista.length > 0;
  $('#lista-vazia').textContent = estado.atendimentos.length ? 'Nenhum atendimento encontrado.' : 'Nenhum atendimento neste dia.';
}

$('#lista-atend').addEventListener('click', (e) => {
  const b = e.target.closest('[data-atend]');
  if (!b) return;
  estado.selecionadoId = b.dataset.atend;
  renderLista();
  renderDetalhe();
});
$('#at-busca').addEventListener('input', renderLista);
$('#at-data').addEventListener('change', (e) => { estado.data = e.target.value || dataLocal(new Date()); estado.selecionadoId = null; carregarAtendimentos(); });

// ---------- Detalhe do atendimento ----------
async function renderDetalhe() {
  const area = $('#detalhe');
  const a = estado.selecionadoId ? await Banco.obterAtendimento(estado.selecionadoId) : null;
  if (!a) {
    area.innerHTML = '<div class="detalhe-vazio"><p><strong>Selecione um atendimento</strong> na lista ou clique em <strong>+ Novo atendimento</strong>.</p></div>';
    return;
  }
  const pagamentos = (await Banco.listarPagamentos({ atendimentoId: a.id })).sort((x, y) => x.dataHora.localeCompare(y.dataHora));
  const totalPago = pagamentos.reduce((t, p) => t + p.valor, 0);
  const realizada = !!a.consultaRealizadaEm;
  const ex = a.exames || [];
  const pendentes = ex.filter((x) => x.status === 'PENDENTE');
  const pagoExames = ex.filter((x) => x.status !== 'PENDENTE').reduce((t, x) => t + x.valor, 0);
  const aPagar = pendentes.reduce((t, x) => t + x.valor, 0);
  const pagConsulta = pagamentos.find((p) => p.id === a.pagamentoConsultaId);

  area.innerHTML = `
    <div class="detalhe-cabeca">
      <div>
        <h2>${esc(a.pacienteNome)}</h2>
        <p>Atendimento nº ${a.numero} · ${TIPOS[a.tipo].descricao} · ${esc(a.medicoNome)} · aberto em ${dataBR(a.abertoEm)} às ${horaBR(a.abertoEm)}</p>
        <p>${[a.cpf && `CPF ${esc(a.cpf)}`, a.telefone && `Tel. ${esc(a.telefone)}`].filter(Boolean).join(' · ') || 'Sem CPF/telefone cadastrado'}</p>
      </div>
      <div class="detalhe-total"><span>Total pago</span><strong>${moeda(totalPago)}</strong></div>
    </div>

    <section class="secao">
      <div class="secao-titulo">
        <h3><span class="numero-etapa feito">1</span>Consulta paga</h3>
        <span class="chip pago">Pago ${horaBR(pagConsulta?.dataHora || a.abertoEm)}</span>
      </div>
      <div class="linha-consulta">
        <p><strong>${TIPOS[a.tipo].nome} · ${esc(a.medicoNome)}</strong><br><small>${moeda(a.valorConsulta)} · ${pagConsulta ? NOMES_FORMA[pagConsulta.forma] : ''}</small></p>
        ${pagConsulta ? `<button type="button" class="link" data-recibo="${esc(pagConsulta.id)}">Ver recibo</button>` : ''}
      </div>
    </section>

    <section class="secao">
      <div class="secao-titulo">
        <h3><span class="numero-etapa ${realizada ? 'feito' : ''}">2</span>Consulta realizada</h3>
        ${realizada ? `<span class="chip realizado">Realizada ${horaBR(a.consultaRealizadaEm)}</span>` : ''}
      </div>
      ${realizada
        ? '<p class="nota" style="margin:0">O médico atendeu o paciente. Os exames pedidos entram abaixo.</p>'
        : '<button type="button" class="botao primario" id="btn-realizada">Marcar consulta como realizada</button>'}
    </section>

    <section class="secao">
      <div class="secao-titulo">
        <h3><span class="numero-etapa ${ex.length && !pendentes.length ? 'feito' : ''}">3</span>Exames pedidos pelo médico</h3>
        ${ex.length ? `<span class="nota">${ex.length} exame(s)</span>` : ''}
      </div>
      ${!realizada ? '<p class="bloqueado">Disponível depois que a consulta for realizada.</p>' : `
        <form class="form-exame" id="form-exame" autocomplete="off">
          <div class="campo">
            <label for="ex-nome">Adicionar exame</label>
            <input id="ex-nome" list="lista-exames" placeholder="Ex.: Hemograma completo, Tomografia de crânio, Raio-X de joelho">
          </div>
          <label class="check" id="ex-contraste-campo" hidden><input type="checkbox" id="ex-contraste">Com contraste (+ ${moeda(estado.precos.adicionalContraste)})</label>
          <button type="submit" class="botao">Adicionar</button>
        </form>
        ${ex.length ? `
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr>
              <th>${pendentes.length ? '<input type="checkbox" class="selecao" id="sel-todos" aria-label="Selecionar todos os exames a pagar">' : ''}</th>
              <th>Exame</th><th class="num">Valor</th><th>Situação</th><th class="acoes"></th>
            </tr></thead>
            <tbody>${ex.map((x) => linhaExame(x)).join('')}</tbody>
          </table>
        </div>
        <div class="barra-pagar">
          <div class="totais-exames">
            <span>Pago: <strong>${moeda(pagoExames)}</strong></span>
            <span>A pagar: <strong>${moeda(aPagar)}</strong></span>
          </div>
          <button type="button" class="botao primario" id="btn-pagar-exames" disabled>Pagar exames selecionados</button>
        </div>` : '<p class="nota" style="margin:0">Nenhum exame pedido. Se o médico pedir, adicione acima.</p>'}
      `}
    </section>

    <section class="secao">
      <div class="secao-titulo"><h3>Pagamentos</h3></div>
      <ul class="lista-pagamentos">
        ${pagamentos.map((p) => `
          <li>
            <div><strong>${p.referente === 'CONSULTA' ? 'Consulta' : `Exames (${p.itens.length})`} · ${moeda(p.valor)}</strong>
              <small>${dataBR(p.dataHora)} às ${horaBR(p.dataHora)} · ${NOMES_FORMA[p.forma]}${p.parcelas > 1 ? ` em ${p.parcelas}x` : ''} · recibo ${esc(p.numeroRecibo)}</small></div>
            <button type="button" class="link" data-recibo="${esc(p.id)}">Ver recibo</button>
          </li>`).join('')}
      </ul>
    </section>`;
  area.dataset.atendimento = a.id;
  atualizarBotaoPagarExames();
}

function linhaExame(x) {
  const situacao = {
    PENDENTE: '<span class="chip pendente">A pagar</span>',
    PAGO: `<span class="chip pago">Pago ${horaBR(x.pagoEm)}</span>`,
    REALIZADO: `<span class="chip realizado">Realizado ${horaBR(x.realizadoEm)}</span>`,
  }[x.status];
  const acao = x.status === 'PENDENTE'
    ? `<button type="button" class="link perigo" data-remover-exame="${esc(x.id)}">Remover</button>`
    : x.status === 'PAGO' ? `<button type="button" class="link" data-realizar-exame="${esc(x.id)}">Marcar como realizado</button>` : '';
  return `
    <tr>
      <td>${x.status === 'PENDENTE' ? `<input type="checkbox" class="selecao" data-sel-exame="${esc(x.id)}" aria-label="Selecionar ${esc(x.nome)}">` : ''}</td>
      <td><strong>${esc(x.nome)}</strong><br><small class="nota">${esc(x.categoria)}</small></td>
      <td class="num">${x.status === 'PENDENTE'
        ? `<input class="valor" data-valor-exame="${esc(x.id)}" value="${valorCampo(x.valor)}" inputmode="decimal" aria-label="Valor de ${esc(x.nome)}">`
        : moeda(x.valor)}</td>
      <td>${situacao}</td>
      <td class="acoes">${acao}</td>
    </tr>`;
}

function selecionadosExames() { return $$('[data-sel-exame]:checked').map((c) => c.dataset.selExame); }

function atualizarBotaoPagarExames() {
  const b = $('#btn-pagar-exames');
  if (!b) return;
  const a = estado.atendimentos.find((x) => x.id === estado.selecionadoId);
  const ids = selecionadosExames();
  const soma = (a?.exames || []).filter((x) => ids.includes(x.id)).reduce((t, x) => t + x.valor, 0);
  b.disabled = !ids.length;
  b.textContent = ids.length ? `Pagar ${ids.length} exame(s) · ${moeda(soma)}` : 'Pagar exames selecionados';
}

async function atendimentoAtual() { return Banco.obterAtendimento(estado.selecionadoId); }

async function salvarEAtualizar(a, mensagem) {
  await Banco.salvarAtendimento(a);
  if (mensagem) avisar(mensagem);
  await carregarAtendimentos();
}

// Catálogo para o campo de exames
function identificarExame(texto) {
  const t = String(texto || '').trim();
  const semContraste = t.replace(/ com contraste$/i, '');
  const item = estado.precos.exames.find((e) => e.nome.toLowerCase() === semContraste.toLowerCase());
  if (item) return { ...item };
  if (/^(raio[\s-]?x|rx)\b/i.test(t)) {
    const rx = estado.precos.exames.find((e) => e.categoria === 'Raio-X');
    return rx ? { categoria: 'Raio-X', nome: t, valor: rx.valor } : null;
  }
  return null;
}

$('#detalhe').addEventListener('input', async (e) => {
  if (e.target.id === 'ex-nome') {
    const item = identificarExame(e.target.value);
    $('#ex-contraste-campo').hidden = item?.categoria !== 'Tomografia';
    e.target.setCustomValidity('');
  }
});

$('#detalhe').addEventListener('change', async (e) => {
  if (e.target.dataset.selExame !== undefined || e.target.id === 'sel-todos') {
    if (e.target.id === 'sel-todos') $$('[data-sel-exame]').forEach((c) => { c.checked = e.target.checked; });
    atualizarBotaoPagarExames();
    return;
  }
  const idValor = e.target.dataset.valorExame;
  if (idValor) {
    const a = await atendimentoAtual();
    const x = a.exames.find((y) => y.id === idValor);
    if (x && x.status === 'PENDENTE') { x.valor = lerMoeda(e.target.value); await Banco.salvarAtendimento(a); await carregarAtendimentos(); }
  }
});

$('#detalhe').addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-exame') return;
  e.preventDefault();
  const campo = $('#ex-nome');
  const item = identificarExame(campo.value);
  if (!item) { campo.setCustomValidity('Exame não encontrado na tabela de preços. Escolha um item da lista.'); campo.reportValidity(); return; }
  if (item.categoria === 'Tomografia' && $('#ex-contraste').checked) {
    item.nome += ' com contraste';
    item.valor += Number(estado.precos.adicionalContraste || 0);
  }
  const a = await atendimentoAtual();
  a.exames = a.exames || [];
  a.exames.push({ id: `E${Date.now()}${Math.floor(Math.random() * 100)}`, nome: item.nome, categoria: item.categoria, valor: item.valor, status: 'PENDENTE', pedidoEm: agoraIso() });
  await salvarEAtendimentoFocando(a);
});

async function salvarEAtendimentoFocando(a) {
  await salvarEAtualizar(a);
  $('#ex-nome')?.focus();
}

$('#detalhe').addEventListener('click', async (e) => {
  const recibo = e.target.closest('[data-recibo]');
  if (recibo) { mostrarRecibo((await Banco.listarPagamentos()).find((p) => p.id === recibo.dataset.recibo)); return; }

  if (e.target.id === 'btn-realizada') {
    if (!(await confirmar('Marcar a consulta como realizada? Depois disso os exames pedidos pelo médico podem ser adicionados.', 'Consulta realizada'))) return;
    const a = await atendimentoAtual();
    a.consultaRealizadaEm = agoraIso();
    await salvarEAtualizar(a, 'Consulta marcada como realizada.');
    return;
  }

  const rem = e.target.closest('[data-remover-exame]');
  if (rem) {
    const a = await atendimentoAtual();
    const x = a.exames.find((y) => y.id === rem.dataset.removerExame);
    if (!x || x.status !== 'PENDENTE' || !(await confirmar(`Remover "${x.nome}"? Só exames ainda não pagos podem ser removidos.`, 'Remover'))) return;
    a.exames = a.exames.filter((y) => y !== x);
    await salvarEAtualizar(a, 'Exame removido.');
    return;
  }

  const feito = e.target.closest('[data-realizar-exame]');
  if (feito) {
    const a = await atendimentoAtual();
    const x = a.exames.find((y) => y.id === feito.dataset.realizarExame);
    if (!x || x.status !== 'PAGO') return;
    x.status = 'REALIZADO';
    x.realizadoEm = agoraIso();
    await salvarEAtualizar(a, `${x.nome}: realizado.`);
    return;
  }

  if (e.target.closest('#btn-pagar-exames')) {
    const ids = selecionadosExames();
    const a = await atendimentoAtual();
    const itens = a.exames.filter((x) => ids.includes(x.id) && x.status === 'PENDENTE');
    if (!itens.length) return;
    if (itens.some((x) => !x.valor)) { avisar('Há exame selecionado sem valor. Informe o valor antes de pagar.'); return; }
    const pg = await abrirPagamento({
      descricao: `Exames · ${a.pacienteNome} · atendimento nº ${a.numero}`,
      itens: itens.map((x) => ({ nome: x.nome, valor: x.valor })),
    });
    if (!pg) return;
    const salvo = await Banco.registrarPagamento({
      ...pg, referente: 'EXAMES', atendimentoId: a.id, atendimentoNumero: a.numero,
      pacienteNome: a.pacienteNome, cpf: a.cpf || '', medicoNome: a.medicoNome, tipoConsulta: a.tipo,
    });
    itens.forEach((x) => { x.status = 'PAGO'; x.pagoEm = salvo.dataHora; x.pagamentoId = salvo.id; });
    await Banco.salvarAtendimento(a);
    await carregarAtendimentos();
    mostrarRecibo(salvo);
  }
});

// =========================================================
//   NOVO ATENDIMENTO (consulta → pagamento)
// =========================================================
function tipoNovo() { return document.querySelector('input[name="tipo"]:checked').value; }

function preencherMedicosNovo() {
  $('#nv-medico').innerHTML = '<option value="">Selecione o médico</option>'
    + CONFIG.medicos.map((m) => `<option value="${m.id}">${esc(m.nome)} · ${esc(m.especialidade)}</option>`).join('');
}

function atualizarValorNovo() {
  const m = CONFIG.medicos.find((x) => String(x.id) === $('#nv-medico').value);
  const valor = tipoNovo() === 'PRONTO_SOCORRO' ? estado.precos.prontoSocorro : m?.valorConsulta;
  $('#nv-valor').value = valor ? valorCampo(valor) : '';
}

function mostrarPacienteEscolhido() {
  const p = estado.novoPaciente;
  $('#nv-escolhido').hidden = !p;
  $('#nv-campos').hidden = !!p;
  $('#nv-busca').closest('.campo').hidden = !!p;
  if (p) {
    $('#nv-escolhido').innerHTML = `<div><strong>${esc(p.nome)}</strong><br><small class="nota">${[p.cpf && `CPF ${esc(p.cpf)}`, p.telefone].filter(Boolean).map(esc).join(' · ') || 'Paciente cadastrado'}</small></div>
      <button type="button" class="link" id="nv-trocar">Trocar</button>`;
  }
}

$('#btn-novo').addEventListener('click', () => {
  $('#form-novo').reset();
  estado.novoPaciente = null;
  $('#nv-sugestoes').innerHTML = '';
  $('#nv-erro').textContent = '';
  preencherMedicosNovo();
  mostrarPacienteEscolhido();
  abrirJanela('#janela-novo');
  $('#nv-busca').focus();
});

$('#nv-busca').addEventListener('input', async (e) => {
  const t = e.target.value.trim();
  if (t.length < 2) { $('#nv-sugestoes').innerHTML = ''; return; }
  const lista = await Banco.buscarPacientes(t);
  estado.sugestoes = lista;
  $('#nv-sugestoes').innerHTML = lista.slice(0, 8).map((p) => `
    <li><button type="button" data-paciente="${esc(p.id)}">${esc(p.nome)}<small>${esc(p.cpf || p.telefone || '')}</small></button></li>`).join('')
    || '<li><button type="button" disabled>Nenhum paciente encontrado. Preencha os dados abaixo.</button></li>';
  if (!/\d/.test(t)) $('#nv-nome').value = t; // aproveita o nome digitado
});

$('#nv-sugestoes').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-paciente]');
  if (!b) return;
  estado.novoPaciente = (estado.sugestoes || []).find((p) => p.id === b.dataset.paciente) || null;
  $('#nv-sugestoes').innerHTML = '';
  mostrarPacienteEscolhido();
});

$('#nv-escolhido').addEventListener('click', (e) => {
  if (e.target.id !== 'nv-trocar') return;
  estado.novoPaciente = null;
  $('#nv-busca').value = '';
  mostrarPacienteEscolhido();
  $('#nv-busca').focus();
});

$('#nv-medico').addEventListener('change', atualizarValorNovo);
$$('input[name="tipo"]').forEach((r) => r.addEventListener('change', atualizarValorNovo));

$('#form-novo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const erro = (t) => { $('#nv-erro').textContent = t; };
  const paciente = estado.novoPaciente || {
    nome: $('#nv-nome').value.trim(), cpf: $('#nv-cpf').value.trim(), telefone: $('#nv-telefone').value.trim(),
  };
  if (!paciente.nome) return erro('Informe o nome do paciente (ou escolha um paciente já cadastrado).');
  const medico = CONFIG.medicos.find((m) => String(m.id) === $('#nv-medico').value);
  if (!medico) return erro('Escolha o médico.');
  const valor = lerMoeda($('#nv-valor').value);
  if (!valor) return erro('Informe o valor da consulta.');
  erro('');
  const tipo = tipoNovo();
  $('#janela-novo').hidden = true;

  const pg = await abrirPagamento({
    descricao: `${TIPOS[tipo].descricao} · ${paciente.nome}`,
    itens: [{ nome: `${TIPOS[tipo].nome} · ${medico.nome}`, valor }],
  });
  if (!pg) { $('#janela-novo').hidden = false; return; } // cancelou: volta para a janela

  const pacienteSalvo = paciente.id ? paciente : await Banco.salvarPaciente(paciente);
  let atendimento = await Banco.salvarAtendimento({
    pacienteId: pacienteSalvo.id, pacienteNome: pacienteSalvo.nome, cpf: pacienteSalvo.cpf || '', telefone: pacienteSalvo.telefone || '',
    tipo, medicoId: medico.id, medicoNome: medico.nome, valorConsulta: pg.valor, abertoEm: pg.dataHora,
    consultaRealizadaEm: null, exames: [],
  });
  const salvo = await Banco.registrarPagamento({
    ...pg, referente: 'CONSULTA', atendimentoId: atendimento.id, atendimentoNumero: atendimento.numero,
    pacienteNome: pacienteSalvo.nome, cpf: pacienteSalvo.cpf || '', medicoNome: medico.nome, tipoConsulta: tipo,
  });
  atendimento.pagamentoConsultaId = salvo.id;
  atendimento = await Banco.salvarAtendimento(atendimento);
  estado.data = dataLocal(new Date());
  estado.selecionadoId = atendimento.id;
  if (location.hash !== '#atendimentos') location.hash = '#atendimentos';
  await carregarAtendimentos();
  mostrarRecibo(salvo);
});

// =========================================================
//   PAGAMENTO
// =========================================================
let resolverPagamento = () => {};
let itensPagamentoAtual = [];

function abrirPagamento({ descricao, itens }) {
  const f = $('#form-pagamento');
  f.reset();
  itensPagamentoAtual = itens;
  $('#pg-descricao').textContent = descricao;
  $('#pg-itens').innerHTML = itens.map((i) => `<li><span>${esc(i.nome)}</span><span>${moeda(i.valor)}</span></li>`).join('');
  $('#pg-erro').textContent = '';
  atualizarPagamento();
  abrirJanela('#janela-pagamento');
  f.querySelector('input[name="forma"]').focus();
  return new Promise((r) => { resolverPagamento = (v) => { resolverPagamento = () => {}; r(v); }; });
}

function totaisPagamento() {
  const subtotal = itensPagamentoAtual.reduce((t, i) => t + Number(i.valor || 0), 0);
  const desconto = Math.min(lerMoeda($('#pg-desconto').value), subtotal);
  return { subtotal, desconto, total: Math.round((subtotal - desconto) * 100) / 100 };
}

function atualizarPagamento() {
  const forma = document.querySelector('input[name="forma"]:checked')?.value || '';
  ['credito', 'debito', 'pix', 'dinheiro'].forEach((f) => { $(`#pg-campos-${f}`).hidden = forma !== f.toUpperCase(); });
  const { total } = totaisPagamento();
  $('#pg-total').textContent = moeda(total);
  const sel = $('#pg-parcelas'); const atual = sel.value || '1';
  sel.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n}x de ${moeda(total / n)}${n === 1 ? ' (à vista)' : ''}</option>`).join('');
  sel.value = atual;
  const troco = lerMoeda($('#pg-recebido').value) - total;
  $('#pg-troco').textContent = moeda(troco > 0 ? troco : 0);
}
$('#form-pagamento').addEventListener('input', () => { $('#pg-erro').textContent = ''; atualizarPagamento(); });
$('#form-pagamento').addEventListener('change', atualizarPagamento);

$('#form-pagamento').addEventListener('submit', (e) => {
  e.preventDefault();
  const forma = document.querySelector('input[name="forma"]:checked')?.value;
  const { subtotal, desconto, total } = totaisPagamento();
  const erro = (t) => { $('#pg-erro').textContent = t; };
  if (!total) return erro('O total está zerado. Confira o desconto.');
  if (!forma) return erro('Escolha a forma de pagamento.');
  const pg = { forma, valor: total, subtotal, desconto, itens: itensPagamentoAtual, dataHora: agoraIso() };
  if (forma === 'CREDITO') Object.assign(pg, { parcelas: Number($('#pg-parcelas').value), autorizacao: $('#pg-nsu-credito').value.trim() });
  if (forma === 'DEBITO') pg.autorizacao = $('#pg-nsu-debito').value.trim();
  if (forma === 'PIX') pg.idTransacao = $('#pg-pix').value.trim();
  if (forma === 'DINHEIRO') {
    const recebido = lerMoeda($('#pg-recebido').value);
    if (recebido < total) return erro(`O valor recebido é menor que o total (${moeda(total)}).`);
    Object.assign(pg, { recebido, troco: Math.round((recebido - total) * 100) / 100 });
  }
  $('#janela-pagamento').hidden = true;
  resolverPagamento(pg);
});
$('#janela-pagamento').addEventListener('click', (e) => { if (e.target.id === 'janela-pagamento') { $('#janela-pagamento').hidden = true; resolverPagamento(null); } });

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
  const referente = p.referente === 'CONSULTA' ? TIPOS[p.tipoConsulta]?.descricao.toLowerCase() || 'consulta' : 'exames';
  const detalhes = [
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
      <div class="recibo-forma">${detalhes.map(([k, v]) => `<div><span>${esc(k)}:</span> <strong>${esc(v)}</strong></div>`).join('')}</div>
      <div class="recibo-assinaturas"><div>Atendente</div><div>Assinatura / carimbo</div></div>
      <p class="recibo-rodape">Este recibo comprova o pagamento e não substitui a nota fiscal.</p>
    </div>`;
  abrirJanela('#janela-recibo');
}
$('#btn-imprimir').addEventListener('click', () => window.print());

// =========================================================
//   PREÇOS
// =========================================================
async function carregarPrecos() {
  const p = estado.precos;
  $('#pr-ps').value = valorCampo(p.prontoSocorro);
  $('#pr-contraste').value = valorCampo(p.adicionalContraste);
  $('#pr-medicos').innerHTML = CONFIG.medicos.map((m) => `<tr><td>${esc(m.nome)}</td><td>${esc(m.especialidade)}</td><td class="num">${moeda(m.valorConsulta)}</td></tr>`).join('');
  const cats = [...new Set(p.exames.map((e) => e.categoria))];
  $('#pr-categorias').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
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
  const existente = estado.precos.exames.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
  if (existente) Object.assign(existente, { categoria, valor }); else estado.precos.exames.push({ categoria, nome, valor });
  await salvarPrecos(existente ? `${nome}: valor atualizado.` : `${nome} incluído.`);
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
  abrirTela(location.hash.slice(1) || 'atendimentos');
});
