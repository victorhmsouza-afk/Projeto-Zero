/* =========================================================
   Consulta Particular — app.js
   Aqui existe só a parte visual: troca de telas, menu e
   funções que desenham as tabelas. Toda a lógica (API,
   banco, regras) é sua: procure por  TODO  e preencha.
   ========================================================= */

// ---------- Configuração ----------
const CONFIG = {
  // TODO: endereço da sua API quando ela existir
  apiUrl: '',
};

// Estado da tela de atendimento
const estado = {
  paciente: null, // paciente selecionado
  setor: '',      // setor selecionado
  exames: { imagem: [], laboratorial: [] }, // requisição de exames em montagem
  modalidade: 'CONSULTA', // aba aberta no Atendimento: 'CONSULTA' ou 'PRONTO_SOCORRO'
  anteriores: [],         // atendimentos mostrados na tabela
  vinculoExames: null,    // atendimento de origem da requisição de exames (ex.: Pronto Socorro)
  medicosConsulta: [],    // médicos da aba Consulta: [{ id, nome, valorConsulta }]
  ultimoPagamento: null,  // último pagamento confirmado (para o recibo)
};

// Textos de cada aba do Atendimento
const MODALIDADES = {
  CONSULTA: {
    nome: 'Consulta',
    tipo: 'Consulta particular',
    titulo: 'Abrir consulta particular',
    dica: 'O pagamento é feito antes de abrir a consulta',
    botao: 'Pagar e abrir consulta',
    botaoIcone: '#i-dollar',
    icone: '#i-steth',
  },
  PRONTO_SOCORRO: {
    nome: 'Pronto Socorro',
    tipo: 'Pronto Socorro · exames particulares',
    titulo: 'Abrir atendimento de Pronto Socorro',
    dica: 'Basta o nome do paciente. Exames pedidos pelo médico são pagos antes de serem feitos',
    botao: 'Abrir atendimento',
    botaoIcone: '#i-clipboard',
    icone: '#i-heart',
  },
};

// ---------- Utilitários ----------
const $ = (seletor) => document.querySelector(seletor);

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataIso) {
  if (!dataIso) return '';
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '';
  return `${formatarData(dataIso)} ${dataIso.slice(11, 16)}`;
}

function tagStatus(status) {
  const nomes = {
    AGENDADA: 'Agendada', CONFIRMADA: 'Confirmada', ATENDIDA: 'Atendida', CANCELADA: 'Cancelada',
    ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em atendimento', ALTA: 'Alta', PAGO: 'Pago', PENDENTE: 'Pendente',
    AGUARDANDO: 'Aguardando consulta',
  };
  const s = String(status || '').toUpperCase();
  return `<span class="tag tag-${s.toLowerCase()}">${nomes[s] || esc(s)}</span>`;
}

// Escapa texto antes de colocar dentro de innerHTML
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function iniciais(nome) {
  return String(nome || '').trim().split(/\s+/).filter(Boolean)
    .map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '--';
}

function preencherSelect(seletor, itens, textoPadrao = 'Selecione') {
  $(seletor).innerHTML = `<option value="">${esc(textoPadrao)}</option>` +
    itens.map((i) => `<option value="${esc(i.valor)}">${esc(i.texto)}</option>`).join('');
}

// Confirmação dentro da página (substitui o confirm() do navegador)
function confirmar(mensagem, textoBotao = 'Confirmar') {
  return new Promise((resolver) => {
    const fundo = document.createElement('div');
    fundo.className = 'confirmacao-fundo';
    fundo.innerHTML = `
      <div class="confirmacao" role="alertdialog" aria-modal="true" aria-labelledby="confirmacao-texto">
        <p id="confirmacao-texto">${esc(mensagem)}</p>
        <div class="acoes">
          <button type="button" class="btn" data-resposta="nao">Cancelar</button>
          <button type="button" class="btn-primario" data-resposta="sim">${esc(textoBotao)}</button>
        </div>
      </div>`;
    const fechar = (resposta) => {
      fundo.remove();
      document.removeEventListener('keydown', teclas);
      resolver(resposta);
    };
    const teclas = (e) => { if (e.key === 'Escape') fechar(false); };
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) fechar(false);
      const b = e.target.closest('[data-resposta]');
      if (b) fechar(b.dataset.resposta === 'sim');
    });
    document.addEventListener('keydown', teclas);
    document.body.appendChild(fundo);
    fundo.querySelector('[data-resposta="sim"]').focus();
  });
}

// ---------- Navegação entre telas ----------
const carregadores = {
  atendimento: carregarAtendimento,
  painel: carregarPainel,
  agenda: carregarAgenda,
  'nova-consulta': carregarFormularioConsulta,
  exames: carregarExames,
  precos: carregarPrecos,
  pacientes: carregarPacientes,
  medicos: carregarMedicos,
  financeiro: carregarFinanceiro,
  relatorios: () => {},
  configuracoes: () => {},
};

