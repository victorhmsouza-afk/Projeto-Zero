/* =========================================================
   Consulta Particular — app.js
   Aqui só existe a navegação entre telas e o "esqueleto"
   das funções. Toda a lógica (API, banco, regras) é sua:
   procure por  TODO  e preencha.
   ========================================================= */

// ---------- Configuração ----------
const CONFIG = {
  // TODO: endereço da sua API quando ela existir
  apiUrl: '',
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

function tagStatus(status) {
  const nomes = { AGENDADA: 'Agendada', CONFIRMADA: 'Confirmada', ATENDIDA: 'Atendida', CANCELADA: 'Cancelada' };
  const s = String(status || '').toUpperCase();
  return `<span class="tag tag-${s.toLowerCase()}">${nomes[s] || s}</span>`;
}

// Escapa texto antes de colocar dentro de innerHTML
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ---------- Navegação entre telas ----------
const TITULOS = {
  painel: 'Painel',
  agenda: 'Agenda',
  'nova-consulta': 'Nova consulta',
  pacientes: 'Pacientes',
  medicos: 'Médicos',
  financeiro: 'Financeiro',
  configuracoes: 'Configurações',
};

function abrirTela(nome) {
  if (!TITULOS[nome]) nome = 'painel';

  document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${nome}`));
  document.querySelectorAll('[data-tela]').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === nome));
  $('#titulo-tela').textContent = TITULOS[nome];
  $('#sidebar').classList.remove('aberta');

  // Carrega os dados da tela que foi aberta
  const carregadores = {
    painel: carregarPainel,
    agenda: carregarAgenda,
    'nova-consulta': carregarFormularioConsulta,
    pacientes: carregarPacientes,
    medicos: carregarMedicos,
    financeiro: carregarFinanceiro,
  };
  carregadores[nome]?.();
}

window.addEventListener('hashchange', () => abrirTela(location.hash.slice(1)));
$('#btn-menu').addEventListener('click', () => $('#sidebar').classList.toggle('aberta'));

// ---------- Renderização de tabelas (já pronto) ----------
// Passe um array de objetos e ele desenha as linhas.

function renderProximos(consultas) {
  $('#tabela-proximos').innerHTML = consultas.map((c) => `
    <tr>
      <td>${esc(c.horario)}</td>
      <td>${esc(c.paciente)}</td>
      <td>${esc(c.medico)}<br><small>${esc(c.especialidade)}</small></td>
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

function renderFinanceiro(recebimentos) {
  $('#tabela-financeiro').innerHTML = recebimentos.map((r) => `
    <tr>
      <td>${formatarData(r.data)}</td>
      <td>${esc(r.paciente)}</td>
      <td>${esc(r.medico)}</td>
      <td>${esc(r.formaPagamento)}</td>
      <td>${formatarMoeda(r.valor)}</td>
    </tr>`).join('');
  $('#vazio-financeiro').hidden = recebimentos.length > 0;
}

function preencherSelect(seletor, itens, textoPadrao = 'Selecione') {
  $(seletor).innerHTML = `<option value="">${textoPadrao}</option>` +
    itens.map((i) => `<option value="${esc(i.valor)}">${esc(i.texto)}</option>`).join('');
}

// =========================================================
//   SUA LÓGICA AQUI  (cada função é chamada pela tela)
// =========================================================

function carregarUsuario() {
  // TODO: buscar o usuário logado e preencher a barra superior
  // $('#usuario-nome').textContent = ...
  // $('#usuario-perfil').textContent = ...
  // $('#usuario-iniciais').textContent = ...
  // preencherSelect('#select-unidade', [{ valor: '1', texto: 'Unidade X' }], 'Selecione a unidade');
}

function carregarPainel() {
  // TODO: buscar consultas do dia e os números do resumo
  // $('#stat-agendadas').textContent = ...
  // $('#stat-recebido').textContent = formatarMoeda(...)
  renderProximos([]);
}

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

$('#form-consulta').addEventListener('submit', (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  // TODO: validar e enviar os dados para salvar a consulta
  console.log('Nova consulta', dados);
  $('#status-consulta').textContent = 'Formulário pronto. Falta ligar ao salvamento (TODO em app.js).';
});

$('#form-consulta').addEventListener('reset', () => {
  $('#status-consulta').textContent = '';
});

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

function carregarMedicos() {
  // TODO: buscar médicos e chamar renderMedicos(lista)
  renderMedicos([]);
}

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

$('#select-unidade').addEventListener('change', (e) => {
  // TODO: guardar a unidade escolhida e recarregar a tela atual
  console.log('Unidade', e.target.value);
});

$('#btn-sair').addEventListener('click', () => {
  // TODO: encerrar sessão
  console.log('Sair');
});

// Clique nos botões "Abrir / Ver / Editar" das tabelas
document.addEventListener('click', (e) => {
  const botao = e.target.closest('.btn-acao');
  if (!botao) return;
  // TODO: abrir detalhes do registro botao.dataset.id
  console.log('Ação no registro', botao.dataset.id);
});

// ---------- Início ----------
carregarUsuario();
abrirTela(location.hash.slice(1) || 'painel');
