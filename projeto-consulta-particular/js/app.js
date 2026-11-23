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
    ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em atendimento', ALTA: 'Alta',
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

// ---------- Navegação entre telas ----------
const carregadores = {
  atendimento: carregarAtendimento,
  painel: carregarPainel,
  agenda: carregarAgenda,
  'nova-consulta': carregarFormularioConsulta,
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
  $('#atend-resultados').innerHTML = '';
  const caixa = $('#atend-paciente');
  if (!paciente) {
    caixa.hidden = true;
  } else {
    caixa.hidden = false;
    caixa.innerHTML = `
      <strong>${esc(paciente.nome)}</strong>
      <small style="display:block;color:var(--muted);margin-top:4px">
        CPF ${esc(paciente.cpf)} · Nasc. ${formatarData(paciente.nascimento)}
      </small>`;
  }
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
}

function atualizarBotaoAbrir() {
  $('#btn-abrir-atendimento').disabled = !(estado.paciente && estado.setor);
}

function renderAnteriores(atendimentos) {
  $('#tabela-anteriores').innerHTML = atendimentos.map((a) => `
    <tr>
      <td>${esc(a.numero)}</td>
      <td>${esc(a.senha)}</td>
      <td>${tagStatus(a.status)}</td>
      <td>${formatarDataHora(a.entrada)}</td>
      <td>${formatarDataHora(a.alta)}</td>
      <td>${esc(a.medico)}</td>
      <td>${formatarMoeda(a.valor)}</td>
      <td><button class="btn-acao" data-id="${esc(a.numero)}">Abrir</button></td>
    </tr>`).join('');
  $('#vazio-anteriores').hidden = atendimentos.length > 0;
  $('#vazio-anteriores').textContent = estado.paciente
    ? 'Nenhum atendimento anterior para este paciente.'
    : 'Selecione um paciente para visualizar os atendimentos anteriores.';
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
  // TODO: buscar setores da unidade e o nome da unidade
  // preencherSelect('#atend-setor', [{ valor: '93', texto: 'Consultório 1' }], 'Selecione o setor');
  // $('#atend-unidade').textContent = 'Nome da unidade';
  renderAnteriores([]);
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

$('#btn-novo-paciente').addEventListener('click', () => {
  // TODO: abrir cadastro de novo paciente
  location.hash = '#nova-consulta';
});

$('#atend-setor').addEventListener('change', (e) => {
  estado.setor = e.target.value;
  $('#atend-setor-nome').textContent = e.target.value ? e.target.selectedOptions[0].text : '';
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
});

$('#btn-atualizar-setor').addEventListener('click', () => carregarAtendimento());

function carregarAtendimentosAnteriores() {
  if (!estado.paciente) { renderAnteriores([]); return; }
  // TODO: buscar atendimentos anteriores do paciente (e do setor, se quiser)
  //   cada item: { numero, senha, status, entrada: 'AAAA-MM-DDTHH:MM', alta, medico, valor }
  renderAnteriores([]);
}

$('#btn-atualizar-anteriores').addEventListener('click', () => carregarAtendimentosAnteriores());

$('#btn-abrir-atendimento').addEventListener('click', () => {
  const dados = { paciente: estado.paciente, setor: estado.setor, tipo: 'PARTICULAR' };
  // TODO: abrir o atendimento particular e depois recarregar a lista
  console.log('Abrir atendimento', dados);
});

$('#btn-recibo').addEventListener('click', () => {
  // TODO: gerar/imprimir recibo da consulta
  console.log('Recibo de consulta');
});

$('#btn-etiqueta').addEventListener('click', () => {
  // TODO: imprimir etiqueta avulsa
  console.log('Etiqueta avulsa');
});

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
  if (!botao) return;
  // TODO: abrir detalhes do registro botao.dataset.id
  console.log('Ação no registro', botao.dataset.id);
});

// ---------- Início ----------
carregarUsuario();
abrirTela(location.hash.slice(1) || 'atendimento');