function abrirTela(nome) {
  if (!carregadores[nome]) nome = 'atendimento';
  document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${nome}`));
  document.querySelectorAll('[data-tela]').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === nome));
  $('#sidebar').classList.remove('aberta');
  carregadores[nome]();
}

window.addEventListener('hashchange', () => abrirTela(location.hash.slice(1)));
$('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('aberta'));
$('#btn-recolher').addEventListener('click', () => $('#sidebar').classList.toggle('recolhida'));

// ---------- Renderização (já pronto) ----------

function renderResultadosBusca(pacientes) {
  $('#atend-resultados').innerHTML = pacientes.map((p, i) => `
    <li data-indice="${i}">
      <strong>${esc(p.nome)}</strong>
      <small>CPF ${esc(p.cpf)} · Nasc. ${formatarData(p.nascimento)}</small>
    </li>`).join('');
  // guarda a lista para o clique saber qual paciente foi escolhido
  $('#atend-resultados').dataset.lista = JSON.stringify(pacientes);
}

function selecionarPaciente(paciente) {
  estado.paciente = paciente;
  estado.vinculoExames = null;
  $('#atend-resultados').innerHTML = '';
  const caixa = $('#atend-paciente');
  if (!paciente) {
    caixa.hidden = true;
  } else {
    caixa.hidden = false;
    caixa.innerHTML = `
      <strong>${esc(paciente.nome)}</strong>
      <small style="display:block;color:var(--muted);margin-top:4px">
        ${[paciente.cpf && `CPF ${esc(paciente.cpf)}`, paciente.nascimento && `Nasc. ${formatarData(paciente.nascimento)}`]
          .filter(Boolean).join(' · ') || 'Cadastro rápido (só o nome)'}
      </small>`;
  }
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
}

function atualizarBotaoAbrir() {
  const precisaMedico = estado.modalidade === 'CONSULTA';
  $('#btn-abrir-atendimento').disabled = !(estado.paciente && estado.setor && (!precisaMedico || $('#atend-medico').value));
}

function renderAnteriores(atendimentos) {
  estado.anteriores = atendimentos;
  $('#tabela-anteriores').innerHTML = atendimentos.map((a) => `
    <tr>
      <td>${esc(a.numero)}</td>
      <td>${esc(a.senha)}</td>
      <td>${tagStatus(a.status)}</td>
      <td>${formatarDataHora(a.entrada)}</td>
      <td>${formatarDataHora(a.alta)}</td>
      <td>${esc(a.medico)}</td>
      <td>${a.valor
        ? `<span class="valor-pago">${formatarMoeda(a.valor)} ${tagStatus(a.pago ? 'PAGO' : 'PENDENTE')}</span>`
        : '<span style="color:var(--muted)">—</span>'}</td>
      <td><div class="acoes-linha">${acoesAtendimento(a)}</div></td>
    </tr>`).join('');
  renderEtapas();
  $('#vazio-anteriores').hidden = atendimentos.length > 0;
  $('#vazio-anteriores').textContent = estado.paciente
    ? `Nenhum atendimento de ${MODALIDADES[estado.modalidade].nome} para este paciente.`
    : 'Selecione um paciente para visualizar os atendimentos anteriores.';
}

// Botões de cada atendimento, conforme o fluxo:
//   Consulta:       paga → "Concluir consulta" → depois "Pedir exames"
//   Pronto Socorro: "Pedir exames" a qualquer momento
function consultaConcluida(a) {
  return ['ATENDIDA', 'ALTA'].includes(String(a.status).toUpperCase());
}

function acoesAtendimento(a) {
  const tipo = a.tipo || estado.modalidade;
  const n = esc(a.numero);
  const qtd = a.exames ? ` (${a.exames})` : '';
  const botaoExames = (destaque) =>
    `<button class="btn-acao${destaque ? ' destaque' : ''}" data-exames-atend="${n}" title="Exames pedidos pelo médico neste atendimento">Pedir exames${qtd}</button>`;
  if (tipo === 'CONSULTA') {
    if (!consultaConcluida(a)) {
      return a.pago
        ? `<button class="btn-acao destaque" data-concluir-atend="${n}">Concluir consulta</button>`
        : `<span class="dica">Aguardando pagamento</span>`;
    }
    return botaoExames(!a.exames);
  }
  return botaoExames(!a.exames);
}

// Etapas mostradas no topo do Atendimento
const ETAPAS = {
  CONSULTA: [
    { titulo: 'Paciente', dica: 'Buscar ou cadastrar' },
    { titulo: 'Pagamento', dica: 'Paga antes da consulta' },
    { titulo: 'Consulta', dica: 'Médico atende' },
    { titulo: 'Exames', dica: 'Se o médico pedir (pagos antes)' },
  ],
  PRONTO_SOCORRO: [
    { titulo: 'Paciente', dica: 'Basta o nome' },
    { titulo: 'Pronto Socorro', dica: 'Atendimento aberto' },
    { titulo: 'Exames', dica: 'Se o médico pedir' },
    { titulo: 'Pagamento', dica: 'Exames pagos antes de fazer' },
  ],
};

function atendimentoDeHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  return estado.anteriores.find((a) => String(a.entrada || '').slice(0, 10) === hoje && (a.tipo || estado.modalidade) === estado.modalidade);
}

function renderEtapas() {
  const a = estado.paciente ? atendimentoDeHoje() : null;
  let feitas;
  if (estado.modalidade === 'CONSULTA') {
    feitas = [!!estado.paciente, !!a?.pago, !!a && consultaConcluida(a), !!a?.exames];
  } else {
    feitas = [!!estado.paciente, !!a, !!a?.exames, !!a?.exames];
  }
  const atual = feitas.indexOf(false);
  $('#atend-etapas').innerHTML = ETAPAS[estado.modalidade].map((e, i) => `
    <li class="${feitas[i] ? 'feito' : i === atual ? 'atual' : ''}">
      <span class="etapa-num">${feitas[i] ? '✓' : i + 1}</span>
      <span class="etapa-texto"><strong>${e.titulo}</strong><small>${e.dica}</small></span>
    </li>`).join('');
}

function renderProximos(consultas) {
  $('#tabela-proximos').innerHTML = consultas.map((c) => `
    <tr>
      <td>${esc(c.horario)}</td>
      <td>${esc(c.paciente)}</td>
      <td>${esc(c.medico)} <small style="color:var(--muted)">${esc(c.especialidade)}</small></td>
      <td>${formatarMoeda(c.valor)}</td>
      <td>${tagStatus(c.status)}</td>
      <td><button class="btn-acao" data-id="${esc(c.id)}">Abrir</button></td>
    </tr>`).join('');
  $('#vazio-proximos').hidden = consultas.length > 0;
  $('#painel-contagem').textContent = `${consultas.length} consultas`;
}

function renderAgenda(consultas) {
  $('#tabela-agenda').innerHTML = consultas.map((c) => `
    <tr>
      <td>${formatarData(c.data)}</td>
      <td>${esc(c.horario)}</td>
      <td>${esc(c.paciente)}</td>
      <td>${esc(c.medico)}</td>
      <td>${formatarMoeda(c.valor)}</td>
      <td>${tagStatus(c.status)}</td>
      <td><button class="btn-acao" data-id="${esc(c.id)}">Abrir</button></td>
    </tr>`).join('');
  $('#vazio-agenda').hidden = consultas.length > 0;
}

function renderPacientes(pacientes) {
  $('#tabela-pacientes').innerHTML = pacientes.map((p) => `
    <tr>
      <td>${esc(p.nome)}</td>
      <td>${esc(p.cpf)}</td>
      <td>${esc(p.telefone)}</td>
      <td>${formatarData(p.ultimaConsulta)}</td>
      <td><button class="btn-acao" data-id="${esc(p.id)}">Ver</button></td>
    </tr>`).join('');
  $('#vazio-pacientes').hidden = pacientes.length > 0;
}

function renderMedicos(medicos) {
  $('#tabela-medicos').innerHTML = medicos.map((m) => `
    <tr>
      <td>${esc(m.nome)}</td>
      <td>${esc(m.crm)}</td>
      <td>${esc(m.especialidade)}</td>
      <td>${formatarMoeda(m.valorConsulta)}</td>
      <td><button class="btn-acao" data-id="${esc(m.id)}">Editar</button></td>
    </tr>`).join('');
  $('#vazio-medicos').hidden = medicos.length > 0;
}

// recebimentos: [{ data, paciente, tipo: 'CONSULTA' | 'EXAMES', medico, formaPagamento: 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO', valor }]
function renderFinanceiro(recebimentos) {
  const nomeTipo = { CONSULTA: 'Consulta', EXAMES: 'Exames' };
  $('#tabela-financeiro').innerHTML = recebimentos.map((r) => `
    <tr>
      <td>${formatarData(r.data)}</td>
      <td>${esc(r.paciente)}</td>
      <td>${esc(nomeTipo[r.tipo] || r.tipo || '')}</td>
      <td>${esc(r.medico)}</td>
      <td>${esc(NOMES_FORMA[r.formaPagamento] || r.formaPagamento)}</td>
      <td>${formatarMoeda(r.valor)}</td>
    </tr>`).join('');
  $('#vazio-financeiro').hidden = recebimentos.length > 0;

  // Totais por forma de pagamento
  const soma = (filtro) => recebimentos.filter(filtro).reduce((t, r) => t + Number(r.valor || 0), 0);
  $('#fin-total').textContent = formatarMoeda(soma(() => true));
  $('#fin-pix').textContent = formatarMoeda(soma((r) => r.formaPagamento === 'PIX'));
  $('#fin-cartao').textContent = formatarMoeda(soma((r) => r.formaPagamento === 'CREDITO' || r.formaPagamento === 'DEBITO'));
  $('#fin-dinheiro').textContent = formatarMoeda(soma((r) => r.formaPagamento === 'DINHEIRO'));

  // Recebido por médico
  const porMedico = {};
  recebimentos.forEach((r) => {
    const m = (porMedico[r.medico || 'Sem médico'] ||= { consultas: 0, exames: 0, total: 0 });
    if (r.tipo === 'EXAMES') m.exames += Number(r.valor || 0); else m.consultas += Number(r.valor || 0);
    m.total += Number(r.valor || 0);
  });
  const linhas = Object.entries(porMedico).sort((a, b) => b[1].total - a[1].total);
  $('#tabela-fin-medicos').innerHTML = linhas.map(([medico, v]) => `
    <tr>
      <td>${esc(medico)}</td>
      <td>${formatarMoeda(v.consultas)}</td>
      <td>${formatarMoeda(v.exames)}</td>
      <td><strong>${formatarMoeda(v.total)}</strong></td>
    </tr>`).join('');
  $('#vazio-fin-medicos').hidden = linhas.length > 0;
}

// =========================================================
//   SUA LÓGICA AQUI
// =========================================================

// ---------- Usuário logado ----------
function carregarUsuario() {
  // TODO: buscar o usuário logado
  const nome = 'Usuário';
  $('#usuario-nome').textContent = nome;
  $('#usuario-iniciais').textContent = iniciais(nome);
}

// ---------- Tela: Atendimento ----------
function carregarAtendimento() {
  // TODO: buscar o nome da unidade
  // $('#atend-unidade').textContent = 'Nome da unidade';
  carregarAtendimentosAnteriores();
}

// Setores da aba aberta (Consulta ou Pronto Socorro)
function carregarSetores() {
  // TODO: buscar os setores de estado.modalidade
  // preencherSelect('#atend-setor', [{ valor: '93', texto: 'Consultório 1' }], 'Selecione o setor');
  preencherSelect('#atend-setor', [], 'Selecione o setor');
}

// Troca entre as abas Consulta e Pronto Socorro
function trocarModalidade(modalidade) {
  estado.modalidade = modalidade;
  const m = MODALIDADES[modalidade];
  document.querySelectorAll('[data-modalidade]').forEach((aba) => {
    const ativa = aba.dataset.modalidade === modalidade;
    aba.classList.toggle('ativa', ativa);
    aba.setAttribute('aria-selected', ativa);
  });
  $('#atend-tipo').textContent = m.tipo;
  $('#atend-abrir-titulo').textContent = m.titulo;
  $('#atend-abrir-dica').textContent = m.dica;
  $('#atend-abrir-icone').setAttribute('href', m.icone);
  $('#atend-abrir-btn-texto').textContent = m.botao;
  $('#atend-abrir-btn-icone').setAttribute('href', m.botaoIcone);
  $('#linha-medico').hidden = modalidade !== 'CONSULTA';
  estado.setor = '';
  carregarSetores();
  atualizarTituloAnteriores();
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
}

document.querySelectorAll('[data-modalidade]').forEach((aba) =>
  aba.addEventListener('click', () => trocarModalidade(aba.dataset.modalidade)));

function atualizarTituloAnteriores() {
  const setor = estado.setor ? $('#atend-setor').selectedOptions[0]?.text : '';
  $('#atend-setor-nome').textContent = [MODALIDADES[estado.modalidade].nome, setor].filter(Boolean).join(' · ');
}

$('#form-busca-atend').addEventListener('submit', (e) => {
  e.preventDefault();
  const termo = $('#atend-busca').value.trim();
  if (!termo) return;
  // TODO: buscar pacientes por nome/CPF e chamar renderResultadosBusca(lista)
  //   cada item: { id, nome, cpf, nascimento: 'AAAA-MM-DD' }
  console.log('Buscar paciente', termo);
});

$('#atend-resultados').addEventListener('click', (e) => {
  const item = e.target.closest('li');
  if (!item) return;
  const lista = JSON.parse($('#atend-resultados').dataset.lista || '[]');
  selecionarPaciente(lista[item.dataset.indice]);
});

$('#btn-historico-busca').addEventListener('click', () => {
  // TODO: mostrar as últimas buscas / últimos pacientes atendidos
  console.log('Histórico de buscas');
});

// Cadastro rápido (no Pronto Socorro basta o nome)
$('#btn-novo-paciente').addEventListener('click', () => {
  const f = $('#form-paciente-rapido');
  f.hidden = !f.hidden;
  if (!f.hidden) {
    const termo = $('#atend-busca').value.trim();
    if (termo && !/\d/.test(termo)) $('#rap-nome').value = termo; // aproveita o nome digitado na busca
    $('#rap-nome').focus();
  }
});

$('#btn-cancelar-rapido').addEventListener('click', () => {
  $('#form-paciente-rapido').reset();
  $('#form-paciente-rapido').hidden = true;
});

$('#form-paciente-rapido').addEventListener('submit', async (e) => {
  e.preventDefault();
  const paciente = {
    nome: $('#rap-nome').value.trim(),
    cpf: $('#rap-cpf').value.trim(),
    nascimento: $('#rap-nascimento').value,
    telefone: $('#rap-telefone').value.trim(),
  };
  if (!paciente.nome) return;
  const salvo = await cadastrarPaciente(paciente);
  e.target.reset();
  e.target.hidden = true;
  selecionarPaciente(salvo);
});

async function cadastrarPaciente(paciente) {
  // TODO: salvar o paciente novo e devolver com o id gerado
  console.log('Cadastrar paciente', paciente);
  return { id: `novo-${Date.now()}`, ...paciente };
}

$('#atend-setor').addEventListener('change', (e) => {
  estado.setor = e.target.value;
  atualizarTituloAnteriores();
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
});

$('#btn-atualizar-setor').addEventListener('click', () => { estado.setor = ''; carregarSetores(); atualizarTituloAnteriores(); atualizarBotaoAbrir(); });

function carregarAtendimentosAnteriores() {
  if (!estado.paciente) { renderAnteriores([]); return; }
  // TODO: buscar atendimentos anteriores do paciente na aba aberta (estado.modalidade)
  //   cada item: { numero, tipo: 'CONSULTA' | 'PRONTO_SOCORRO', senha, status,
  //                entrada: 'AAAA-MM-DDTHH:MM', alta, medico, valor }
  renderAnteriores([]);
}

$('#btn-atualizar-anteriores').addEventListener('click', () => carregarAtendimentosAnteriores());

// ---------- Médicos da aba Consulta ----------
function carregarMedicosConsulta() {
  // TODO: buscar médicos que atendem consulta particular e chamar:
  // preencherMedicosConsulta([{ id: 1, nome: 'Dr. Fulano', valorConsulta: 250 }]);
  preencherMedicosConsulta([]);
}

function preencherMedicosConsulta(lista) {
  estado.medicosConsulta = lista;
  preencherSelect('#atend-medico', lista.map((m) => ({ valor: m.id, texto: m.nome })), 'Selecione o médico');
  $('#atend-valor-consulta').textContent = '—';
}

function medicoConsultaSelecionado() {
  return estado.medicosConsulta.find((m) => String(m.id) === $('#atend-medico').value);
}

$('#atend-medico').addEventListener('change', () => {
  const m = medicoConsultaSelecionado();
  $('#atend-valor-consulta').textContent = m ? formatarMoeda(m.valorConsulta) : '—';
  atualizarBotaoAbrir();
});

// ---------- Abrir atendimento ----------
// Consulta: abre a janela de pagamento primeiro; só abre a consulta se o pagamento for confirmado.
// Pronto Socorro: abre direto (os exames são pagos na tela de Exames).
$('#btn-abrir-atendimento').addEventListener('click', async () => {
  const setor = $('#atend-setor').selectedOptions[0]?.text || '';
  const dados = { paciente: estado.paciente, setor: estado.setor, modalidade: estado.modalidade };

  if (estado.modalidade === 'CONSULTA') {
    const m = medicoConsultaSelecionado();
    const pagamento = await abrirPagamento({
      descricao: `Consulta particular · ${estado.paciente.nome}`,
      itens: [{ nome: `Consulta · ${m?.nome || 'médico'} · ${setor}`, valor: m?.valorConsulta || 0 }],
      valor: m?.valorConsulta || 0,
      valorEditavel: true,
      contexto: { tipo: 'CONSULTA', paciente: estado.paciente.nome, medico: m?.nome || '' },
    });
    if (!pagamento) return; // cancelou: a consulta NÃO é aberta
    dados.medico = m;
    dados.valor = pagamento.valor;
    dados.pagamento = pagamento;
  }

  await registrarAtendimento(dados);
  carregarAtendimentosAnteriores();
});

async function registrarAtendimento(dados) {
  // TODO: salvar o atendimento (consulta ou pronto socorro).
  //   dados = { paciente, setor, modalidade, medico?, valor?, pagamento? }
  //   Na consulta, dados.pagamento sempre existe (já foi confirmado).
  console.log('Abrir atendimento', dados);
}

// =========================================================
//   JANELA DE PAGAMENTO
//   abrirPagamento({ descricao, itens, valor, valorEditavel, desconto })
//   devolve o pagamento confirmado, ou null se cancelar.
// =========================================================
let resolverPagamento = null;

let contextoPagamento = null;

function abrirPagamento({ descricao = '', itens = [], valor = 0, valorEditavel = false, desconto = 0, contexto = null } = {}) {
  const f = $('#form-pagamento');
  contextoPagamento = contexto; // { tipo: 'CONSULTA' | 'EXAMES', paciente, medico }
  f.reset();
  $('#pg-descricao').textContent = descricao;
  $('#pg-itens').innerHTML = itens.map((i) => `<li><span>${esc(i.nome)}</span><span>${formatarMoeda(i.valor)}</span></li>`).join('')
    + (desconto ? `<li class="desconto"><span>Desconto</span><span>− ${formatarMoeda(desconto)}</span></li>` : '');
  $('#pg-valor').value = valorCampo(valor);
  $('#pg-valor').readOnly = !valorEditavel;
  $('#pg-erro').textContent = '';
  atualizarFormaPagamento();
  $('#modal-pagamento').hidden = false;
  (valorEditavel && !valor ? $('#pg-valor') : f.querySelector('input[name="pgForma"]')).focus();
  return new Promise((resolver) => { resolverPagamento = resolver; });
}

function fecharPagamento(resultado) {
  $('#modal-pagamento').hidden = true;
  if (resolverPagamento) resolverPagamento(resultado);
  resolverPagamento = null;
}

function formaPagamentoAtual() {
  return document.querySelector('input[name="pgForma"]:checked')?.value || '';
}

function atualizarFormaPagamento() {
  const forma = formaPagamentoAtual();
  ['credito', 'debito', 'pix', 'dinheiro'].forEach((f) => { $(`#pg-campos-${f}`).hidden = forma !== f.toUpperCase(); });
  const total = lerMoeda($('#pg-valor').value);
  const sel = $('#pg-parcelas'), atual = sel.value || '1';
  sel.innerHTML = [1, 2, 3, 4, 5, 6].map((n) =>
    `<option value="${n}">${n}x de ${formatarMoeda(total / n)}${n === 1 ? ' (à vista)' : ''}</option>`).join('');
  sel.value = atual;
  const troco = lerMoeda($('#pg-recebido').value) - total;
  $('#pg-troco').textContent = formatarMoeda(troco > 0 ? troco : 0);
  $('#pg-erro').textContent = '';
}

$('#form-pagamento').addEventListener('input', atualizarFormaPagamento);
$('#form-pagamento').addEventListener('change', atualizarFormaPagamento);
document.querySelectorAll('[data-pg-cancelar]').forEach((b) => b.addEventListener('click', () => fecharPagamento(null)));
$('#modal-pagamento').addEventListener('click', (e) => { if (e.target.id === 'modal-pagamento') fecharPagamento(null); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-pagamento').hidden) fecharPagamento(null); });

$('#form-pagamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const valor = lerMoeda($('#pg-valor').value);
  const forma = formaPagamentoAtual();
  const erro = (t) => { $('#pg-erro').textContent = t; };
  if (!valor) return erro('Informe o valor a pagar.');
  if (!forma) return erro('Escolha a forma de pagamento.');

  const pagamento = { forma, valor, dataHora: new Date().toISOString() };
  if (forma === 'CREDITO') Object.assign(pagamento, { parcelas: Number($('#pg-parcelas').value), autorizacao: $('#pg-nsu-credito').value.trim() });
  if (forma === 'DEBITO') pagamento.autorizacao = $('#pg-nsu-debito').value.trim();
  if (forma === 'PIX') pagamento.idTransacao = $('#pg-id-pix').value.trim();
  if (forma === 'DINHEIRO') {
    const recebido = lerMoeda($('#pg-recebido').value);
    if (recebido < valor) return erro(`Valor recebido menor que o total (${formatarMoeda(valor)}).`);
    Object.assign(pagamento, { recebido, troco: Math.round((recebido - valor) * 100) / 100 });
  }
  if (contextoPagamento) pagamento.contexto = contextoPagamento;
  estado.ultimoPagamento = pagamento;
  await registrarPagamento(pagamento);
  fecharPagamento(pagamento);
});

// Todo pagamento confirmado passa por aqui (consulta ou exames).
// pagamento.contexto = { tipo: 'CONSULTA' | 'EXAMES', paciente, medico }
async function registrarPagamento(pagamento) {
  // TODO: gravar o recebimento no seu sistema (é ele que alimenta o Financeiro)
  console.log('Pagamento confirmado', pagamento);
}

const NOMES_FORMA = { PIX: 'Pix', CREDITO: 'Cartão de crédito', DEBITO: 'Cartão de débito', DINHEIRO: 'Dinheiro' };
function descreverPagamento(p) {
  if (!p) return '';
  let t = `${formatarMoeda(p.valor)} no ${NOMES_FORMA[p.forma] || p.forma}`;
  if (p.parcelas > 1) t += ` em ${p.parcelas}x`;
  if (p.troco) t += ` (troco ${formatarMoeda(p.troco)})`;
  return t;
}

// Botão "Exames" de um atendimento de Pronto Socorro: abre a requisição vinculada a ele
document.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-exames-atend]');
  if (!botao) return;
  const a = estado.anteriores.find((x) => String(x.numero) === botao.dataset.examesAtend);
  estado.vinculoExames = { modalidade: a?.tipo || estado.modalidade, numero: a?.numero, entrada: a?.entrada, medico: a?.medico };
  location.hash = '#exames';
});

// Botão "Concluir consulta": o médico atendeu; a partir daí pode pedir exames
document.addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-concluir-atend]');
  if (!botao) return;
  const a = estado.anteriores.find((x) => String(x.numero) === botao.dataset.concluirAtend);
  if (!a || !(await confirmar(`Marcar a consulta ${a.numero} como realizada?`, 'Concluir consulta'))) return;
  await registrarConclusaoConsulta(a);
  carregarAtendimentosAnteriores();
});

async function registrarConclusaoConsulta(atendimento) {
  // TODO: marcar a consulta como realizada (status ATENDIDA) no seu sistema
  console.log('Concluir consulta', atendimento);
}

// Botão "Exames" do topo: requisição avulsa, sem vínculo
$('#btn-exames-avulso').addEventListener('click', () => { estado.vinculoExames = null; });

$('#btn-recibo').addEventListener('click', () => {
  // TODO: gerar/imprimir recibo do último pagamento (estado.ultimoPagamento)
  console.log('Recibo de consulta');
});

$('#btn-etiqueta').addEventListener('click', () => {
  // TODO: imprimir etiqueta avulsa
  console.log('Etiqueta avulsa');
});

// ---------- Valores em reais ----------
// Converte "1.234,56", "180", "180,5" ou "R$ 90,00" em número
function lerMoeda(texto) {
  let s = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

// Número para "1.234,56" (sem o R$), para colocar dentro de campos
function valorCampo(n) {
  return n ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}

// Ao sair de um campo de valor, deixa no formato 0,00
document.addEventListener('focusout', (e) => {
  if (e.target.classList?.contains('input-valor') && e.target.value.trim()) {
    e.target.value = valorCampo(lerMoeda(e.target.value));
  }
});

// ---------- Tabela de preços ----------
// Valores e códigos de EXEMPLO: ajuste para a tabela real.
// TODO: quando tiver API, buscar a tabela de lá em vez do navegador.

const CATEGORIAS_EXAME = ['Ultrassonografia', 'Tomografia', 'Ressonância magnética', 'Raio-X', 'Mamografia',
  'Densitometria', 'Eletrocardiograma', 'Ecocardiograma', 'Endoscopia', 'Outro'];

const PRECOS_EXEMPLO = {
  imagem: [
    { categoria: 'Ultrassonografia', nome: 'USG de abdome total', valor: 180 },
    { categoria: 'Ultrassonografia', nome: 'USG de abdome superior', valor: 150 },
    { categoria: 'Ultrassonografia', nome: 'USG pélvica', valor: 140 },
    { categoria: 'Ultrassonografia', nome: 'USG transvaginal', valor: 150 },
    { categoria: 'Ultrassonografia', nome: 'USG de tireoide', valor: 140 },
    { categoria: 'Ultrassonografia', nome: 'USG de mamas', valor: 160 },
    { categoria: 'Ultrassonografia', nome: 'USG de rins e vias urinárias', valor: 150 },
    { categoria: 'Ultrassonografia', nome: 'USG de próstata', valor: 150 },
    { categoria: 'Ultrassonografia', nome: 'USG obstétrica', valor: 160 },
    { categoria: 'Tomografia', nome: 'TC de crânio', valor: 350 },
    { categoria: 'Tomografia', nome: 'TC de tórax', valor: 420 },
    { categoria: 'Tomografia', nome: 'TC de abdome total', valor: 650 },
    { categoria: 'Tomografia', nome: 'TC de seios da face', valor: 330 },
    { categoria: 'Tomografia', nome: 'TC de coluna lombar', valor: 450 },
    { categoria: 'Ressonância magnética', nome: 'RM de crânio', valor: 800 },
    { categoria: 'Ressonância magnética', nome: 'RM de coluna lombar', valor: 850 },
    { categoria: 'Ressonância magnética', nome: 'RM de joelho', valor: 750 },
    { categoria: 'Ressonância magnética', nome: 'RM de ombro', valor: 750 },
    { categoria: 'Raio-X', nome: 'RX de tórax PA e perfil', valor: 90 },
    { categoria: 'Raio-X', nome: 'RX de coluna lombar', valor: 100 },
    { categoria: 'Raio-X', nome: 'RX de joelho', valor: 80 },
    { categoria: 'Raio-X', nome: 'RX de seios da face', valor: 80 },
    { categoria: 'Mamografia', nome: 'Mamografia bilateral', valor: 150 },
    { categoria: 'Densitometria', nome: 'Densitometria óssea', valor: 160 },
    { categoria: 'Eletrocardiograma', nome: 'Eletrocardiograma (ECG)', valor: 60 },
    { categoria: 'Ecocardiograma', nome: 'Ecocardiograma transtorácico', valor: 250 },
    { categoria: 'Endoscopia', nome: 'Endoscopia digestiva alta', valor: 350 },
    { categoria: 'Endoscopia', nome: 'Colonoscopia', valor: 700 },
  ],
  laboratorial: [
    { codigo: '40304361', nome: 'Hemograma completo', valor: 25 },
    { codigo: '40302040', nome: 'Glicose', valor: 10 },
    { codigo: '40301630', nome: 'Creatinina', valor: 12 },
  ],
};

const CHAVE_PRECOS = 'consultaParticular.tabelaPrecos';
let precos = carregarTabelaPrecos();

function copiarExemplos() {
  return JSON.parse(JSON.stringify(PRECOS_EXEMPLO));
}

function carregarTabelaPrecos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PRECOS));
    if (salvo && Array.isArray(salvo.imagem) && Array.isArray(salvo.laboratorial)) return salvo;
  } catch (e) { /* navegador sem armazenamento: usa os exemplos */ }
  return copiarExemplos();
}

function salvarTabelaPrecos() {
  try { localStorage.setItem(CHAVE_PRECOS, JSON.stringify(precos)); } catch (e) { /* ignora */ }
}

const normalizar = (t) => String(t || '').trim().toLowerCase();
const precoImagem = (nome) => precos.imagem.find((p) => normalizar(p.nome) === normalizar(nome));
const precoLab = (codigo) => precos.laboratorial.find((p) => normalizar(p.codigo) === normalizar(codigo));

// Preenche todos os <select> de tipo de exame
document.querySelectorAll('.sel-categoria').forEach((sel) => {
  sel.innerHTML = CATEGORIAS_EXAME.map((c) => `<option>${esc(c)}</option>`).join('');
});

function carregarPrecos() {
  renderPrecos();
}

function botaoRemover(atributos) {
  return `<button type="button" class="btn-icone btn-remover" ${atributos} title="Remover"><svg class="i"><use href="#i-trash"/></svg></button>`;
}

function renderPrecos() {
  $('#tabela-pr-imagem').innerHTML = precos.imagem.map((p, i) => `
    <tr>
      <td>${esc(p.categoria)}</td>
      <td>${esc(p.nome)}</td>
      <td><input class="input-tabela input-valor" data-preco="imagem" data-indice="${i}" value="${valorCampo(p.valor)}" inputmode="decimal" aria-label="Valor de ${esc(p.nome)}"></td>
      <td>${botaoRemover(`data-remover-preco="imagem" data-indice="${i}"`)}</td>
    </tr>`).join('');
  $('#tabela-pr-lab').innerHTML = precos.laboratorial.map((p, i) => `
    <tr>
      <td>${esc(p.codigo)}</td>
      <td>${esc(p.nome)}</td>
      <td><input class="input-tabela input-valor" data-preco="laboratorial" data-indice="${i}" value="${valorCampo(p.valor)}" inputmode="decimal" aria-label="Valor de ${esc(p.nome)}"></td>
      <td>${botaoRemover(`data-remover-preco="laboratorial" data-indice="${i}"`)}</td>
    </tr>`).join('');
  $('#pill-pr-imagem').textContent = `${precos.imagem.length} exames`;
  $('#pill-pr-lab').textContent = `${precos.laboratorial.length} exames`;
}

// Alterar valor direto na tabela de preços
document.querySelector('#tela-precos').addEventListener('change', (e) => {
  const lista = e.target.dataset.preco;
  if (!lista) return;
  precos[lista][e.target.dataset.indice].valor = lerMoeda(e.target.value);
  salvarTabelaPrecos();
  $('#status-precos').textContent = 'Valor atualizado.';
});

document.querySelector('#tela-precos').addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-remover-preco]');
  if (!botao) return;
  const item = precos[botao.dataset.removerPreco][botao.dataset.indice];
  if (!(await confirmar(`Remover "${item.nome}" da tabela de preços?`, 'Remover'))) return;
  precos[botao.dataset.removerPreco].splice(Number(botao.dataset.indice), 1);
  salvarTabelaPrecos();
  renderPrecos();
});

$('#form-preco-imagem').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = $('#pr-nome').value.trim();
  const valor = lerMoeda($('#pr-valor').value);
  if (!valor) { $('#status-precos').textContent = 'Informe um valor maior que zero.'; return; }
  const existente = precoImagem(nome);
  if (existente) Object.assign(existente, { categoria: $('#pr-categoria').value, valor });
  else precos.imagem.push({ categoria: $('#pr-categoria').value, nome, valor });
  salvarTabelaPrecos();
  renderPrecos();
  e.target.reset();
  $('#status-precos').textContent = existente ? `Valor de "${nome}" atualizado.` : `"${nome}" incluído.`;
});

$('#form-preco-lab').addEventListener('submit', (e) => {
  e.preventDefault();
  const codigo = $('#pr-codigo').value.trim();
  const nome = $('#pr-nome-lab').value.trim();
  const valor = lerMoeda($('#pr-valor-lab').value);
  if (!valor) { $('#status-precos').textContent = 'Informe um valor maior que zero.'; return; }
  const existente = precoLab(codigo);
  if (existente) Object.assign(existente, { nome, valor });
  else precos.laboratorial.push({ codigo, nome, valor });
  salvarTabelaPrecos();
  renderPrecos();
  e.target.reset();
  $('#status-precos').textContent = existente ? `Valor do nº ${codigo} atualizado.` : `Nº ${codigo} incluído.`;
});

$('#btn-restaurar-precos').addEventListener('click', async () => {
  if (!(await confirmar('Voltar a tabela de preços para os valores de exemplo? Suas alterações serão perdidas.', 'Restaurar'))) return;
  precos = copiarExemplos();
  salvarTabelaPrecos();
  renderPrecos();
  $('#status-precos').textContent = 'Tabela restaurada.';
});

// ---------- Tela: Exames ----------
// A montagem da lista (adicionar, numerar, precificar, remover) já funciona.
// Falta só o salvamento e a lista de médicos (TODO).

function carregarExames() {
  // TODO: preencher a lista de médicos solicitantes
  // preencherSelect('#ex-medico', [{ valor: '1', texto: 'Dr. Fulano' }]);
  if (!$('#ex-data').value) $('#ex-data').value = new Date().toISOString().slice(0, 10);
  renderPacienteExames();
  renderVinculoExames();
  atualizarSugestoesExames();
  trocarTipoExame(false);
  renderExames();
}

function renderPacienteExames() {
  const p = estado.paciente;
  $('#ex-paciente').innerHTML = p
    ? `<div class="paciente-selecionado"><strong>${esc(p.nome)}</strong>
         <small style="display:block;color:var(--muted);margin-top:4px">CPF ${esc(p.cpf)} · Nasc. ${formatarData(p.nascimento)}</small></div>`
    : `<p class="paciente-vazio">Nenhum paciente selecionado.<br><a href="#atendimento">Selecione na tela Atendimento</a>.</p>`;
}

function renderVinculoExames() {
  const v = estado.vinculoExames;
  $('#ex-vinculo').innerHTML = v
    ? `<div class="paciente-selecionado"><strong>${esc(MODALIDADES[v.modalidade]?.nome || v.modalidade)} · Atend. ${esc(v.numero)}</strong>
         <small style="display:block;color:var(--muted);margin-top:4px">Entrada ${formatarDataHora(v.entrada)}${v.medico && v.medico !== '—' ? ' · ' + esc(v.medico) : ''}</small></div>
       <div class="vinculo-acoes"><button type="button" class="btn btn-pequeno" id="btn-desvincular">Tornar avulsa</button></div>`
    : `<p class="paciente-vazio">Requisição avulsa.<br>Para vincular a uma consulta ou atendimento de Pronto Socorro, use o botão <strong>Pedir exames</strong> na lista de atendimentos.</p>`;
  $('#btn-desvincular')?.addEventListener('click', () => { estado.vinculoExames = null; renderVinculoExames(); });
}

function tipoExameAtual() {
  return document.querySelector('input[name="tipoExame"]:checked').value;
}

function atualizarSugestoesExames() {
  const categoria = $('#ex-categoria').value;
  $('#sugestoes-exames').innerHTML = precos.imagem
    .filter((p) => p.categoria === categoria)
    .map((p) => `<option value="${esc(p.nome)}" label="${formatarMoeda(p.valor)}">`).join('');
}

function trocarTipoExame(focar = true) {
  const lab = tipoExameAtual() === 'laboratorial';
  $('#campos-imagem').hidden = lab;
  $('#campos-lab').hidden = !lab;
  $('#dica-exame').textContent = lab
    ? 'Digite o nº laboratorial: nome e valor vêm da tabela de preços. Para vários de uma vez, separe por vírgula ou espaço.'
    : 'Escolha ou digite o nome do exame: o valor vem da tabela de preços e pode ser alterado.';
  if (focar) (lab ? $('#ex-codigo') : $('#ex-nome')).focus();
}

document.querySelectorAll('input[name="tipoExame"]').forEach((r) => r.addEventListener('change', () => trocarTipoExame()));
$('#ex-categoria').addEventListener('change', () => { atualizarSugestoesExames(); $('#ex-nome').focus(); });

// Ao escolher o exame, puxa o valor da tabela de preços
$('#ex-nome').addEventListener('input', (e) => {
  e.target.setCustomValidity('');
  const p = precoImagem(e.target.value);
  if (p) {
    $('#ex-valor').value = valorCampo(p.valor);
    $('#ex-categoria').value = p.categoria;
  }
});

$('#ex-codigo').addEventListener('input', (e) => {
  e.target.setCustomValidity('');
  const p = precoLab(e.target.value);
  if (p) {
    $('#ex-nome-lab').value = p.nome;
    $('#ex-valor-lab').value = valorCampo(p.valor);
  }
});

$('#form-exame').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#status-exames').textContent = '';

  if (tipoExameAtual() === 'imagem') {
    const campo = $('#ex-nome');
    const nome = campo.value.trim();
    if (!nome) { campo.setCustomValidity('Digite o nome do exame.'); campo.reportValidity(); return; }
    const valor = lerMoeda($('#ex-valor').value) || precoImagem(nome)?.valor || 0;
    estado.exames.imagem.push({ categoria: $('#ex-categoria').value, nome, valor });
    campo.value = '';
    $('#ex-valor').value = '';
    campo.focus();
  } else {
    const campo = $('#ex-codigo');
    const codigos = campo.value.split(/[\s,;]+/).filter(Boolean);
    if (!codigos.length) { campo.setCustomValidity('Digite o nº laboratorial.'); campo.reportValidity(); return; }
    const umSo = codigos.length === 1;
    const repetidos = [];
    codigos.forEach((codigo) => {
      if (estado.exames.laboratorial.some((x) => x.codigo === codigo)) { repetidos.push(codigo); return; }
      const p = precoLab(codigo);
      estado.exames.laboratorial.push({
        codigo,
        nome: (umSo && $('#ex-nome-lab').value.trim()) || p?.nome || '',
        valor: (umSo && lerMoeda($('#ex-valor-lab').value)) || p?.valor || 0,
      });
    });
    if (repetidos.length) $('#status-exames').textContent = `Já estava na lista: ${repetidos.join(', ')}`;
    campo.value = '';
    $('#ex-nome-lab').value = '';
    $('#ex-valor-lab').value = '';
    campo.focus();
  }
  renderExames();
});

function campoValorTabela(lista, i, valor) {
  return `<input class="input-tabela input-valor${valor ? '' : ' sem-valor'}" data-valor-exame="${lista}" data-indice="${i}"
    value="${valorCampo(valor)}" inputmode="decimal" placeholder="0,00" aria-label="Valor do item ${i + 1}">`;
}

function renderExames() {
  const { imagem, laboratorial } = estado.exames;

  $('#tabela-ex-imagem').innerHTML = imagem.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(x.categoria)}</td>
      <td>${esc(x.nome)}</td>
      <td>${campoValorTabela('imagem', i, x.valor)}</td>
      <td>${botaoRemover(`data-remover="imagem" data-indice="${i}"`)}</td>
    </tr>`).join('');

  $('#tabela-ex-lab').innerHTML = laboratorial.map((x, i) => `
    <tr>
      <td><span class="num-lab">${String(i + 1).padStart(2, '0')}</span></td>
      <td><input class="input-tabela" data-editar-lab="${i}" value="${esc(x.codigo)}" aria-label="Nº laboratorial do item ${i + 1}"></td>
      <td>${esc(x.nome) || '<span style="color:var(--muted)">—</span>'}</td>
      <td>${campoValorTabela('laboratorial', i, x.valor)}</td>
      <td>${botaoRemover(`data-remover="laboratorial" data-indice="${i}"`)}</td>
    </tr>`).join('');

  $('#vazio-ex-imagem').hidden = imagem.length > 0;
  $('#vazio-ex-lab').hidden = laboratorial.length > 0;
  $('#pill-imagem').textContent = `${imagem.length} exame${imagem.length === 1 ? '' : 's'}`;
  $('#pill-lab').textContent = `${laboratorial.length} exame${laboratorial.length === 1 ? '' : 's'}`;
  $('#ex-total-imagem').textContent = `(${imagem.length})`;
  $('#ex-total-lab').textContent = `(${laboratorial.length})`;
  $('#btn-salvar-exames').disabled = imagem.length + laboratorial.length === 0;
  atualizarTotaisExames();
}

function calcularTotaisExames() {
  const soma = (lista) => lista.reduce((t, x) => t + (x.valor || 0), 0);
  const subtotalImagem = soma(estado.exames.imagem);
  const subtotalLaboratorial = soma(estado.exames.laboratorial);
  const bruto = subtotalImagem + subtotalLaboratorial;
  const desconto = Math.min(lerMoeda($('#ex-desconto').value), bruto);
  const semValor = [...estado.exames.imagem, ...estado.exames.laboratorial].filter((x) => !x.valor).length;
  return { subtotalImagem, subtotalLaboratorial, desconto, total: Math.round((bruto - desconto) * 100) / 100, semValor };
}

function atualizarTotaisExames() {
  const t = calcularTotaisExames();
  $('#ex-subtotal-imagem').textContent = formatarMoeda(t.subtotalImagem);
  $('#ex-subtotal-lab').textContent = formatarMoeda(t.subtotalLaboratorial);
  $('#ex-total').textContent = formatarMoeda(t.total);
  const aviso = $('#ex-aviso-sem-valor');
  aviso.hidden = t.semValor === 0;
  aviso.textContent = t.semValor === 1 ? '1 exame está sem valor.' : `${t.semValor} exames estão sem valor.`;
}

$('#ex-desconto').addEventListener('input', atualizarTotaisExames);

// Remover exame
document.querySelector('#tela-exames').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-remover]');
  if (!botao) return;
  estado.exames[botao.dataset.remover].splice(Number(botao.dataset.indice), 1);
  renderExames();
});

// Corrigir nº laboratorial ou valor direto na tabela
document.querySelector('#tela-exames').addEventListener('input', (e) => {
  const d = e.target.dataset;
  if (d.editarLab !== undefined) estado.exames.laboratorial[d.editarLab].codigo = e.target.value.trim();
  if (d.valorExame) {
    estado.exames[d.valorExame][d.indice].valor = lerMoeda(e.target.value);
    e.target.classList.toggle('sem-valor', !lerMoeda(e.target.value));
    atualizarTotaisExames();
  }
});

$('#btn-limpar-exames').addEventListener('click', async () => {
  const total = estado.exames.imagem.length + estado.exames.laboratorial.length;
  if (total && !(await confirmar('Remover todos os exames da requisição?', 'Limpar tudo'))) return;
  estado.exames = { imagem: [], laboratorial: [] };
  $('#ex-obs').value = '';
  $('#ex-desconto').value = '';
  $('#status-exames').textContent = '';
  renderExames();
});

$('#btn-salvar-exames').addEventListener('click', async () => {
  if (!estado.paciente) {
    $('#status-exames').textContent = 'Selecione um paciente na tela Atendimento antes de salvar.';
    return;
  }
  const t = calcularTotaisExames();
  if (t.semValor) {
    $('#status-exames').textContent = 'Informe o valor de todos os exames antes de salvar.';
    return;
  }
  const requisicao = {
    paciente: estado.paciente,
    origem: estado.vinculoExames, // null = avulsa; ou { modalidade: 'PRONTO_SOCORRO', numero, entrada, medico }
    medico: $('#ex-medico').value,
    data: $('#ex-data').value,
    observacoes: $('#ex-obs').value.trim(),
    imagem: estado.exames.imagem,             // [{ categoria, nome, valor }]
    laboratorial: estado.exames.laboratorial.map((x, i) => ({ numero: i + 1, ...x })), // [{ numero, codigo, nome, valor }]
    subtotalImagem: t.subtotalImagem,
    subtotalLaboratorial: t.subtotalLaboratorial,
    desconto: t.desconto,
    total: t.total,
  };
  if (!t.total) {
    $('#status-exames').textContent = 'O total está zerado. Confira os valores e o desconto.';
    return;
  }

  // Pagamento obrigatório antes de salvar
  const origem = estado.vinculoExames ? ` · ${MODALIDADES[estado.vinculoExames.modalidade]?.nome} atend. ${estado.vinculoExames.numero}` : '';
  const pagamento = await abrirPagamento({
    descricao: `Exames particulares · ${estado.paciente.nome}${origem}`,
    itens: [
      ...estado.exames.imagem.map((x) => ({ nome: x.nome, valor: x.valor })),
      ...estado.exames.laboratorial.map((x, i) => ({ nome: `${String(i + 1).padStart(2, '0')} · ${x.nome || 'Nº ' + x.codigo}`, valor: x.valor })),
    ],
    valor: t.total,
    desconto: t.desconto,
    valorEditavel: false,
    contexto: {
      tipo: 'EXAMES',
      paciente: estado.paciente.nome,
      medico: ($('#ex-medico').value && $('#ex-medico').selectedOptions[0].text) || estado.vinculoExames?.medico || '',
    },
  });
  if (!pagamento) {
    $('#status-exames').textContent = 'Pagamento cancelado. A requisição não foi salva.';
    return;
  }
  requisicao.pagamento = pagamento;
  await salvarRequisicaoExames(requisicao);
  $('#status-exames').textContent = `Pagamento confirmado: ${descreverPagamento(pagamento)}.`;
});

async function salvarRequisicaoExames(requisicao) {
  // TODO: salvar a requisição (e depois limpar a lista, se quiser).
  //   requisicao.pagamento sempre existe aqui (já foi confirmado).
  console.log('Salvar requisição de exames', requisicao);
}

// ---------- Tela: Painel ----------
function carregarPainel() {
  // TODO: buscar consultas do dia e os números do resumo
  // $('#stat-agendadas').textContent = ...
  // $('#stat-recebido').textContent = formatarMoeda(...)
  renderProximos([]);
}

// ---------- Tela: Agenda ----------
function carregarAgenda() {
  // TODO: preencher a lista de médicos do filtro
  // preencherSelect('#filtro-medico', [...], 'Todos');
}

$('#form-filtro-agenda').addEventListener('submit', (e) => {
  e.preventDefault();
  const filtros = {
    data: $('#filtro-data').value,
    medico: $('#filtro-medico').value,
    status: $('#filtro-status').value,
  };
  // TODO: buscar consultas com esses filtros e chamar renderAgenda(lista)
  console.log('Filtrar agenda', filtros);
  renderAgenda([]);
});

// ---------- Tela: Agendar consulta ----------
function carregarFormularioConsulta() {
  // TODO: preencher especialidades
  // preencherSelect('#cons-especialidade', [...]);
}

$('#cons-especialidade').addEventListener('change', (e) => {
  // TODO: carregar médicos da especialidade escolhida
  // preencherSelect('#cons-medico', [...]);
  console.log('Especialidade', e.target.value);
});

$('#cons-medico').addEventListener('change', () => {
  // TODO: carregar horários livres e o valor da consulta do médico
  // preencherSelect('#cons-horario', [...]);
  // $('#pag-valor').value = ...
});

$('#cons-data').addEventListener('change', () => {
  // TODO: recarregar horários livres para a nova data
});

$('#pac-cpf').addEventListener('blur', (e) => {
  // TODO: buscar paciente pelo CPF e preencher os campos se já existir
  console.log('Buscar CPF', e.target.value);
});

// Agendar consulta: o pagamento é feito na hora de agendar
$('#form-consulta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  const valor = lerMoeda(dados.valor);
  const medico = $('#cons-medico').selectedOptions[0]?.text || '';
  if (!valor) {
    $('#status-consulta').textContent = 'Informe o valor da consulta.';
    return;
  }
  const pagamento = await abrirPagamento({
    descricao: `Consulta particular · ${dados.nome}`,
    itens: [{ nome: `Consulta · ${medico} · ${formatarData(dados.data)} às ${dados.horario}`, valor }],
    valor,
    valorEditavel: true,
    contexto: { tipo: 'CONSULTA', paciente: dados.nome, medico },
  });
  if (!pagamento) {
    $('#status-consulta').textContent = 'Pagamento cancelado. A consulta não foi agendada.';
    return;
  }
  dados.valor = pagamento.valor;
  dados.pagamento = pagamento;
  await agendarConsulta(dados);
  e.target.reset();
  $('#status-consulta').textContent = `Consulta agendada e paga: ${descreverPagamento(pagamento)}.`;
});

async function agendarConsulta(dados) {
  // TODO: salvar a consulta agendada. dados.pagamento sempre existe aqui (já foi confirmado).
  //   dados = { cpf, nome, nascimento, telefone, email, especialidade, medico, data, horario, valor, observacoes, pagamento }
  console.log('Agendar consulta', dados);
}

$('#form-consulta').addEventListener('reset', () => {
  $('#status-consulta').textContent = '';
});

// ---------- Tela: Pacientes ----------
function carregarPacientes() {
  // TODO: carregar lista inicial (opcional)
  renderPacientes([]);
}

$('#form-busca-paciente').addEventListener('submit', (e) => {
  e.preventDefault();
  const termo = $('#busca-paciente').value.trim();
  // TODO: buscar pacientes por nome/CPF e chamar renderPacientes(lista)
  console.log('Buscar paciente', termo);
});

// ---------- Tela: Médicos ----------
function carregarMedicos() {
  // TODO: buscar médicos e chamar renderMedicos(lista)
  renderMedicos([]);
}

// ---------- Tela: Financeiro ----------
function carregarFinanceiro() {
  // TODO: carregar recebimentos do período padrão
  renderFinanceiro([]);
}

$('#form-filtro-financeiro').addEventListener('submit', (e) => {
  e.preventDefault();
  const periodo = { inicio: $('#fin-inicio').value, fim: $('#fin-fim').value };
  // TODO: buscar recebimentos e totais; chamar renderFinanceiro(lista)
  // $('#fin-total').textContent = formatarMoeda(...)
  console.log('Filtrar financeiro', periodo);
});

// ---------- Barra superior ----------
$('#btn-busca-global').addEventListener('click', () => {
  // TODO: busca geral
  console.log('Busca geral');
});

$('#btn-notificacoes').addEventListener('click', () => {
  // TODO: notificações
  console.log('Notificações');
});

$('#btn-usuario').addEventListener('click', () => {
  // TODO: menu do usuário (perfil, trocar unidade, etc.)
  console.log('Menu do usuário');
});

$('#btn-sair').addEventListener('click', () => {
  // TODO: encerrar sessão
  console.log('Sair');
});

// Clique nos botões "Abrir / Ver / Editar" das tabelas
document.addEventListener('click', (e) => {
  const botao = e.target.closest('.btn-acao');
  if (!botao || botao.dataset.examesAtend || botao.dataset.concluirAtend) return;
  // TODO: abrir detalhes do registro botao.dataset.id
  console.log('Ação no registro', botao.dataset.id);
});

// ---------- Início ----------
renderEtapas();
carregarUsuario();
carregarSetores();
carregarMedicosConsulta();
abrirTela(location.hash.slice(1) || 'atendimento');
