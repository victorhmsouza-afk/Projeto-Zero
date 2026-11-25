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
  // Dados que aparecem no cabeçalho do recibo (TODO: preencher com os dados reais)
  empresa: {
    nome: 'Hospital da Saúde',
    cnpj: '00.000.000/0000-00',
    endereco: 'Endereço da unidade',
    telefone: '(00) 0000-0000',
  },
  reciboAutomatico: true, // abre o recibo logo depois de cada pagamento
};

// =========================================================
//   CADASTROS DO HOSPITAL (pode editar aqui)
//   Nomes, CRMs e valores são EXEMPLOS: troque pelos reais.
//   Quando tiver banco de dados, carregue estas listas de lá.
// =========================================================
const DADOS = {
  unidade: 'Hospital da Saúde',
  setores: {
    CONSULTA: [{ id: 1, nome: 'Consultórios' }],
    // No Pronto Socorro o setor é a Emergência; o valor é o da consulta de emergência
    PRONTO_SOCORRO: [{ id: 10, nome: 'Emergência', valorConsulta: 250 }],
  },
  // Médicos da consulta particular (valor da consulta de cada um)
  medicosConsulta: [
    { id: 1, nome: 'Dra. Fernanda Costa', crm: 'CRM 1001', especialidade: 'Cardiologia', valorConsulta: 350 },
    { id: 2, nome: 'Dr. Ricardo Mendes', crm: 'CRM 1002', especialidade: 'Ortopedia', valorConsulta: 300 },
    { id: 3, nome: 'Dra. Juliana Rocha', crm: 'CRM 1003', especialidade: 'Ginecologia', valorConsulta: 320 },
    { id: 4, nome: 'Dr. Paulo Nogueira', crm: 'CRM 1004', especialidade: 'Clínica geral', valorConsulta: 200 },
  ],
  // Médicos de plantão da Emergência (o valor vem do setor Emergência)
  // (lista inicial; novos plantonistas são cadastrados na tela Médicos)
  medicosEmergencia: [
    { id: 101, nome: 'Dr. Rafael Monteiro', crm: 'CRM 2001', especialidade: 'Emergencista', ativo: true },
    { id: 102, nome: 'Dra. Camila Andrade', crm: 'CRM 2002', especialidade: 'Clínico geral', ativo: true },
    { id: 103, nome: 'Dr. Thiago Barbosa', crm: 'CRM 2003', especialidade: 'Pediatra', ativo: true },
    { id: 104, nome: 'Dra. Larissa Pinheiro', crm: 'CRM 2004', especialidade: 'Emergencista', ativo: true },
    { id: 105, nome: 'Dr. Eduardo Farias', crm: 'CRM 2005', especialidade: 'Ortopedista', ativo: true },
  ],
  // Especialidades dos plantonistas da Emergência
  especialidadesPlantao: ['Emergencista', 'Clínico geral', 'Ortopedista', 'Pediatra'],
  // Retorno da consulta ELETIVA sem cobrança: mesmo médico, até X dias depois da consulta paga e concluída.
  // Consulta de emergência (Pronto Socorro) NÃO tem retorno.
  diasRetorno: 30,
  horarios: ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
};

// ---------- Plantonistas (cadastro na tela Médicos) ----------
// Guardados neste navegador. TODO: quando tiver banco de dados, troque carregarPlantonistas()/salvarPlantonistas().
const CHAVE_PLANTONISTAS = 'consultaParticular.plantonistas';

function carregarPlantonistas() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PLANTONISTAS));
    if (Array.isArray(salvo)) DADOS.medicosEmergencia = salvo;
  } catch (e) { /* sem armazenamento: usa a lista inicial */ }
}

function salvarPlantonistas() {
  try { localStorage.setItem(CHAVE_PLANTONISTAS, JSON.stringify(DADOS.medicosEmergencia)); } catch (e) { /* ignora */ }
}

// ---------- Ponto do plantão ----------
// Registros de entrada/saída com foto, guardados neste navegador por 30 dias.
// TODO: quando tiver banco de dados, troque lerPonto()/salvarPonto() e registrarPonto().
const CHAVE_PONTO = 'consultaParticular.ponto';
const DIAS_GUARDAR_FOTO = 400; // fotos também ficam ~13 meses, para auditoria

const DIAS_GUARDAR_REGISTROS = 400; // ~13 meses, para o pagamento dos plantões

function lerPonto() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_PONTO)) || [];
    const agora = Date.now();
    return lista
      .filter((r) => agora - new Date(r.dataHora).getTime() <= DIAS_GUARDAR_REGISTROS * 86400000);
  } catch (e) { return []; }
}

// Fotos do ponto ficam no IndexedDB do navegador (cabe muito mais que o localStorage).
// Chave = id do registro de ponto. Se o IndexedDB não funcionar, a foto fica junto do registro.
let conexaoFotos = null;
function bancoFotos() {
  return conexaoFotos ||= new Promise((resolver, rejeitar) => {
    const req = indexedDB.open('consultaParticular', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('fotosPonto');
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rejeitar(req.error);
  });
}

async function operacaoFotos(modo, acao) {
  const db = await bancoFotos();
  return new Promise((resolver, rejeitar) => {
    const tx = db.transaction('fotosPonto', modo);
    const req = acao(tx.objectStore('fotosPonto'));
    tx.oncomplete = () => resolver(req?.result);
    tx.onerror = () => rejeitar(tx.error);
  });
}

const cacheFotos = new Map();
async function guardarFoto(id, dataUrl) {
  cacheFotos.set(id, dataUrl);
  await operacaoFotos('readwrite', (s) => s.put(dataUrl, id));
}
async function lerFoto(id) {
  if (cacheFotos.has(id)) return cacheFotos.get(id);
  try { const f = await operacaoFotos('readonly', (s) => s.get(id)); if (f) cacheFotos.set(id, f); return f || ''; } catch (e) { return ''; }
}

// Preenche as <img data-foto-id="..."> depois de desenhar a tela
function preencherFotos(raiz = document) {
  raiz.querySelectorAll('img[data-foto-id]').forEach(async (img) => {
    const f = await lerFoto(img.dataset.fotoId);
    if (f && f.startsWith('data:image/')) img.src = f; else img.replaceWith(Object.assign(document.createElement('span'), { className: 'foto-ponto', title: 'Sem foto' }));
  });
}

const tagFoto = (r, alt) => (r.foto && r.foto.startsWith('data:image/')
  ? `<img class="foto-ponto" src="${r.foto}" alt="${alt}">`
  : r.temFoto ? `<img class="foto-ponto" data-foto-id="${esc(r.id)}" alt="${alt}">` : '<span class="foto-ponto" title="Sem foto"></span>');

// Ampliar foto ao clicar (auditoria)
document.addEventListener('click', (e) => {
  const img = e.target.closest('.aud-ponto img.foto-ponto');
  if (!img || !img.src) return;
  const cam = Object.assign(document.createElement('div'), { className: 'foto-ampliada' });
  cam.innerHTML = `<img src="${img.src}" alt="${esc(img.alt)}">`;
  cam.addEventListener('click', () => cam.remove());
  document.body.appendChild(cam);
});

function salvarPonto(lista) {
  try { localStorage.setItem(CHAVE_PONTO, JSON.stringify(lista)); return true; } catch (e) { return false; }
}

// Último registro do médico nas últimas 24 h; se for ENTRADA, ele está no plantão
function entradaAtiva(medicoId) {
  const limite = Date.now() - 24 * 3600000;
  const ultimo = lerPonto().filter((r) => String(r.medicoId) === String(medicoId) && new Date(r.dataHora).getTime() >= limite)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora)).pop();
  return ultimo?.tipo === 'ENTRADA' ? ultimo : null;
}

const plantonistasNoPlantao = () => DADOS.medicosEmergencia.filter((m) => entradaAtiva(m.id));

carregarPlantonistas();

function todosMedicos() {
  const valorEmergencia = DADOS.setores.PRONTO_SOCORRO[0]?.valorConsulta || 0;
  return [
    ...DADOS.medicosConsulta.map((m) => ({ ...m, atende: 'Consulta' })),
    ...DADOS.medicosEmergencia.map((m) => ({ ...m, atende: 'Emergência (plantão)', valorConsulta: valorEmergencia })),
  ];
}

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
  pedido: { itens: [] },  // pedido do médico em montagem
  pedidoCarregado: null,  // código do pedido carregado na tela Exames (recepção)
};

// Textos de cada aba do Atendimento
const MODALIDADES = {
  CONSULTA: {
    nome: 'Consulta',
    tipo: 'Consulta particular',
    titulo: 'Abrir consulta particular',
    dica: 'O pagamento é feito antes de abrir a consulta',
    botao: 'Pagar e liberar para consulta',
    botaoIcone: '#i-dollar',
    icone: '#i-steth',
  },
  PRONTO_SOCORRO: {
    nome: 'Pronto Socorro',
    tipo: 'Pronto Socorro · consulta de emergência particular',
    titulo: 'Abrir atendimento de Pronto Socorro',
    dica: 'O pagamento é feito antes de liberar o paciente para a consulta',
    botao: 'Pagar e liberar para consulta',
    botaoIcone: '#i-dollar',
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
    AGUARDANDO: 'Liberado para consulta',
    TRIADO: 'Triado · aguardando médico',
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

// ---------- Marca de paciente particular ----------
// Particular = sem convênio, paga por serviço. Usa roxo + asterisco, que não se confunde
// com as cores de prioridade (vermelho, laranja, amarelo, verde).
// Um paciente é particular quando não tem convênio (campo "convenio" vazio).
const TITULO_PARTICULAR = 'Particular: sem convênio, paga por serviço';

function ehParticular(p) {
  return !p || !p.convenio;
}

// Classificação de risco (prioridade). A cor muda; o ✱ de particular fica fixo.
const RISCOS = {
  VERMELHO: { nome: 'Vermelho', descricao: 'Emergência', tempo: 'atendimento imediato', minutos: 0, ordem: 1 },
  LARANJA: { nome: 'Laranja', descricao: 'Muito urgente', tempo: 'até 10 min', minutos: 10, ordem: 2 },
  AMARELO: { nome: 'Amarelo', descricao: 'Urgente', tempo: 'até 60 min', minutos: 60, ordem: 3 },
  VERDE: { nome: 'Verde', descricao: 'Pouco urgente', tempo: 'até 120 min', minutos: 120, ordem: 4 },
};
const classeRisco = (risco) => (RISCOS[risco] ? ` risco-${risco.toLowerCase()}` : '');

// Selo do paciente: roxo "✱ Particular" sem classificação; com classificação, "✱ Verde · Pouco urgente" na cor da prioridade
function seloParticular(risco) {
  const r = RISCOS[risco];
  const titulo = r ? `${r.nome} (${r.descricao}, ${r.tempo}) · ${TITULO_PARTICULAR}` : TITULO_PARTICULAR;
  return `<span class="selo-particular${classeRisco(risco)}" title="${titulo}"><span class="ast">✱</span>${r ? `${r.nome} · ${r.descricao}` : 'Particular'}</span>`;
}

// Marca curta (bolinha com ✱) usada nas listas; pega a cor da prioridade
function marcaParticular(risco) {
  const r = RISCOS[risco];
  const titulo = r ? `${r.nome} · ${TITULO_PARTICULAR}` : TITULO_PARTICULAR;
  return `<span class="marca-particular${classeRisco(risco)}" title="${titulo}" aria-label="${titulo}">✱</span>`;
}

// Risco mostrado no cartão do paciente: só no Pronto Socorro
function riscoAtual() {
  if (estado.modalidade !== 'PRONTO_SOCORRO') return '';
  const hoje = estado.paciente && (estado.anteriores || []).length ? atendimentoDeHoje() : null;
  return hoje?.risco || estado.risco;
}

function origemRiscoAtual() {
  const hoje = estado.paciente && (estado.anteriores || []).length ? atendimentoDeHoje() : null;
  return hoje?.riscoOrigem || 'RECEPCAO';
}

function dadosPaciente(p) {
  return [p.cpf && `CPF ${esc(p.cpf)}`, p.nascimento && `Nasc. ${formatarData(p.nascimento)}`]
    .filter(Boolean).join(' · ') || 'Cadastro rápido (só o nome)';
}

// Cartão do paciente selecionado (Atendimento e Exames)
function cartaoPaciente(p, risco = '', origem = 'RECEPCAO') {
  const part = ehParticular(p);
  const r = RISCOS[risco];
  const quem = origem === 'ENFERMAGEM' ? 'triagem de enfermagem' : 'pré-classificação da recepção';
  return `
    <div class="paciente-cabeca"><strong>${esc(p.nome)}</strong>${part ? (r ? seloParticular(risco) : '<span class="texto-particular">✱ Particular</span>') : `<span class="tag">${esc(p.convenio)}</span>`}</div>
    <small style="display:block;color:var(--muted);margin-top:4px">${dadosPaciente(p)}</small>
    ${r ? `<span class="paciente-obs"><strong>Prioridade:</strong> ${r.nome} · ${r.descricao} (${r.tempo}) · ${quem}</span>` : ''}
    ${part ? '<span class="paciente-obs"><strong>✱ Particular:</strong> sem convênio, cada serviço é pago antes de ser feito.</span>' : ''}`;
}

// Redesenha o cartão do paciente no Atendimento (cor da prioridade + ✱)
function renderCartaoPaciente() {
  const caixa = $('#atend-paciente');
  const p = estado.paciente;
  if (!p) { caixa.hidden = true; return; }
  const risco = riscoAtual();
  caixa.hidden = false;
  const hoje = (estado.anteriores || []).length ? atendimentoDeHoje() : null;
  const podeFechar = !!hoje && podeRetirar(hoje);
  caixa.className = `paciente-selecionado${ehParticular(p) ? ' particular' : ''}${classeRisco(risco)}${podeFechar ? ' com-fechar' : ''}`;
  caixa.innerHTML = cartaoPaciente(p, risco, origemRiscoAtual())
    + (podeFechar ? `<button type="button" class="cartao-fechar" data-fechar-paciente
         title="Retirar da tela (já pago e classificado)" aria-label="Retirar paciente da tela">✕</button>` : '');
}

// Já pode sair da tela: pagou e, no Pronto Socorro, já passou pela triagem (classificação concluída)
function podeRetirar(a) {
  if (!a || !(a.pago || a.retorno)) return false;
  const ps = (a.tipo || estado.modalidade) === 'PRONTO_SOCORRO';
  return !ps || !!a.triagemEnfermagem;
}

// ✕ do cartão: limpa a tela para o próximo paciente (não apaga nada)
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-fechar-paciente]')) return;
  $('#atend-busca').value = '';
  selecionarPaciente(null);
  $('#atend-busca').focus();
});

// ---------- Opções de classificação de risco ----------
function montarOpcoesRisco() {
  $('#riscos').innerHTML = Object.entries(RISCOS).map(([chave, r]) => `
    <label class="risco-opcao${classeRisco(chave)}">
      <input type="radio" name="risco" value="${chave}">
      <span class="risco-cor" aria-hidden="true"></span>
      <span><strong>${r.nome}</strong><small>${r.descricao} · ${r.tempo}</small></span>
    </label>`).join('');
  $('#legenda-riscos').innerHTML = Object.entries(RISCOS).map(([chave, r]) =>
    `<span class="${classeRisco(chave).trim()}"><i></i>${r.nome}</span>`).join('');
}

document.addEventListener('change', (e) => {
  if (e.target.name !== 'risco') return;
  estado.risco = e.target.value;
  renderCartaoPaciente();
  renderEtapas();
  atualizarBotaoAbrir();
});

// ---------- Fila da emergência ----------
function carregarFila() {
  // TODO: buscar no seu sistema os atendimentos de Pronto Socorro do dia que ainda não tiveram consulta concluída
  //   e chamar renderFila(lista). Cada item:
  //   { numero, paciente, particular: true, risco: 'VERDE', entrada: 'AAAA-MM-DDTHH:MM', status, medico }
  renderFila([]);
}

function minutosDesde(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function textoQuemClassificou(a) {
  const hist = a.historicoRisco || [];
  const ultimo = hist[hist.length - 1];
  const anterior = hist.length > 1 ? hist[hist.length - 2] : null;
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  if (a.riscoOrigem === 'ENFERMAGEM') {
    const mudou = anterior && anterior.risco !== ultimo?.risco ? ` · era ${RISCOS[anterior.risco]?.nome || anterior.risco}` : ' · confirmou a cor';
    return `Enfermagem ${hora(ultimo?.dataHora)}<small>triagem feita${mudou}</small>`;
  }
  return `Recepção ${hora(ultimo?.dataHora)}<small>pré-classificação · falta triagem</small>`;
}

// Pacientes retirados da tela da fila (só visualização; nada é apagado). Guardado por dia neste navegador.
const chaveRetirados = () => `consultaParticular.filaRetirados.${new Date().toISOString().slice(0, 10)}`;
let mostrarRetirados = false;

function lerRetirados() {
  try { return new Set(JSON.parse(localStorage.getItem(chaveRetirados())) || []); } catch (e) { return new Set(); }
}

function salvarRetirados(conjunto) {
  try { localStorage.setItem(chaveRetirados(), JSON.stringify([...conjunto])); } catch (e) { /* ignora */ }
}

document.addEventListener('click', (e) => {
  const retirar = e.target.closest('[data-retirar]');
  const voltar = e.target.closest('[data-voltar-fila]');
  if (!retirar && !voltar) return;
  const ret = lerRetirados();
  if (retirar) ret.add(retirar.dataset.retirar); else ret.delete(voltar.dataset.voltarFila);
  salvarRetirados(ret);
  renderFila(estado.fila || []);
});

$('#btn-mostrar-retirados').addEventListener('click', () => {
  mostrarRetirados = !mostrarRetirados;
  renderFila(estado.fila || []);
});

function renderFila(lista) {
  estado.fila = lista;
  const ret = lerRetirados();
  const qtdRetirados = lista.filter((a) => ret.has(String(a.numero))).length;
  $('#btn-mostrar-retirados').hidden = qtdRetirados === 0;
  $('#btn-mostrar-retirados').textContent = mostrarRetirados ? 'Ocultar retirados' : `Mostrar retirados (${qtdRetirados})`;
  const visiveis = mostrarRetirados ? lista : lista.filter((a) => !ret.has(String(a.numero)));
  const ordenada = [...visiveis].sort((a, b) =>
    (RISCOS[a.risco]?.ordem || 9) - (RISCOS[b.risco]?.ordem || 9) || String(a.entrada).localeCompare(String(b.entrada)));
  $('#tabela-fila').innerHTML = ordenada.map((a) => {
    const r = RISCOS[a.risco];
    const espera = minutosDesde(a.entrada);
    const atrasado = r && espera > r.minutos && !['ATENDIDA', 'ALTA'].includes(a.status);
    return `
      <tr class="linha-particular${classeRisco(a.risco)}${ret.has(String(a.numero)) ? ' retirado' : ''}">
        <td>${a.particular === false ? `<span class="tag">${esc(r?.nome || '—')}</span>` : seloParticular(a.risco)}</td>
        <td>${esc(a.paciente)}</td>
        <td>${esc(a.numero)}</td>
        <td class="espera${atrasado ? ' atrasado' : ''}">${espera} min<small>chegou ${formatarDataHora(a.entrada).slice(11)}${r ? ` · meta ${r.tempo}` : ''}${atrasado ? ' · acima do tempo' : ''}</small></td>
        <td class="quem-classificou">${textoQuemClassificou(a)}</td>
        <td class="quem-classificou">${tagStatus(a.status)}<small>${esc(a.medico)}</small></td>
        <td><div class="acoes-linha">${a.pago === false ? '<span class="dica">Aguardando pagamento</span>'
          : `<button class="btn-acao${a.triagemEnfermagem ? '' : ' destaque'}" data-triagem="${esc(a.numero)}">${a.triagemEnfermagem ? 'Reclassificar' : 'Triagem enfermagem'}</button>`}
          ${ret.has(String(a.numero))
            ? `<button class="btn-acao" data-voltar-fila="${esc(a.numero)}">Voltar para a fila</button>`
            : podeRetirar({ ...a, tipo: 'PRONTO_SOCORRO' })
              ? `<button type="button" class="btn-retirar" data-retirar="${esc(a.numero)}" title="Retirar da tela (já pago e classificado)" aria-label="Retirar ${esc(a.paciente)} da tela">✕</button>` : ''}</div></td>
      </tr>`;
  }).join('');
  $('#vazio-fila').hidden = ordenada.length > 0;
  $('#vazio-fila').textContent = lista.length && !ordenada.length
    ? 'Todos os pacientes foram retirados da tela. Use "Mostrar retirados" para ver de novo.'
    : 'Nenhum paciente aguardando na emergência.';
  const naTela = lista.filter((a) => !ret.has(String(a.numero)));
  $('#fila-resumo').innerHTML = Object.entries(RISCOS).map(([chave, r]) => `
    <article class="card${classeRisco(chave)}"><strong>${naTela.filter((a) => a.risco === chave).length}</strong><span>${r.nome} · ${r.descricao}</span></article>`).join('');
}

$('#btn-atualizar-fila').addEventListener('click', () => carregarFila());
// Atualiza o tempo de espera a cada minuto enquanto a fila estiver aberta
setInterval(() => { if ($('#tela-fila').classList.contains('ativa')) carregarFila(); }, 60000);

// ---------- Triagem de enfermagem ----------
// Abre pela Fila da emergência ou pela lista de atendimentos (botão "Triagem enfermagem" / "Reclassificar").
let atendimentoTriagem = null;

function abrirTriagem(atendimento, nomePaciente) {
  atendimentoTriagem = atendimento;
  $('#form-triagem').reset();
  $('#tr-erro').textContent = '';
  $('#tr-paciente').textContent = `${nomePaciente || 'Paciente'} · Atend. ${atendimento.numero}`;
  const r = RISCOS[atendimento.risco];
  $('#tr-atual').innerHTML = r
    ? `Cor atual: ${seloParticular(atendimento.risco)} <span>${atendimento.riscoOrigem === 'ENFERMAGEM' ? 'definida na triagem' : 'pré-classificação da recepção'}</span>`
    : 'Ainda sem classificação.';
  $('#tr-riscos').innerHTML = Object.entries(RISCOS).map(([chave, x]) => `
    <label class="risco-opcao${classeRisco(chave)}">
      <input type="radio" name="riscoTriagem" value="${chave}" ${chave === atendimento.risco ? 'checked' : ''}>
      <span class="risco-cor" aria-hidden="true"></span>
      <span><strong>${x.nome}</strong><small>${x.descricao} · ${x.tempo}</small></span>
    </label>`).join('');
  $('#modal-triagem').hidden = false;
  $('#form-triagem input[name="riscoTriagem"]:checked')?.focus();
}

function fecharTriagem() { $('#modal-triagem').hidden = true; atendimentoTriagem = null; }
document.querySelectorAll('[data-tr-cancelar]').forEach((b) => b.addEventListener('click', fecharTriagem));
$('#modal-triagem').addEventListener('click', (e) => { if (e.target.id === 'modal-triagem') fecharTriagem(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-triagem').hidden) fecharTriagem(); });

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-triagem]');
  if (!b) return;
  const n = b.dataset.triagem;
  const daFila = (estado.fila || []).find((x) => String(x.numero) === n);
  const daLista = (estado.anteriores || []).find((x) => String(x.numero) === n);
  const a = daLista || daFila;
  if (a) abrirTriagem(a, daFila?.paciente || estado.paciente?.nome);
});

$('#form-triagem').addEventListener('submit', async (e) => {
  e.preventDefault();
  const risco = document.querySelector('input[name="riscoTriagem"]:checked')?.value;
  if (!risco) { $('#tr-erro').textContent = 'Escolha a cor da classificação.'; return; }
  const triagem = { risco, observacoes: $('#tr-obs').value.trim(), por: 'ENFERMAGEM', dataHora: new Date().toISOString() };
  const a = atendimentoTriagem;
  await registrarTriagem(a, triagem);
  fecharTriagem();
  carregarAtendimentosAnteriores();
  if ($('#tela-fila').classList.contains('ativa')) carregarFila();
});

async function registrarTriagem(atendimento, triagem) {
  // TODO: gravar a triagem no seu sistema. Depois dela o atendimento deve ficar com:
  //   risco = triagem.risco, riscoOrigem = 'ENFERMAGEM', triagemEnfermagem = true, status = 'TRIADO'
  //   e um item novo em historicoRisco: { risco, por: 'ENFERMAGEM', dataHora, observacoes }
  console.log('Triagem de enfermagem', atendimento, triagem);
}

// ---------- Tela: Ponto do plantão ----------
const horaBR = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
let fotoPonto = '';      // foto atual (JPEG pequeno, em data URL)
let streamCamera = null; // câmera aberta

function duracao(desdeIso) {
  const min = Math.floor((Date.now() - new Date(desdeIso).getTime()) / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

function carregarPonto() {
  const atual = $('#ponto-medico').value;
  $('#ponto-medico').innerHTML = '<option value="">Selecione o médico</option>' + [...DADOS.medicosEmergencia]
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .map((m) => `<option value="${esc(m.id)}">${esc(m.nome)} · ${esc(m.especialidade)}${entradaAtiva(m.id) ? ' (no plantão)' : ''}</option>`).join('');
  $('#ponto-medico').value = atual;
  atualizarFormPonto();
  renderPonto();
}

const fimPrevisto = (e) => new Date(new Date(e.dataHora).getTime() + (Number(e.horas) || 0) * 3600000).toISOString();
const horasPlantaoEscolhidas = () => document.querySelector('input[name="plantaoHoras"]:checked')?.value || '';

function atualizarFormPonto() {
  const id = $('#ponto-medico').value;
  const e = id ? entradaAtiva(id) : null;
  $('#btn-registrar-ponto-texto').textContent = e ? 'Registrar saída' : 'Registrar entrada';
  $('#ponto-tipo').hidden = !!e; // tipo de plantão só na entrada
  $('#ponto-situacao').textContent = !id ? ''
    : e ? `No plantão de ${e.horas || '?'} h desde ${horaBR(e.dataHora)} (${duracao(e.dataHora)})${e.horas ? ` · termina às ${horaBR(fimPrevisto(e))}` : ''}.`
      : 'Fora do plantão.';
  $('#ponto-situacao').classList.toggle('dentro', !!e);
  $('#btn-registrar-ponto').disabled = !(id && fotoPonto && (e || horasPlantaoEscolhidas()));
}

document.querySelectorAll('input[name="plantaoHoras"]').forEach((r) => r.addEventListener('change', atualizarFormPonto));

function mostrarFoto(dataUrl) {
  fotoPonto = dataUrl;
  $('#ponto-preview').src = dataUrl;
  $('#ponto-preview').hidden = !dataUrl;
  $('#ponto-sem-foto').hidden = !!dataUrl || !$('#ponto-video').hidden;
  atualizarFormPonto();
}

// Reduz a foto para ~320 px (JPEG) para não ocupar espaço
function reduzirImagem(origem, largura, altura) {
  const escala = Math.min(1, 320 / Math.max(largura, altura));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(largura * escala);
  canvas.height = Math.round(altura * escala);
  canvas.getContext('2d').drawImage(origem, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

function fecharCamera() {
  streamCamera?.getTracks().forEach((t) => t.stop());
  streamCamera = null;
  $('#ponto-video').hidden = true;
  $('#btn-tirar-foto').hidden = true;
  $('#btn-abrir-camera').hidden = false;
  $('#ponto-sem-foto').hidden = !!fotoPonto;
}

$('#btn-abrir-camera').addEventListener('click', async () => {
  $('#ponto-erro').textContent = '';
  try {
    streamCamera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    const v = $('#ponto-video');
    v.srcObject = streamCamera;
    v.hidden = false;
    $('#ponto-preview').hidden = true;
    $('#ponto-sem-foto').hidden = true;
    await v.play();
    $('#btn-tirar-foto').hidden = false;
    $('#btn-abrir-camera').hidden = true;
  } catch (e) {
    fecharCamera();
    $('#ponto-erro').textContent = 'Não foi possível abrir a câmera aqui. Use "Enviar foto" (no celular ele abre a câmera).';
  }
});

$('#btn-tirar-foto').addEventListener('click', () => {
  const v = $('#ponto-video');
  if (!v.videoWidth) return;
  const foto = reduzirImagem(v, v.videoWidth, v.videoHeight);
  fecharCamera();
  mostrarFoto(foto);
});

$('#ponto-arquivo').addEventListener('change', (e) => {
  const arquivo = e.target.files?.[0];
  e.target.value = '';
  if (!arquivo) return;
  if (!arquivo.type.startsWith('image/')) { $('#ponto-erro').textContent = 'Escolha um arquivo de imagem.'; return; }
  $('#ponto-erro').textContent = '';
  const img = new Image();
  img.onload = () => { mostrarFoto(reduzirImagem(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
  img.onerror = () => { $('#ponto-erro').textContent = 'Não foi possível ler essa imagem.'; };
  img.src = URL.createObjectURL(arquivo);
});

$('#ponto-medico').addEventListener('change', () => { $('#ponto-status').textContent = ''; atualizarFormPonto(); });

$('#form-ponto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = DADOS.medicosEmergencia.find((x) => String(x.id) === $('#ponto-medico').value);
  if (!m || !fotoPonto) return;
  const aberta = entradaAtiva(m.id);
  const tipo = aberta ? 'SAIDA' : 'ENTRADA';
  const horas = aberta ? Number(aberta.horas) || '' : Number(horasPlantaoEscolhidas());
  if (!aberta && !horas) { $('#ponto-erro').textContent = 'Escolha o tipo de plantão: 6 ou 12 horas.'; return; }
  const registro = {
    id: `${Date.now()}`, medicoId: m.id, medicoNome: m.nome, especialidade: m.especialidade, crm: m.crm,
    tipo, horas, // 6 ou 12 (na saída, o mesmo da entrada)
    entradaId: aberta?.id || '', // na saída, liga com a entrada
    dataHora: new Date().toISOString(), temFoto: true,
  };
  try {
    await guardarFoto(registro.id, fotoPonto);
  } catch (erro) {
    registro.foto = fotoPonto; // sem IndexedDB: guarda a foto junto do registro
  }
  const lista = lerPonto();
  lista.push(registro);
  if (!salvarPonto(lista)) { $('#ponto-erro').textContent = 'Não foi possível salvar o ponto neste navegador.'; return; }
  await registrarPonto(registro, fotoPonto);
  $('#ponto-status').textContent = tipo === 'ENTRADA'
    ? `Entrada no plantão de ${horas} h registrada às ${horaBR(registro.dataHora)} (termina às ${horaBR(fimPrevisto(registro))}): ${m.nome} já aparece no Pronto Socorro.`
    : `Saída registrada às ${horaBR(registro.dataHora)}: ${m.nome} saiu da lista do Pronto Socorro.`;
  mostrarFoto('');
  document.querySelectorAll('input[name="plantaoHoras"]').forEach((r) => { r.checked = false; });
  $('#ponto-medico').value = '';
  carregarPonto();
  if (estado.modalidade === 'PRONTO_SOCORRO') carregarMedicosConsulta();
});

async function registrarPonto(registro, foto) {
  // TODO: enviar o registro de ponto (e a foto) para o seu sistema. Guarde para auditoria; não permita apagar.
  console.log('Ponto', registro, foto ? '[foto]' : '[sem foto]');
}

function renderPonto() {
  const lista = lerPonto();
  const noPlantao = plantonistasNoPlantao().map((m) => ({ m, e: entradaAtiva(m.id) }))
    .sort((a, b) => a.e.dataHora.localeCompare(b.e.dataHora));
  $('#lista-no-plantao').innerHTML = noPlantao.map(({ m, e }) => `
    <li>
      ${tagFoto(e, `Foto de ${esc(m.nome)} no ponto`)}
      <div><strong>${esc(m.nome)}</strong><small>${esc(m.especialidade)} · plantão ${e.horas || '?'} h · desde ${horaBR(e.dataHora)}${e.horas ? ` até ${horaBR(fimPrevisto(e))}` : ''} (${duracao(e.dataHora)})</small></div>
    </li>`).join('');
  $('#vazio-no-plantao').hidden = noPlantao.length > 0;
  $('#pill-no-plantao').textContent = `${noPlantao.length} médico${noPlantao.length === 1 ? '' : 's'}`;

  const hoje = new Date().toDateString();
  const deHoje = lista.filter((r) => new Date(r.dataHora).toDateString() === hoje).sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  $('#tabela-ponto').innerHTML = deHoje.map((r) => `
    <tr>
      <td>${tagFoto(r, `Foto de ${esc(r.medicoNome)}`)}</td>
      <td>${horaBR(r.dataHora)}</td>
      <td>${esc(r.medicoNome)}</td>
      <td>${esc(r.especialidade)}</td>
      <td>${r.horas ? `<span class="tag tag-plantao">${r.horas} h</span>` : '—'}</td>
      <td><span class="tag ${r.tipo === 'ENTRADA' ? 'tag-entrada' : 'tag-saida'}">${r.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}</span></td>
    </tr>`).join('');
  $('#vazio-ponto').hidden = deHoje.length > 0;
  preencherFotos($('#tela-ponto'));
  renderPlantoesMes();
}

// ---------- Fechamento do mês (pagamento dos plantonistas) ----------
const CHAVE_VALORES_PLANTAO = 'consultaParticular.valoresPlantao';

function lerValoresPlantao() {
  try { return JSON.parse(localStorage.getItem(CHAVE_VALORES_PLANTAO)) || { 6: 0, 12: 0 }; } catch (e) { return { 6: 0, 12: 0 }; }
}

function salvarValoresPlantao(v) {
  try { localStorage.setItem(CHAVE_VALORES_PLANTAO, JSON.stringify(v)); } catch (e) { /* ignora */ }
}

['#pm-valor6', '#pm-valor12'].forEach((s) => $(s).addEventListener('change', () => {
  salvarValoresPlantao({ 6: lerMoeda($('#pm-valor6').value), 12: lerMoeda($('#pm-valor12').value) });
  renderPlantoesMes();
}));
$('#pm-mes').addEventListener('change', () => renderPlantoesMes());

function horasMin(min) {
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

// Junta cada entrada do mês com a sua saída e soma por médico
function calcularPlantoesMes(mes) { // mes = 'AAAA-MM'
  const lista = lerPonto();
  const porMedico = {};
  lista.filter((r) => r.tipo === 'ENTRADA' && r.dataHora.slice(0, 7) === mes).forEach((ent) => {
    const saida = lista.find((r) => r.tipo === 'SAIDA' && r.entradaId === ent.id)
      || lista.filter((r) => r.tipo === 'SAIDA' && String(r.medicoId) === String(ent.medicoId) && r.dataHora > ent.dataHora)
        .sort((a, b) => a.dataHora.localeCompare(b.dataHora))[0];
    const m = (porMedico[ent.medicoId] ||= { id: ent.medicoId, nome: ent.medicoNome, especialidade: ent.especialidade, p6: 0, p12: 0, minutos: 0, semSaida: 0, saiuAntes: 0, emAndamento: 0, plantoes: [] });
    m.plantoes.push({ entrada: ent, saida: saida || null });
    if (Number(ent.horas) === 6) m.p6++; else if (Number(ent.horas) === 12) m.p12++;
    if (saida) {
      const min = Math.round((new Date(saida.dataHora) - new Date(ent.dataHora)) / 60000);
      m.minutos += min;
      if (ent.horas && min < ent.horas * 60 - 15) m.saiuAntes++; // tolerância de 15 min
    } else if (entradaAtiva(ent.medicoId)?.id === ent.id) {
      m.emAndamento++;
    } else {
      m.semSaida++;
    }
  });
  return porMedico;
}

// ---------- Auditoria: cada plantão do médico no mês, com fotos ----------
function abrirAuditoria(medicoId) {
  const mes = $('#pm-mes').value;
  const m = calcularPlantoesMes(mes)[medicoId];
  if (!m) return;
  const [ano, mm] = mes.split('-');
  $('#aud-sub').textContent = `${m.nome} · ${m.especialidade} · ${mm}/${ano}`;
  const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR');
  $('#tabela-auditoria').innerHTML = m.plantoes.sort((a, b) => a.entrada.dataHora.localeCompare(b.entrada.dataHora)).map(({ entrada, saida }) => {
    const contratado = (Number(entrada.horas) || 0) * 60;
    const trabalhado = saida ? Math.round((new Date(saida.dataHora) - new Date(entrada.dataHora)) / 60000) : null;
    let situacao;
    if (trabalhado == null) {
      situacao = entradaAtiva(entrada.medicoId)?.id === entrada.id
        ? '<span class="aud-ok">Em andamento</span>'
        : '<span class="aud-falta">Sem saída registrada<small>não dá para confirmar as horas</small></span>';
    } else if (contratado && trabalhado < contratado - 15) {
      situacao = `<span class="aud-falta">Faltaram ${horasMin(contratado - trabalhado)}<small>fez ${horasMin(trabalhado)} de ${entrada.horas} h</small></span>`;
    } else {
      situacao = `<span class="aud-ok">Cumprido<small>fez ${horasMin(trabalhado)} de ${entrada.horas} h</small></span>`;
    }
    return `
      <tr>
        <td>${dataBR(entrada.dataHora)}</td>
        <td><span class="tag tag-plantao">${entrada.horas || '?'} h</span></td>
        <td><div class="aud-ponto">${tagFoto(entrada, `Foto da entrada de ${esc(m.nome)}`)}<span>${horaBR(entrada.dataHora)}</span></div></td>
        <td>${saida ? `<div class="aud-ponto">${tagFoto(saida, `Foto da saída de ${esc(m.nome)}`)}<span>${horaBR(saida.dataHora)}${dataBR(saida.dataHora) !== dataBR(entrada.dataHora) ? ` <small>(${dataBR(saida.dataHora)})</small>` : ''}</span></div>` : '—'}</td>
        <td>${trabalhado == null ? '—' : horasMin(trabalhado)}</td>
        <td>${situacao}</td>
      </tr>`;
  }).join('');
  $('#modal-auditoria').hidden = false;
  preencherFotos($('#modal-auditoria'));
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-auditar]');
  if (b) abrirAuditoria(b.dataset.auditar);
  if (e.target.closest('[data-aud-fechar]') || e.target.id === 'modal-auditoria') $('#modal-auditoria').hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-auditoria').hidden && !document.querySelector('.foto-ampliada')) $('#modal-auditoria').hidden = true; });

function renderPlantoesMes() {
  if (!$('#pm-mes').value) $('#pm-mes').value = new Date().toISOString().slice(0, 7);
  const valores = lerValoresPlantao();
  if (document.activeElement !== $('#pm-valor6')) $('#pm-valor6').value = valorCampo(valores[6]);
  if (document.activeElement !== $('#pm-valor12')) $('#pm-valor12').value = valorCampo(valores[12]);
  const semValor = !valores[6] || !valores[12];
  $('#pm-aviso').textContent = semValor ? 'Preencha o valor de cada tipo de plantão para calcular o pagamento.' : '';

  const linhas = Object.values(calcularPlantoesMes($('#pm-mes').value)).sort((a, b) => a.nome.localeCompare(b.nome));
  let total = 0, t6 = 0, t12 = 0, tMin = 0;
  $('#tabela-plantoes-mes').innerHTML = linhas.map((m) => {
    const valor = m.p6 * (valores[6] || 0) + m.p12 * (valores[12] || 0);
    total += valor; t6 += m.p6; t12 += m.p12; tMin += m.minutos;
    const pend = [
      m.semSaida && `${m.semSaida} sem saída registrada`,
      m.saiuAntes && `${m.saiuAntes} com saída antes do horário`,
      m.emAndamento && `${m.emAndamento} em andamento`,
    ].filter(Boolean);
    return `
      <tr>
        <td>${esc(m.nome)}</td>
        <td>${esc(m.especialidade)}</td>
        <td>${m.p6}</td>
        <td>${m.p12}</td>
        <td>${horasMin(m.minutos)}</td>
        <td>${pend.length ? `<span class="pendencia">${pend.join(' · ')}</span>` : '<span class="sem-pendencia">Nenhuma</span>'}</td>
        <td>${semValor ? '—' : formatarMoeda(valor)}</td>
        <td><button class="btn-acao" data-auditar="${esc(m.id)}">Auditoria</button></td>
      </tr>`;
  }).join('');
  $('#rodape-plantoes-mes').innerHTML = linhas.length ? `
    <tr><td colspan="2">Total do mês</td><td>${t6}</td><td>${t12}</td><td>${horasMin(tMin)}</td><td></td><td>${semValor ? '—' : formatarMoeda(total)}</td><td></td></tr>` : '';
  $('#vazio-plantoes-mes').hidden = linhas.length > 0;
  $('#pill-total-plantoes').textContent = semValor ? 'Defina os valores' : `${formatarMoeda(total)} a pagar`;
}

// Fecha a câmera ao sair da tela do ponto
window.addEventListener('hashchange', () => { if (location.hash !== '#ponto') fecharCamera(); });

// =========================================================
//   ESTATÍSTICAS (mês, semana, dia, dia da semana, hora, 15 min)
// =========================================================
// TODO: carregarEstatisticas() deve buscar no seu sistema os atendimentos do período e chamar renderEstatisticas(lista).
//   Cada item: { entrada: 'AAAA-MM-DDTHH:MM', tipo: 'CONSULTA' | 'PRONTO_SOCORRO', retorno: true|false, valor }
const SERIES_EST = [
  { chave: 'consulta', nome: 'Consulta', cor: 'var(--serie-consulta)' },
  { chave: 'ps', nome: 'Pronto Socorro', cor: 'var(--serie-ps)' },
  { chave: 'retorno', nome: 'Retorno', cor: 'var(--serie-retorno)' },
];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function definirPeriodoEst(tipo) {
  const hoje = new Date();
  let ini = new Date(hoje);
  if (tipo === 'mes') ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  else if (tipo !== 'hoje') ini.setDate(hoje.getDate() - Number(tipo) + 1);
  $('#est-inicio').value = dataLocal(ini);
  $('#est-fim').value = dataLocal(hoje);
  document.querySelectorAll('[data-est-periodo]').forEach((b) => b.classList.toggle('ativo', b.dataset.estPeriodo === tipo));
}

function carregarEstatisticas() {
  if (!$('#est-inicio').value) definirPeriodoEst('30');
  // TODO: buscar no sistema os atendimentos entre #est-inicio e #est-fim
  renderEstatisticas([]);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-est-periodo]');
  if (!b) return;
  definirPeriodoEst(b.dataset.estPeriodo);
  carregarEstatisticas();
});
['#est-inicio', '#est-fim'].forEach((s) => $(s).addEventListener('change', () => {
  document.querySelectorAll('[data-est-periodo]').forEach((b) => b.classList.remove('ativo'));
  carregarEstatisticas();
}));
document.querySelectorAll('input[name="estAgrupar"]').forEach((r) => r.addEventListener('change', () => carregarEstatisticas()));

function agrupamentoEst() { return document.querySelector('input[name="estAgrupar"]:checked')?.value || 'dia'; }

// Monta os grupos (inclusive os vazios) para o agrupamento escolhido
function gruposEst(modo, ini, fim) {
  const g = [];
  if (modo === 'hora') for (let h = 0; h < 24; h++) g.push({ chave: String(h), rotulo: `${String(h).padStart(2, '0')}h`, longo: `${String(h).padStart(2, '0')}:00 às ${String(h).padStart(2, '0')}:59` });
  else if (modo === 'quarto') for (let m = 0; m < 24 * 60; m += 15) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const f = m + 14; g.push({ chave: String(m), rotulo: t, longo: `${t} às ${String(Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}` });
  }
  else if (modo === 'diaSemana') DIAS_SEMANA.forEach((d, i) => g.push({ chave: String(i), rotulo: d.slice(0, 3), longo: d }));
  else {
    const d = new Date(`${ini}T00:00`);
    const limite = new Date(`${fim}T00:00`);
    if (modo === 'semana') d.setDate(d.getDate() - d.getDay()); // começa no domingo
    if (modo === 'mes') d.setDate(1);
    const vistos = new Set();
    while (d <= limite) {
      const ch = chaveGrupo(modo, d);
      if (!vistos.has(ch)) {
        vistos.add(ch);
        if (modo === 'mes') g.push({ chave: ch, rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, longo: `${MESES[d.getMonth()]} de ${d.getFullYear()}` });
        else if (modo === 'semana') {
          const f = new Date(d); f.setDate(d.getDate() + 6);
          g.push({ chave: ch, rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, longo: `Semana de ${d.toLocaleDateString('pt-BR')} a ${f.toLocaleDateString('pt-BR')}` });
        } else g.push({ chave: ch, rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, longo: `${DIAS_SEMANA[d.getDay()]}, ${d.toLocaleDateString('pt-BR')}` });
      }
      if (modo === 'mes') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + (modo === 'semana' ? 7 : 1));
    }
  }
  return g;
}

function chaveGrupo(modo, d) {
  if (modo === 'mes') return `${d.getFullYear()}-${d.getMonth()}`;
  if (modo === 'semana') { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return dataLocal(s); }
  if (modo === 'dia') return dataLocal(d);
  if (modo === 'diaSemana') return String(d.getDay());
  if (modo === 'hora') return String(d.getHours());
  return String(d.getHours() * 60 + Math.floor(d.getMinutes() / 15) * 15); // quarto de hora
}

const serieDoAtendimento = (a) => (a.retorno ? 'retorno' : a.tipo === 'PRONTO_SOCORRO' ? 'ps' : 'consulta');

function renderEstatisticas(lista) {
  const ini = $('#est-inicio').value, fim = $('#est-fim').value;
  const modo = agrupamentoEst();
  const noPeriodo = lista.filter((a) => { const d = String(a.entrada).slice(0, 10); return d >= ini && d <= fim; });
  const grupos = gruposEst(modo, ini, fim).map((g) => ({ ...g, consulta: 0, ps: 0, retorno: 0, valor: 0 }));
  const porChave = new Map(grupos.map((g) => [g.chave, g]));
  noPeriodo.forEach((a) => {
    const g = porChave.get(chaveGrupo(modo, new Date(a.entrada)));
    if (!g) return;
    g[serieDoAtendimento(a)]++;
    g.valor += a.retorno ? 0 : Number(a.valor || 0);
  });
  grupos.forEach((g) => { g.total = g.consulta + g.ps + g.retorno; });

  // Faixas de 15 min: mostra só do primeiro ao último horário com movimento (e no mínimo 07:00–19:00)
  let visiveis = grupos;
  if (modo === 'quarto') {
    const comMov = grupos.filter((g) => g.total);
    const minM = Math.min(7 * 60, ...comMov.map((g) => Number(g.chave)));
    const maxM = Math.max(19 * 60 - 15, ...comMov.map((g) => Number(g.chave)));
    visiveis = grupos.filter((g) => Number(g.chave) >= minM && Number(g.chave) <= maxM);
  }

  // Indicadores
  const tot = { consulta: 0, ps: 0, retorno: 0, valor: 0 };
  noPeriodo.forEach((a) => { tot[serieDoAtendimento(a)]++; tot.valor += a.retorno ? 0 : Number(a.valor || 0); });
  const total = tot.consulta + tot.ps + tot.retorno;
  const dias = Math.max(1, Math.round((new Date(`${fim}T00:00`) - new Date(`${ini}T00:00`)) / 86400000) + 1);
  const porHora = new Array(24).fill(0); noPeriodo.forEach((a) => { porHora[new Date(a.entrada).getHours()]++; });
  const pico = porHora.indexOf(Math.max(...porHora));
  const porDiaSem = new Array(7).fill(0); noPeriodo.forEach((a) => { porDiaSem[new Date(a.entrada).getDay()]++; });
  const diaPico = porDiaSem.indexOf(Math.max(...porDiaSem));
  const pct = (n) => (total ? ` · ${Math.round((n / total) * 100)}%` : '');
  $('#est-kpis').innerHTML = [
    ['Atendimentos', total, `${(total / dias).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia em média`],
    ['Consulta', tot.consulta, `eletiva${pct(tot.consulta)}`],
    ['Pronto Socorro', tot.ps, `emergência${pct(tot.ps)}`],
    ['Retorno', tot.retorno, `sem cobrança${pct(tot.retorno)}`],
    ['Recebido', formatarMoeda(tot.valor), 'consultas e PS (sem exames)'],
    ['Horário de pico', total ? `${String(pico).padStart(2, '0')}h` : '—', total ? `${porHora[pico]} atendimento(s) · ${DIAS_SEMANA[diaPico]} é o dia mais cheio` : 'sem movimento'],
  ].map(([t, v, s]) => `<article class="est-kpi"><span>${t}</span><strong>${v}</strong><small>${s}</small></article>`).join('');

  const nomes = { mes: 'mês', semana: 'semana', dia: 'dia', diaSemana: 'dia da semana', hora: 'hora do dia', quarto: 'faixa de 15 minutos' };
  $('#est-titulo-grafico').textContent = `Atendimentos por ${nomes[modo]}`;
  $('#est-col-periodo').textContent = { mes: 'Mês', semana: 'Semana', dia: 'Dia', diaSemana: 'Dia da semana', hora: 'Hora', quarto: 'Horário' }[modo];
  $('#est-legenda').innerHTML = SERIES_EST.map((s) => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join('');
  $('#est-vazio').hidden = total > 0;
  desenharGraficoEst(visiveis, total > 0);

  // Tabela (os mesmos números do gráfico)
  const linhasTabela = modo === 'quarto' || modo === 'hora' ? visiveis.filter((g) => g.total) : visiveis;
  $('#est-tabela').innerHTML = linhasTabela.map((g) => `
    <tr><td>${esc(g.longo)}</td><td class="num">${g.consulta}</td><td class="num">${g.ps}</td><td class="num">${g.retorno}</td>
    <td class="num"><strong>${g.total}</strong></td><td class="num">${formatarMoeda(g.valor)}</td></tr>`).join('')
    || '<tr><td colspan="6" class="vazio centro">Nenhum atendimento no período.</td></tr>';
  $('#est-rodape').innerHTML = `<tr><td>Total do período</td><td class="num">${tot.consulta}</td><td class="num">${tot.ps}</td><td class="num">${tot.retorno}</td><td class="num">${total}</td><td class="num">${formatarMoeda(tot.valor)}</td></tr>`;
}

// Gráfico de barras empilhadas (SVG), com dica ao passar o mouse
function desenharGraficoEst(grupos, temDados) {
  const area = $('#est-grafico');
  area.hidden = !temDados;
  if (!temDados) { area.innerHTML = ''; return; }
  const largura = Math.max(area.clientWidth - 28, Math.min(grupos.length * 9, 2400), 300); // barras finas para caber o dia todo
  const altura = 260, mEsq = 34, mBaixo = 26, mTopo = 10;
  const max = Math.max(1, ...grupos.map((g) => g.total));
  const passo = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const topo = Math.ceil(max / passo) * passo;
  const yDe = (v) => mTopo + (altura - mTopo - mBaixo) * (1 - v / topo);
  const larguraUtil = largura - mEsq - 4;
  const col = larguraUtil / grupos.length;
  const barra = Math.max(3, Math.min(36, col * 0.62));
  const cadaRotulo = Math.max(1, Math.ceil(46 / col)); // evita rótulos encavalados
  let svg = `<svg width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" aria-hidden="true">`;
  for (let v = 0; v <= topo; v += passo) {
    const y = yDe(v);
    svg += `<line class="grade" x1="${mEsq}" x2="${largura - 4}" y1="${y}" y2="${y}"/><text class="eixo-txt" x="${mEsq - 6}" y="${y + 4}" text-anchor="end">${v}</text>`;
  }
  grupos.forEach((g, i) => {
    const x = mEsq + i * col + (col - barra) / 2;
    let base = altura - mBaixo;
    const partes = SERIES_EST.filter((s) => g[s.chave] > 0);
    partes.forEach((s, k) => {
      const h = (altura - mTopo - mBaixo) * (g[s.chave] / topo);
      const ultimo = k === partes.length - 1;
      const y = base - h + (k > 0 ? 0 : 0);
      const alturaDesenho = Math.max(1, h - (ultimo ? 0 : 2)); // 2 px de espaço entre partes
      const r = ultimo ? Math.min(4, barra / 2, alturaDesenho) : 0;
      // retângulo com cantos arredondados só em cima
      svg += r
        ? `<path fill="${s.cor}" d="M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barra - r} Q${x + barra},${y} ${x + barra},${y + r} V${base} Z"/>`
        : `<rect fill="${s.cor}" x="${x}" y="${y + (ultimo ? 0 : 2)}" width="${barra}" height="${alturaDesenho}"/>`;
      base -= h;
    });
    if (i % cadaRotulo === 0) svg += `<text class="eixo-txt" x="${mEsq + i * col + col / 2}" y="${altura - 8}" text-anchor="middle">${esc(g.rotulo)}</text>`;
    svg += `<rect class="alvo" data-est-i="${i}" x="${mEsq + i * col}" y="${mTopo}" width="${col}" height="${altura - mTopo - mBaixo}"/>`;
  });
  svg += '</svg>';
  area.innerHTML = svg;
  area._grupos = grupos;
}

// Dica (tooltip) de cada barra
$('#est-grafico').addEventListener('mousemove', (e) => {
  const alvo = e.target.closest('.alvo');
  const dica = $('#est-tooltip');
  document.querySelectorAll('#est-grafico .alvo.ativo').forEach((a) => a.classList.remove('ativo'));
  if (!alvo) { dica.hidden = true; return; }
  alvo.classList.add('ativo');
  const g = $('#est-grafico')._grupos[Number(alvo.dataset.estI)];
  dica.innerHTML = `<strong>${esc(g.longo)}</strong>`
    + SERIES_EST.map((s) => `<div><span><i style="background:${s.cor}"></i>${s.nome}</span><span>${g[s.chave]}</span></div>`).join('')
    + `<div class="total"><span>Total</span><span>${g.total}</span></div><div><span>Recebido</span><span>${formatarMoeda(g.valor)}</span></div>`;
  dica.hidden = false;
  const card = $('#est-grafico').closest('.card').getBoundingClientRect();
  let x = e.clientX - card.left + 14;
  if (x + 190 > card.width) x = e.clientX - card.left - 200;
  dica.style.left = `${Math.max(8, x)}px`;
  dica.style.top = `${e.clientY - card.top + 10}px`;
});
$('#est-grafico').addEventListener('mouseleave', () => {
  $('#est-tooltip').hidden = true;
  document.querySelectorAll('#est-grafico .alvo.ativo').forEach((a) => a.classList.remove('ativo'));
});
window.addEventListener('resize', () => { if ($('#tela-estatisticas').classList.contains('ativa')) carregarEstatisticas(); });

// ---------- Navegação entre telas ----------
const carregadores = {
  atendimento: carregarAtendimento,
  fila: () => carregarFila(),
  ponto: () => carregarPonto(),
  painel: carregarPainel,
  agenda: carregarAgenda,
  'nova-consulta': carregarFormularioConsulta,
  exames: carregarExames,
  pedido: carregarPedido,
  precos: carregarPrecos,
  pacientes: carregarPacientes,
  medicos: carregarMedicos,
  financeiro: carregarFinanceiro,
  estatisticas: () => carregarEstatisticas(),
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
      <span class="paciente-cabeca"><strong>${esc(p.nome)}</strong>${ehParticular(p) ? '<span class="texto-particular">✱ Particular</span>' : ''}</span>
      <small>${dadosPaciente(p)}</small>
    </li>`).join('');
  // guarda a lista para o clique saber qual paciente foi escolhido
  $('#atend-resultados').dataset.lista = JSON.stringify(pacientes);
}

function selecionarPaciente(paciente) {
  estado.paciente = paciente;
  estado.vinculoExames = null;
  estado.pedido = { itens: [] };
  estado.risco = '';
  document.querySelectorAll('input[name="risco"]').forEach((r) => { r.checked = false; });
  $('#atend-resultados').innerHTML = '';
  renderCartaoPaciente();
  atualizarBotaoAbrir();
  carregarAtendimentosAnteriores();
}

function atualizarBotaoAbrir() {
  const precisaRisco = estado.modalidade === 'PRONTO_SOCORRO';
  $('#btn-abrir-atendimento').disabled = !(estado.paciente && estado.setor && $('#atend-medico').value && (!precisaRisco || estado.risco));
}

function renderAnteriores(atendimentos) {
  estado.anteriores = atendimentos;
  if (typeof renderCartaoPaciente === 'function') renderCartaoPaciente();
  $('#tabela-anteriores').innerHTML = atendimentos.map((a) => `
    <tr class="${a.particular === false ? '' : 'linha-particular'}${classeRisco(a.risco)}">
      <td>${a.particular === false ? '' : marcaParticular(a.risco)}${esc(a.numero)}</td>
      <td>${esc(a.senha)}</td>
      <td>${tagStatus(a.status)}</td>
      <td>${formatarDataHora(a.entrada)}</td>
      <td>${formatarDataHora(a.alta)}</td>
      <td>${esc(a.medico)}</td>
      <td>${a.retorno
        ? `<span class="tag tag-retorno" title="Retorno da consulta ${esc(a.consultaOrigem || '')}, sem cobrança">Retorno · sem cobrança</span>`
        : a.valor
          ? `<span class="valor-pago">${formatarMoeda(a.valor)} ${tagStatus(a.pago ? 'PAGO' : 'PENDENTE')}</span>`
          : '<span style="color:var(--muted)">—</span>'}</td>
      <td><div class="acoes-linha">${acoesAtendimento(a)}</div></td>
    </tr>`).join('');
  renderEtapas();
  if (typeof atualizarRetorno === 'function') atualizarRetorno();
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
    `<button class="btn-acao${destaque ? ' destaque' : ''}" data-exames-atend="${n}" title="O médico monta o pedido de exames e gera o código">Pedido de exames${qtd}</button>`;
  // Consulta e Pronto Socorro seguem o mesmo fluxo: pago → consulta → exames
  const recibo = a.pagamento ? `<button class="btn-acao" data-recibo-atend="${n}">Recibo</button>` : '';
  return recibo + acaoFluxo(a, n, botaoExames);
}

function precisaTriagem(a) {
  return (a.tipo || estado.modalidade) === 'PRONTO_SOCORRO' && !a.triagemEnfermagem;
}

function acaoFluxo(a, n, botaoExames) {
  if (!consultaConcluida(a)) {
    if (!a.pago && !a.retorno) return `<span class="dica">Aguardando pagamento</span>`;
    if (precisaTriagem(a)) return `<button class="btn-acao destaque" data-triagem="${n}">Triagem enfermagem</button>`;
    const reclass = (a.tipo || estado.modalidade) === 'PRONTO_SOCORRO'
      ? `<button class="btn-acao" data-triagem="${n}" title="Mudar a cor da prioridade">Reclassificar</button>` : '';
    return `${reclass}<button class="btn-acao destaque" data-concluir-atend="${n}">Concluir consulta</button>`;
  }
  return botaoExames(!a.exames);
}

// Etapas mostradas no topo do Atendimento
const ETAPAS = {
  CONSULTA: [
    { titulo: 'Paciente', dica: 'Buscar ou cadastrar' },
    { titulo: 'Pagamento', dica: 'Paga antes (retorno em até 30 dias é sem cobrança)' },
    { titulo: 'Consulta', dica: 'Médico atende' },
    { titulo: 'Exames', dica: 'Médico gera o pedido; recepção cobra pelo código' },
  ],
  PRONTO_SOCORRO: [
    { titulo: 'Paciente', dica: 'Basta o nome' },
    { titulo: 'Pré-classificação', dica: 'Recepção define a cor' },
    { titulo: 'Pagamento', dica: 'Antes da consulta de emergência' },
    { titulo: 'Triagem', dica: 'Enfermeiro confirma ou muda a cor' },
    { titulo: 'Consulta', dica: 'Médico de plantão atende' },
    { titulo: 'Exames', dica: 'Médico gera o pedido; recepção cobra pelo código' },
  ],
};

function atendimentoDeHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  return estado.anteriores.find((a) => String(a.entrada || '').slice(0, 10) === hoje && (a.tipo || estado.modalidade) === estado.modalidade);
}

function renderEtapas() {
  const a = estado.paciente ? atendimentoDeHoje() : null;
  let feitas = [!!estado.paciente, !!(a?.pago || a?.retorno), !!a && consultaConcluida(a), !!a?.exames];
  if (estado.modalidade === 'PRONTO_SOCORRO') {
    feitas = [!!estado.paciente, !!(estado.risco || a?.risco), !!a?.pago, !!a?.triagemEnfermagem,
      !!a && consultaConcluida(a), !!a?.exames];
  }
  const atual = feitas.indexOf(false);
  $('#atend-etapas').style.setProperty('--n-etapas', feitas.length);
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
      <td>${c.particular === false ? '' : marcaParticular()}${esc(c.paciente)}</td>
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
      <td>${c.particular === false ? '' : marcaParticular()}${esc(c.paciente)}</td>
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
      <td>${ehParticular(p) ? seloParticular() : esc(p.convenio)}</td>
      <td>${esc(p.cpf)}</td>
      <td>${esc(p.telefone)}</td>
      <td>${formatarData(p.ultimaConsulta)}</td>
      <td><button class="btn-acao" data-id="${esc(p.id)}">Ver</button></td>
    </tr>`).join('');
  $('#vazio-pacientes').hidden = pacientes.length > 0;
}

// Médicos da consulta particular
function renderMedicos(medicos) {
  $('#tabela-medicos').innerHTML = medicos.map((m) => `
    <tr>
      <td>${esc(m.nome)}</td>
      <td>${esc(m.crm)}</td>
      <td>${esc(m.especialidade)}</td>
      <td>${formatarMoeda(m.valorConsulta)}</td>
    </tr>`).join('');
  $('#vazio-medicos').hidden = medicos.length > 0;
}

// Plantonistas da Emergência
function renderPlantonistas() {
  const lista = [...DADOS.medicosEmergencia].sort((a, b) =>
    (!!entradaAtiva(b.id)) - (!!entradaAtiva(a.id)) || a.nome.localeCompare(b.nome));
  $('#tabela-plantonistas').innerHTML = lista.map((m) => {
    const e = entradaAtiva(m.id);
    return `
    <tr class="${e ? '' : 'fora-plantao'}">
      <td>${esc(m.nome)}</td>
      <td>${esc(m.crm)}</td>
      <td>${esc(m.especialidade)}</td>
      <td>${e ? `<span class="tag tag-entrada">Sim · desde ${horaBR(e.dataHora)}</span>` : '<a class="link-cadastro" href="#ponto">Não · registrar ponto</a>'}</td>
      <td><button class="btn-acao" data-remover-plantonista="${esc(m.id)}">Remover</button></td>
    </tr>`;
  }).join('');
  $('#vazio-plantonistas').hidden = lista.length > 0;
  $('#pill-plantonistas').textContent = `${plantonistasNoPlantao().length} no plantão`;
}

function atualizarListasDeMedicos() {
  renderPlantonistas();
  if (estado.modalidade === 'PRONTO_SOCORRO') carregarMedicosConsulta();
}

$('#pl-especialidade').innerHTML = '<option value="">Selecione</option>'
  + DADOS.especialidadesPlantao.map((e) => `<option>${esc(e)}</option>`).join('');

$('#form-plantonista').addEventListener('submit', (e) => {
  e.preventDefault();
  const nome = $('#pl-nome').value.trim();
  const crm = $('#pl-crm').value.trim();
  const especialidade = $('#pl-especialidade').value;
  if (!nome || !crm || !especialidade) return;
  if (DADOS.medicosEmergencia.some((m) => normalizar(m.crm) === normalizar(crm))) {
    $('#status-plantonistas').textContent = `Já existe um médico com o ${crm}.`;
    return;
  }
  const id = Math.max(100, ...DADOS.medicosEmergencia.map((m) => Number(m.id) || 0)) + 1;
  DADOS.medicosEmergencia.push({ id, nome, crm, especialidade });
  salvarPlantonistas();
  e.target.reset();
  $('#status-plantonistas').textContent = `Cadastro feito: ${nome} (${especialidade}). Para entrar no plantão, registre o ponto.`;
  atualizarListasDeMedicos();
  $('#pl-nome').focus();
});



document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-remover-plantonista]');
  if (!b) return;
  const m = DADOS.medicosEmergencia.find((x) => String(x.id) === b.dataset.removerPlantonista);
  if (!m || !(await confirmar(`Remover ${m.nome} da lista de plantonistas? Os atendimentos já feitos por ele não mudam.`, 'Remover'))) return;
  DADOS.medicosEmergencia = DADOS.medicosEmergencia.filter((x) => x !== m);
  salvarPlantonistas();
  $('#status-plantonistas').textContent = `${m.nome} saiu da lista de plantonistas.`;
  atualizarListasDeMedicos();
});

// Link "+ Cadastrar plantonista" no Atendimento: abre a tela Médicos no formulário
$('#link-cadastrar-plantonista').addEventListener('click', () => setTimeout(() => $('#pl-nome').focus(), 50));

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
      <td>${r.pagamento ? `<button class="btn-acao" data-recibo-fin="${recebimentos.indexOf(r)}">Recibo</button>` : ''}</td>
    </tr>`).join('');
  estado.recebimentosTela = recebimentos;
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
  // Setores de estado.modalidade (vêm de DADOS; troque por banco de dados quando tiver).
  //   No Pronto Socorro, cada setor traz o valor da consulta de emergência.
  preencherSetores(DADOS.setores[estado.modalidade] || []);
}

function preencherSetores(lista) {
  estado.setores = lista;
  preencherSelect('#atend-setor', lista.map((s) => ({ valor: s.id, texto: s.nome })), 'Selecione o setor');
  // Se só existe um setor, ele já vem selecionado
  if (lista.length === 1) {
    $('#atend-setor').value = String(lista[0].id);
    estado.setor = String(lista[0].id);
  }
  atualizarValorPS();
  if (typeof atualizarTituloAnteriores === 'function') atualizarTituloAnteriores();
  if (typeof atualizarBotaoAbrir === 'function') atualizarBotaoAbrir();
}

function setorSelecionado() {
  return (estado.setores || []).find((s) => String(s.id) === String(estado.setor));
}

function atualizarValorPS() {
  const s = setorSelecionado();
  $('#atend-valor-ps').textContent = s ? (s.valorConsulta ? formatarMoeda(s.valorConsulta) : 'Informe na hora do pagamento') : 'Escolha o setor';
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
  $('#linha-valor-ps').hidden = modalidade !== 'PRONTO_SOCORRO';
  $('#card-risco').hidden = modalidade !== 'PRONTO_SOCORRO';
  $('#card-retorno').hidden = true; // Pronto Socorro não tem retorno
  renderCartaoPaciente();
  estado.setor = '';
  carregarSetores();
  carregarMedicosConsulta();
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
    convenio: '', // vazio = particular (sem convênio, paga por serviço)
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
  atualizarValorPS();
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
  // Consulta: médicos da consulta particular. Pronto Socorro: médicos de plantão da Emergência.
  // (vêm de DADOS; troque por banco de dados quando tiver)
  const ps = estado.modalidade === 'PRONTO_SOCORRO';
  preencherMedicosConsulta(ps ? plantonistasNoPlantao() : DADOS.medicosConsulta);
  const link = $('#link-cadastrar-plantonista');
  link.hidden = !ps;
  const ninguem = ps && plantonistasNoPlantao().length === 0;
  link.textContent = ninguem ? 'Nenhum médico no plantão · registrar ponto' : '+ Cadastrar plantonista';
  link.setAttribute('href', ninguem ? '#ponto' : '#medicos');
}

function preencherMedicosConsulta(lista) {
  estado.medicosConsulta = lista;
  const ps = estado.modalidade === 'PRONTO_SOCORRO';
  preencherSelect('#atend-medico',
    lista.map((m) => ({ valor: m.id, texto: m.especialidade ? `${m.nome} · ${m.especialidade}` : m.nome })),
    ps ? 'Selecione o médico de plantão' : 'Selecione o médico');
  $('#atend-medico-rotulo').textContent = ps ? 'Médico de plantão:' : 'Médico:';
  $('#atend-valor-consulta-linha').hidden = ps;
  $('#atend-valor-consulta').textContent = '—';
  if (typeof atualizarBotaoAbrir === 'function') atualizarBotaoAbrir();
}

function medicoConsultaSelecionado() {
  return estado.medicosConsulta.find((m) => String(m.id) === $('#atend-medico').value);
}

$('#atend-medico').addEventListener('change', () => {
  const m = medicoConsultaSelecionado();
  $('#atend-valor-consulta').textContent = m ? formatarMoeda(m.valorConsulta) : '—';
  atualizarBotaoAbrir();
  atualizarRetorno();
});

// ---------- Retorno da consulta eletiva ----------
// Só na aba Consulta: consulta paga e concluída, com o MESMO médico, há no máximo DADOS.diasRetorno dias,
// e que ainda não teve retorno. Pronto Socorro não tem retorno.
function consultaParaRetorno() {
  if (estado.modalidade !== 'CONSULTA' || !estado.paciente) return null;
  const m = medicoConsultaSelecionado();
  if (!m) return null;
  const limite = Date.now() - DADOS.diasRetorno * 86400000;
  const lista = estado.anteriores || [];
  return lista
    .filter((a) => (a.tipo || 'CONSULTA') === 'CONSULTA' && !a.retorno && a.pago && consultaConcluida(a)
      && a.medico === m.nome && new Date(a.entrada).getTime() >= limite
      && !lista.some((x) => x.retorno && String(x.consultaOrigem) === String(a.numero)))
    .sort((x, y) => String(y.entrada).localeCompare(String(x.entrada)))[0] || null;
}

function atualizarRetorno() {
  const c = consultaParaRetorno();
  $('#card-retorno').hidden = !c || !estado.setor;
  if (!c) return;
  const ate = new Date(new Date(c.entrada).getTime() + DADOS.diasRetorno * 86400000);
  $('#retorno-info').textContent = `Consulta ${c.numero} de ${formatarData(c.entrada)} com ${c.medico}. `
    + `Retorno sem cobrança até ${ate.toLocaleDateString('pt-BR')}. Se for um problema novo, use o pagamento normal.`;
}

$('#btn-registrar-retorno').addEventListener('click', async () => {
  const c = consultaParaRetorno();
  if (!c) return;
  if (!(await confirmar(`Registrar retorno da consulta ${c.numero} com ${c.medico}, sem cobrança?`, 'Registrar retorno'))) return;
  await registrarAtendimento({
    paciente: estado.paciente, setor: estado.setor, modalidade: 'CONSULTA',
    medico: medicoConsultaSelecionado(), valor: 0, pagamento: null,
    retorno: true, consultaOrigem: c.numero,
  });
  carregarAtendimentosAnteriores();
});

// ---------- Abrir atendimento ----------
// Consulta: abre a janela de pagamento primeiro; só abre a consulta se o pagamento for confirmado.
// Pronto Socorro: também paga antes; o valor vem do setor (consulta de emergência).
$('#btn-abrir-atendimento').addEventListener('click', async () => {
  const setor = $('#atend-setor').selectedOptions[0]?.text || '';
  const dados = { paciente: estado.paciente, setor: estado.setor, modalidade: estado.modalidade };
  if (estado.modalidade === 'PRONTO_SOCORRO') {
    dados.risco = estado.risco; // VERMELHO | LARANJA | AMARELO | VERDE
    dados.riscoOrigem = 'RECEPCAO'; // pré-classificação; a enfermagem confirma ou muda na triagem
    dados.historicoRisco = [{ risco: estado.risco, por: 'RECEPCAO', dataHora: new Date().toISOString() }];
  }

  if (estado.modalidade === 'CONSULTA') {
    const m = medicoConsultaSelecionado();
    const pagamento = await abrirPagamento({
      descricao: `Consulta particular · ${estado.paciente.nome}`,
      itens: [{ nome: `Consulta · ${m?.nome || 'médico'} · ${setor}`, valor: m?.valorConsulta || 0 }],
      valor: m?.valorConsulta || 0,
      valorEditavel: true,
      contexto: { tipo: 'CONSULTA', paciente: estado.paciente.nome, cpf: estado.paciente.cpf, medico: m?.nome || '' },
    });
    if (!pagamento) return; // cancelou: a consulta NÃO é aberta
    dados.medico = m;
    dados.valor = pagamento.valor;
    dados.pagamento = pagamento;
  } else {
    const s = setorSelecionado();
    const m = medicoConsultaSelecionado();
    const valor = s?.valorConsulta || 0;
    const pagamento = await abrirPagamento({
      descricao: `Pronto Socorro · ${estado.paciente.nome}`,
      itens: [{ nome: `Consulta de emergência · ${m?.nome || 'plantão'} · ${setor}`, valor }],
      valor,
      valorEditavel: true,
      contexto: { tipo: 'CONSULTA', paciente: estado.paciente.nome, cpf: estado.paciente.cpf, medico: m?.nome || setor },
    });
    if (!pagamento) return; // cancelou: o paciente NÃO é liberado
    dados.medico = m;
    dados.valor = pagamento.valor;
    dados.pagamento = pagamento;
  }

  // Pago: o paciente fica liberado para a consulta (status AGUARDANDO)
  await registrarAtendimento(dados);
  carregarAtendimentosAnteriores();
});

async function registrarAtendimento(dados) {
  // TODO: salvar o atendimento (consulta ou pronto socorro).
  //   dados = { paciente, setor, modalidade, medico?, valor, pagamento, retorno?, consultaOrigem? }
  //   dados.pagamento sempre existe (já foi confirmado), EXCETO no retorno da consulta eletiva
  //   (retorno: true, valor 0, consultaOrigem = número da consulta). Grave com status AGUARDANDO (liberado para consulta).
  console.log('Abrir atendimento', dados);
}

// =========================================================
//   JANELA DE PAGAMENTO
//   abrirPagamento({ descricao, itens, valor, valorEditavel, desconto })
//   devolve o pagamento confirmado, ou null se cancelar.
// =========================================================
let resolverPagamento = null;

let contextoPagamento = null;
let itensPagamento = null;

function abrirPagamento({ descricao = '', itens = [], valor = 0, valorEditavel = false, desconto = 0, contexto = null } = {}) {
  const f = $('#form-pagamento');
  contextoPagamento = contexto; // { tipo: 'CONSULTA' | 'EXAMES', paciente, cpf, medico }
  itensPagamento = { descricao, itens, desconto };
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
  Object.assign(pagamento, itensPagamento); // descricao, itens, desconto (para o recibo)
  estado.ultimoPagamento = pagamento;
  const registro = await registrarPagamento(pagamento);
  pagamento.numeroRecibo = registro?.numeroRecibo || gerarNumeroRecibo();
  fecharPagamento(pagamento);
  if (CONFIG.reciboAutomatico) mostrarRecibo(pagamento);
});

// Número provisório do recibo. O ideal é o seu sistema devolver o número em registrarPagamento().
function gerarNumeroRecibo() {
  const d = new Date();
  const data = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${data}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

// Todo pagamento confirmado passa por aqui (consulta ou exames).
// pagamento.contexto = { tipo: 'CONSULTA' | 'EXAMES', paciente, medico }
async function registrarPagamento(pagamento) {
  // TODO: gravar o recebimento no seu sistema (é ele que alimenta o Financeiro).
  //   Se o sistema gerar o número do recibo, devolva { numeroRecibo: '...' }.
  console.log('Pagamento confirmado', pagamento);
  return null;
}

// =========================================================
//   RECIBO
// =========================================================

// Valor por extenso em reais: 1250.5 → "mil duzentos e cinquenta reais e cinquenta centavos"
function valorPorExtenso(valor) {
  const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze',
    'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n) => {
    if (n === 100) return 'cem';
    const partes = [];
    const c = Math.floor(n / 100), r = n % 100;
    if (c) partes.push(C[c]);
    if (r) partes.push(r < 20 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : ''));
    return partes.join(' e ');
  };
  const inteiro = (n) => {
    if (n === 0) return 'zero';
    const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    const grupos = []; // [valor do grupo, texto]
    if (mi) grupos.push([mi, mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`]);
    if (mil) grupos.push([mil, mil === 1 ? 'mil' : `${ate999(mil)} mil`]);
    if (resto) grupos.push([resto, ate999(resto)]);
    // "e" antes do último grupo quando ele é redondo: "mil e cem", "dois milhões e quinhentos mil"
    const [ultimoValor] = grupos[grupos.length - 1];
    if (grupos.length > 1 && (ultimoValor < 100 || ultimoValor % 100 === 0)) grupos[grupos.length - 1][1] = 'e ' + grupos[grupos.length - 1][1];
    return grupos.map((g) => g[1]).join(' ');
  };
  const centavosTotal = Math.round(Number(valor || 0) * 100);
  const reais = Math.floor(centavosTotal / 100), centavos = centavosTotal % 100;
  const parteReais = reais
    ? `${inteiro(reais)}${reais % 1e6 === 0 && reais >= 1e6 ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}` : '';
  const parteCentavos = centavos ? `${ate999(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : '';
  if (parteReais && parteCentavos) return `${parteReais} e ${parteCentavos}`;
  return parteReais || parteCentavos || 'zero real';
}

function dataHoraBR(iso) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarRecibo(p) {
  const area = $('#recibo-area');
  if (!p) {
    area.innerHTML = '<p class="recibo-vazio">Nenhum pagamento feito ainda. O recibo aparece aqui depois do primeiro pagamento.</p>';
  } else {
    const e = CONFIG.empresa;
    const ctx = p.contexto || {};
    const itens = p.itens?.length ? p.itens : [{ nome: p.descricao || 'Pagamento', valor: p.valor }];
    const subtotal = itens.reduce((t, i) => t + Number(i.valor || 0), 0);
    const referente = ctx.tipo === 'EXAMES' ? 'exames particulares' : (p.descricao || '').toLowerCase().includes('pronto socorro')
      ? 'consulta de emergência (Pronto Socorro)' : 'consulta particular';
    const detalhes = [
      ['Forma de pagamento', NOMES_FORMA[p.forma] || p.forma],
      p.parcelas > 1 && ['Parcelas', `${p.parcelas}x de ${formatarMoeda(p.valor / p.parcelas)}`],
      p.autorizacao && ['Autorização / NSU', p.autorizacao],
      p.idTransacao && ['ID da transação Pix', p.idTransacao],
      p.forma === 'DINHEIRO' && ['Valor recebido', formatarMoeda(p.recebido)],
      p.forma === 'DINHEIRO' && ['Troco', formatarMoeda(p.troco || 0)],
      ctx.medico && [ctx.tipo === 'EXAMES' ? 'Médico solicitante' : 'Médico / setor', ctx.medico],
      ctx.atendimento && ['Atendimento', ctx.atendimento],
    ].filter(Boolean);

    area.innerHTML = `
      <div class="recibo">
        <div class="recibo-topo">
          <div class="recibo-empresa">
            <strong>${esc(e.nome)}</strong>
            <span>CNPJ ${esc(e.cnpj)}</span>
            <span>${esc(e.endereco)}</span>
            <span>Tel. ${esc(e.telefone)}</span>
          </div>
          <div class="recibo-numero">
            <h2>RECIBO</h2>
            <span>Nº ${esc(p.numeroRecibo || '—')}</span>
            <span>${dataHoraBR(p.dataHora)}</span>
            <span class="recibo-valor">${formatarMoeda(p.valor)}</span>
          </div>
        </div>

        <p class="recibo-texto">
          Recebemos de <strong>${esc(ctx.paciente || 'paciente')}</strong>${ctx.cpf ? `, CPF ${esc(ctx.cpf)},` : ''}
          a importância de <strong>${formatarMoeda(p.valor)}</strong> (${valorPorExtenso(p.valor)}),
          referente a ${referente}, em atendimento <strong>particular</strong> (sem convênio, pago por serviço),
          conforme os itens abaixo.
        </p>

        <table>
          <thead><tr><th>Descrição</th><th>Valor</th></tr></thead>
          <tbody>${itens.map((i) => `<tr><td>${esc(i.nome)}</td><td>${formatarMoeda(i.valor)}</td></tr>`).join('')}</tbody>
          <tfoot>
            ${p.desconto ? `<tr><td>Subtotal</td><td>${formatarMoeda(subtotal)}</td></tr>
                            <tr><td>Desconto</td><td>− ${formatarMoeda(p.desconto)}</td></tr>` : ''}
            <tr class="total"><td>Total pago</td><td>${formatarMoeda(p.valor)}</td></tr>
          </tfoot>
        </table>

        <div class="recibo-pagamento">
          ${detalhes.map(([k, v]) => `<div><span>${esc(k)}:</span> <strong>${esc(v)}</strong></div>`).join('')}
        </div>

        <div class="recibo-assinatura">
          <div>${esc($('#usuario-nome').textContent || 'Atendente')}<br>Atendente</div>
          <div>Assinatura / carimbo<br>Hospital</div>
        </div>

        <p class="recibo-rodape">Este recibo comprova o pagamento e não substitui a nota fiscal.</p>
      </div>`;
  }
  $('#btn-imprimir-recibo').hidden = !p;
  $('#modal-recibo').hidden = false;
  $('#btn-fechar-recibo').focus();
}

function fecharRecibo() { $('#modal-recibo').hidden = true; }
$('#btn-fechar-recibo').addEventListener('click', fecharRecibo);
$('#modal-recibo').addEventListener('click', (e) => { if (e.target.id === 'modal-recibo') fecharRecibo(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal-recibo').hidden) fecharRecibo(); });
$('#btn-imprimir-recibo').addEventListener('click', () => {
  // TODO: se usar impressora térmica ou outro modelo, troque aqui
  window.print();
});

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
  estado.vinculoExames = { modalidade: a?.tipo || estado.modalidade, numero: a?.numero, entrada: a?.entrada, medico: a?.medico, risco: a?.risco || '' };
  estado.pedido = { itens: [] };
  $('#pd-codigo-card').hidden = true;
  $('#pd-obs').value = '';
  location.hash = '#pedido';
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

// Botões "Recibo" (lista de atendimentos e Financeiro)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-recibo-atend], [data-recibo-fin]');
  if (!b) return;
  const p = b.dataset.reciboAtend
    ? estado.anteriores.find((x) => String(x.numero) === b.dataset.reciboAtend)?.pagamento
    : estado.recebimentosTela?.[b.dataset.reciboFin]?.pagamento;
  mostrarRecibo(p || null);
});

// Botão "Exames" do topo: requisição avulsa, sem vínculo
$('#btn-exames-avulso').addEventListener('click', () => { estado.vinculoExames = null; });

$('#btn-recibo').addEventListener('click', () => mostrarRecibo(estado.ultimoPagamento));

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
// Valores da tabela de referência aprovada. Os CÓDIGOS laboratoriais ainda são exemplos: confira.
// TODO: quando tiver API, buscar a tabela de lá em vez do navegador.

const CATEGORIAS_EXAME = ['Ultrassonografia', 'Tomografia', 'Ressonância magnética', 'Raio-X', 'Mamografia',
  'Densitometria', 'Eletrocardiograma', 'Ecocardiograma', 'Endoscopia', 'Outro'];

const PRECOS_EXEMPLO = {
  // Adicional cobrado quando a tomografia é feita com contraste
  adicionais: { contrasteTomografia: 250 },
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
    // Tomografia por região: cabeça e pescoço, tronco, coluna, braço e perna
    { categoria: 'Tomografia', nome: 'TC de crânio', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de face', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de seios da face', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de órbitas', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de ouvidos (mastoides)', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de pescoço', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de tórax', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de abdome superior', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de abdome total', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de pelve', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de coluna cervical', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de coluna torácica', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de coluna lombar', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de ombro', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de braço', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de cotovelo', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de antebraço', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de punho', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de mão', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de quadril', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de coxa', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de joelho', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de perna', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de tornozelo', valor: 750 },
    { categoria: 'Tomografia', nome: 'TC de pé', valor: 750 },
    { categoria: 'Ressonância magnética', nome: 'RM de crânio', valor: 800 },
    { categoria: 'Ressonância magnética', nome: 'RM de coluna lombar', valor: 850 },
    { categoria: 'Ressonância magnética', nome: 'RM de joelho', valor: 750 },
    { categoria: 'Ressonância magnética', nome: 'RM de ombro', valor: 750 },
    // Raio-X: um item só, vale para qualquer osso ou região
    { categoria: 'Raio-X', nome: 'Raio-X', valor: 90 },
    { categoria: 'Mamografia', nome: 'Mamografia bilateral', valor: 150 },
    { categoria: 'Densitometria', nome: 'Densitometria óssea', valor: 160 },
    { categoria: 'Eletrocardiograma', nome: 'Eletrocardiograma (ECG)', valor: 60 },
    { categoria: 'Ecocardiograma', nome: 'Ecocardiograma transtorácico', valor: 250 },
    { categoria: 'Endoscopia', nome: 'Endoscopia digestiva alta', valor: 350 },
    { categoria: 'Endoscopia', nome: 'Colonoscopia', valor: 700 },
  ],
  laboratorial: [
    // Valores de EXEMPLO. Códigos LAB-xxx são internos: troque pelos códigos e valores do laboratório do hospital.
    { codigo: '40304361', nome: 'Hemograma completo', valor: 25 },
    { codigo: '40302040', nome: 'Glicose', valor: 10 },
    { codigo: '40301630', nome: 'Creatinina', valor: 12 },
    { codigo: 'LAB-001', nome: 'Ureia', valor: 12 },
    { codigo: 'LAB-002', nome: 'Sódio', valor: 12 },
    { codigo: 'LAB-003', nome: 'Potássio', valor: 12 },
    { codigo: 'LAB-004', nome: 'TGO (AST)', valor: 15 },
    { codigo: 'LAB-005', nome: 'TGP (ALT)', valor: 15 },
    { codigo: 'LAB-006', nome: 'Colesterol total', valor: 15 },
    { codigo: 'LAB-007', nome: 'HDL colesterol', valor: 15 },
    { codigo: 'LAB-008', nome: 'LDL colesterol', valor: 15 },
    { codigo: 'LAB-009', nome: 'Triglicerídeos', valor: 15 },
    { codigo: 'LAB-010', nome: 'Hemoglobina glicada (HbA1c)', valor: 35 },
    { codigo: 'LAB-011', nome: 'TSH', valor: 40 },
    { codigo: 'LAB-012', nome: 'T4 livre', valor: 40 },
    { codigo: 'LAB-013', nome: 'PCR (proteína C reativa)', valor: 30 },
    { codigo: 'LAB-014', nome: 'VHS', valor: 15 },
    { codigo: 'LAB-015', nome: 'Urina tipo I (EAS)', valor: 20 },
    { codigo: 'LAB-016', nome: 'Urocultura', valor: 40 },
    { codigo: 'LAB-017', nome: 'Beta-HCG (teste de gravidez)', valor: 45 },
    { codigo: 'LAB-018', nome: 'Coagulograma (TAP e TTPA)', valor: 40 },
    { codigo: 'LAB-019', nome: 'Troponina', valor: 80 },
    { codigo: 'LAB-020', nome: 'CK-MB', valor: 50 },
    { codigo: 'LAB-021', nome: 'Amilase', valor: 25 },
    { codigo: 'LAB-022', nome: 'Lipase', valor: 30 },
    { codigo: 'LAB-023', nome: 'Gasometria arterial', valor: 60 },
    { codigo: 'LAB-024', nome: 'Dengue NS1', valor: 80 },
    { codigo: 'LAB-025', nome: 'Tipagem sanguínea (ABO e Rh)', valor: 25 },
  ],
};

const normalizar = (t) => String(t || '').trim().toLowerCase();
const CHAVE_PRECOS = 'consultaParticular.tabelaPrecos';
let precos = carregarTabelaPrecos();

function copiarExemplos() {
  return JSON.parse(JSON.stringify(PRECOS_EXEMPLO));
}

function carregarTabelaPrecos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_PRECOS));
    if (salvo && Array.isArray(salvo.imagem) && Array.isArray(salvo.laboratorial)) {
      // acrescenta exames novos da lista de exemplo que ainda não estão na tabela salva
      const nomes = new Set(salvo.imagem.map((p) => normalizar(p.nome)));
      copiarExemplos().imagem.forEach((p) => { if (!nomes.has(normalizar(p.nome))) salvo.imagem.push(p); });
      const codigos = new Set(salvo.laboratorial.map((p) => normalizar(p.codigo)));
      copiarExemplos().laboratorial.forEach((p) => { if (!codigos.has(normalizar(p.codigo))) salvo.laboratorial.push(p); });
      // Tomografia passou a custar R$ 750,00: atualiza quem ainda está com o valor de exemplo antigo
      const tcAntigo = { 'TC de crânio': 350, 'TC de face': 330, 'TC de seios da face': 330, 'TC de órbitas': 350, 'TC de ouvidos (mastoides)': 350, 'TC de pescoço': 400, 'TC de tórax': 420, 'TC de abdome superior': 450, 'TC de abdome total': 650, 'TC de pelve': 450, 'TC de coluna cervical': 450, 'TC de coluna torácica': 450, 'TC de coluna lombar': 450, 'TC de ombro': 400, 'TC de braço': 380, 'TC de cotovelo': 380, 'TC de antebraço': 380, 'TC de punho': 380, 'TC de mão': 380, 'TC de quadril': 420, 'TC de coxa': 400, 'TC de joelho': 400, 'TC de perna': 400, 'TC de tornozelo': 380, 'TC de pé': 380 };
      salvo.imagem.forEach((p) => { if (p.categoria === 'Tomografia' && tcAntigo[p.nome] === p.valor) p.valor = 750; });
      salvo.adicionais = { ...copiarExemplos().adicionais, ...(salvo.adicionais || {}) };
      return salvo;
    }
  } catch (e) { /* navegador sem armazenamento: usa os exemplos */ }
  return copiarExemplos();
}

function salvarTabelaPrecos() {
  try { localStorage.setItem(CHAVE_PRECOS, JSON.stringify(precos)); } catch (e) { /* ignora */ }
}

const precoImagem = (nome) => precos.imagem.find((p) => normalizar(p.nome) === normalizar(nome))
  // Raio-X vale para qualquer osso: "Raio-X de joelho", "RX de tórax" etc. usam o valor do Raio-X
  || (/^(raio[\s-]?x|rx)\b/.test(normalizar(nome)) ? precos.imagem.find((p) => p.categoria === 'Raio-X') : undefined);
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

$('#pr-contraste').addEventListener('change', (e) => {
  precos.adicionais = { ...(precos.adicionais || {}), contrasteTomografia: lerMoeda(e.target.value) };
  salvarTabelaPrecos();
  $('#status-precos').textContent = `Adicional de contraste: ${formatarMoeda(adicionalContraste())}.`;
  atualizarCampoContraste();
});

function renderPrecos() {
  $('#pr-contraste').value = valorCampo(adicionalContraste());
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
  const medicoAtual = $('#ex-medico').value;
  preencherSelect('#ex-medico', todosMedicos().map((m) => ({ valor: m.id, texto: m.nome })));
  $('#ex-medico').value = medicoAtual;
  if (!$('#ex-data').value) $('#ex-data').value = new Date().toISOString().slice(0, 10);
  renderPacienteExames();
  renderVinculoExames();
  renderPendentes();
  atualizarSugestoesExames();
  atualizarCampoContraste();
  trocarTipoExame(false);
  renderExames();
}

// =========================================================
//   PEDIDO DO MÉDICO (código) → RECEPÇÃO CARREGA E COBRA
//   Os pedidos ficam neste navegador. TODO: quando tiver banco de dados,
//   troque lerPedidos(), salvarPedidoMedico(), buscarPedidoMedico() e marcarPedidoPago().
// =========================================================
const CHAVE_PEDIDOS = 'consultaParticular.pedidos';

function lerPedidos() {
  try { return JSON.parse(localStorage.getItem(CHAVE_PEDIDOS)) || []; } catch (e) { return []; }
}
function gravarPedidos(lista) {
  try { localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(lista)); return true; } catch (e) { return false; }
}
async function salvarPedidoMedico(pedido) {
  const lista = lerPedidos(); lista.push(pedido);
  if (!gravarPedidos(lista)) throw new Error('sem espaço');
}
async function buscarPedidoMedico(codigo) {
  return lerPedidos().find((p) => p.codigo === codigo) || null;
}
async function marcarPedidoPago(codigo, pagamento) {
  const lista = lerPedidos();
  const p = lista.find((x) => x.codigo === codigo);
  if (p) { p.status = 'PAGO'; p.pagoEm = pagamento?.dataHora || new Date().toISOString(); gravarPedidos(lista); }
}

// Código curto, sem letras/números que confundem (0/O, 1/I)
function gerarCodigoPedido() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const usados = new Set(lerPedidos().map((p) => p.codigo));
  let codigo;
  do {
    codigo = 'PED-' + Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');
  } while (usados.has(codigo));
  return codigo;
}

function normalizarCodigoPedido(texto) {
  const limpo = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limpo) return '';
  return 'PED-' + limpo.replace(/^PED/, '');
}

// Catálogo para o médico: exames de imagem e de laboratório da Tabela de preços
function catalogoExames() {
  return [
    ...precos.imagem.map((p) => ({ tipo: 'imagem', categoria: p.categoria, nome: p.nome })),
    ...precos.laboratorial.map((p) => ({ tipo: 'laboratorial', codigo: p.codigo, nome: p.nome })),
  ];
}

function identificarExame(texto) {
  const t = String(texto || '').trim();
  const base = t.replace(new RegExp(SUFIXO_CONTRASTE + '$', 'i'), '');
  const img = precos.imagem.find((p) => normalizar(p.nome) === normalizar(base));
  if (img) return { tipo: 'imagem', categoria: img.categoria, nome: img.nome };
  if (/^(raio[\s-]?x|rx)\b/.test(normalizar(t))) return { tipo: 'imagem', categoria: 'Raio-X', nome: t };
  const lab = precos.laboratorial.find((p) => normalizar(p.nome) === normalizar(t) || normalizar(p.codigo) === normalizar(t));
  if (lab) return { tipo: 'laboratorial', codigo: lab.codigo, nome: lab.nome };
  return null;
}

function carregarPedido() {
  const atual = $('#pd-medico').value;
  const medicos = todosMedicos();
  preencherSelect('#pd-medico', medicos.map((m) => ({ valor: m.id, texto: `${m.nome} · ${m.especialidade}` })));
  // sugere o médico do atendimento de origem
  const doAtendimento = medicos.find((m) => m.nome === estado.vinculoExames?.medico);
  $('#pd-medico').value = atual || (doAtendimento ? String(doAtendimento.id) : '');
  $('#pd-sugestoes').innerHTML = catalogoExames().map((e) =>
    `<option value="${esc(e.nome)}" label="${e.tipo === 'imagem' ? esc(e.categoria) : 'Laboratório · ' + esc(e.codigo)}">`).join('');
  const p = estado.paciente;
  $('#pd-paciente').innerHTML = p
    ? `<div class="paciente-selecionado${classeRisco(estado.vinculoExames?.risco)}">${cartaoPaciente(p, estado.vinculoExames?.risco)}</div>
       ${estado.vinculoExames ? `<p class="dica" style="margin:8px 0 0">${esc(MODALIDADES[estado.vinculoExames.modalidade]?.nome || '')} · Atend. ${esc(estado.vinculoExames.numero)}</p>` : ''}`
    : '<p class="paciente-vazio">Nenhum paciente selecionado.<br><a href="#atendimento">Abra pelo botão Pedido de exames no Atendimento</a>.</p>';
  renderItensPedido();
  renderPedidosHoje();
}

function renderItensPedido() {
  const itens = estado.pedido.itens;
  $('#tabela-pedido-itens').innerHTML = itens.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${x.tipo === 'imagem' ? esc(x.categoria) : 'Laboratório'}</td>
      <td>${esc(x.nome)}${x.tipo === 'laboratorial' ? ` <small class="codigo" style="color:var(--muted)">${esc(x.codigo)}</small>` : ''}</td>
      <td>${botaoRemover(`data-remover-item-pedido="${i}"`)}</td>
    </tr>`).join('');
  $('#vazio-pedido-itens').hidden = itens.length > 0;
  $('#pd-pill').textContent = `${itens.length} exame${itens.length === 1 ? '' : 's'}`;
  $('#btn-gerar-pedido').disabled = !(estado.paciente && itens.length && $('#pd-medico').value);
}

function renderPedidosHoje() {
  const hoje = new Date().toDateString();
  const lista = lerPedidos().filter((p) => new Date(p.criadoEm).toDateString() === hoje).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  $('#tabela-pedidos').innerHTML = lista.map((p) => `
    <tr>
      <td class="codigo">${esc(p.codigo)}</td>
      <td>${horaBR(p.criadoEm)}</td>
      <td>${esc(p.paciente?.nome)}</td>
      <td>${esc(p.medicoNome)}</td>
      <td>${p.itens.length}</td>
      <td>${p.status === 'PAGO' ? '<span class="tag tag-pago">Pago</span>' : '<span class="tag tag-pendente-pedido">Aguardando pagamento</span>'}</td>
    </tr>`).join('');
  $('#vazio-pedidos').hidden = lista.length > 0;
}

$('#pd-exame').addEventListener('input', (e) => {
  e.target.setCustomValidity('');
  const ex = identificarExame(e.target.value);
  $('#pd-campo-contraste').hidden = ex?.categoria !== 'Tomografia';
  if (ex?.categoria !== 'Tomografia') $('#pd-contraste').checked = false;
});
$('#pd-medico').addEventListener('change', renderItensPedido);

$('#form-pedido-item').addEventListener('submit', (e) => {
  e.preventDefault();
  const campo = $('#pd-exame');
  const ex = identificarExame(campo.value);
  if (!ex) { campo.setCustomValidity('Exame não encontrado na Tabela de preços. Escolha um item da lista.'); campo.reportValidity(); return; }
  if (ex.categoria === 'Tomografia' && $('#pd-contraste').checked) { ex.contraste = true; ex.nome += SUFIXO_CONTRASTE; }
  const repetido = estado.pedido.itens.some((x) => normalizar(x.nome) === normalizar(ex.nome));
  if (repetido) { campo.setCustomValidity('Esse exame já está no pedido.'); campo.reportValidity(); return; }
  estado.pedido.itens.push(ex);
  campo.value = '';
  $('#pd-contraste').checked = false;
  $('#pd-campo-contraste').hidden = true;
  $('#pd-codigo-card').hidden = true;
  renderItensPedido();
  campo.focus();
});

$('#tabela-pedido-itens').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remover-item-pedido]');
  if (!b) return;
  estado.pedido.itens.splice(Number(b.dataset.removerItemPedido), 1);
  renderItensPedido();
});

$('#btn-gerar-pedido').addEventListener('click', async () => {
  $('#pd-erro').textContent = '';
  const medico = todosMedicos().find((m) => String(m.id) === $('#pd-medico').value);
  if (!estado.paciente || !medico || !estado.pedido.itens.length) return;
  const p = estado.paciente;
  const pedido = {
    codigo: gerarCodigoPedido(),
    criadoEm: new Date().toISOString(),
    paciente: { id: p.id, nome: p.nome, cpf: p.cpf || '', nascimento: p.nascimento || '', convenio: p.convenio || '' },
    origem: estado.vinculoExames, // atendimento de onde veio (consulta ou PS)
    medicoId: medico.id, medicoNome: medico.nome,
    observacoes: $('#pd-obs').value.trim(),
    itens: estado.pedido.itens, // [{ tipo: 'imagem', categoria, nome, contraste? } | { tipo: 'laboratorial', codigo, nome }]
    status: 'PENDENTE',
  };
  try { await salvarPedidoMedico(pedido); } catch (erro) { $('#pd-erro').textContent = 'Não foi possível salvar o pedido.'; return; }
  $('#pd-codigo').textContent = pedido.codigo;
  $('#pd-codigo-info').textContent = `${pedido.itens.length} exame${pedido.itens.length === 1 ? '' : 's'} para ${p.nome}. Entregue ao paciente: a recepção digita este código na tela Exames para cobrar.`;
  $('#pd-codigo-card').hidden = false;
  estado.pedido = { itens: [] };
  $('#pd-obs').value = '';
  renderItensPedido();
  renderPedidosHoje();
});

$('#btn-copiar-codigo').addEventListener('click', async () => {
  const codigo = $('#pd-codigo').textContent;
  try { await navigator.clipboard.writeText(codigo); $('#btn-copiar-codigo').textContent = 'Copiado!'; }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents($('#pd-codigo'));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    $('#btn-copiar-codigo').textContent = 'Selecionado: Ctrl+C';
  }
  setTimeout(() => { $('#btn-copiar-codigo').textContent = 'Copiar código'; }, 2500);
});

// ---------- Recepção: carregar pelo código ----------
function avisoPedido(texto, tipo = '') {
  const el = $('#ex-pedido-info');
  el.textContent = texto;
  el.className = `dica${tipo ? ' ' + tipo : ''}`;
}

function renderPendentes() {
  const hoje = new Date().toDateString();
  const pend = lerPedidos().filter((p) => p.status !== 'PAGO' && new Date(p.criadoEm).toDateString() === hoje);
  $('#ex-pendentes').innerHTML = pend.length
    ? 'Pendentes hoje: ' + pend.map((p) => `<button type="button" class="btn-acao" data-carregar-pedido="${esc(p.codigo)}">${esc(p.codigo)} · ${esc(p.paciente?.nome)}</button>`).join('')
    : '';
}

async function carregarPedidoNaRecepcao(codigoDigitado) {
  const codigo = normalizarCodigoPedido(codigoDigitado);
  if (!codigo) { avisoPedido('Digite o código do pedido.', 'erro'); return; }
  const pedido = await buscarPedidoMedico(codigo);
  if (!pedido) { avisoPedido(`Pedido ${codigo} não encontrado. Confira o código com o paciente.`, 'erro'); return; }
  if (pedido.status === 'PAGO') {
    avisoPedido(`O pedido ${codigo} já foi pago em ${new Date(pedido.pagoEm).toLocaleString('pt-BR')}.`, 'erro');
    return;
  }
  estado.paciente = pedido.paciente;
  estado.vinculoExames = pedido.origem || null;
  const medico = todosMedicos().find((m) => String(m.id) === String(pedido.medicoId));
  if (medico) $('#ex-medico').value = String(medico.id);
  $('#ex-obs').value = pedido.observacoes || '';
  estado.exames = {
    imagem: pedido.itens.filter((x) => x.tipo === 'imagem')
      .map((x) => ({ categoria: x.categoria, nome: x.nome, contraste: !!x.contraste, valor: valorImagem(x.nome, x.contraste) || 0 })),
    laboratorial: pedido.itens.filter((x) => x.tipo === 'laboratorial')
      .map((x) => ({ codigo: x.codigo, nome: x.nome, valor: precoLab(x.codigo)?.valor || 0 })),
  };
  estado.pedidoCarregado = codigo;
  $('#ex-codigo-pedido').value = codigo;
  renderPacienteExames();
  renderVinculoExames();
  renderExames();
  avisoPedido(`Pedido ${codigo} carregado: ${pedido.itens.length} exame${pedido.itens.length === 1 ? '' : 's'} de ${pedido.medicoNome}. Confira e clique em Pagar.`, 'ok');
}

$('#form-codigo-pedido').addEventListener('submit', (e) => { e.preventDefault(); carregarPedidoNaRecepcao($('#ex-codigo-pedido').value); });
$('#ex-pendentes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-carregar-pedido]');
  if (b) carregarPedidoNaRecepcao(b.dataset.carregarPedido);
});

function renderPacienteExames() {
  const p = estado.paciente;
  $('#ex-paciente').innerHTML = p
    ? `<div class="paciente-selecionado${ehParticular(p) ? ' particular' : ''}${classeRisco(estado.vinculoExames?.risco)}">${cartaoPaciente(p, estado.vinculoExames?.risco)}</div>`
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
// ---------- Tomografia com contraste ----------
const SUFIXO_CONTRASTE = ' com contraste';
const adicionalContraste = () => Number(precos.adicionais?.contrasteTomografia || 0);

function atualizarCampoContraste() {
  const tc = $('#ex-categoria').value === 'Tomografia';
  $('#campo-contraste').hidden = !tc;
  if (!tc) $('#ex-contraste').checked = false;
  $('#ex-contraste-valor').textContent = `(+ ${formatarMoeda(adicionalContraste())})`;
}

// Valor do exame de imagem pela tabela, somando o contraste quando marcado
function valorImagem(nome, contraste) {
  const base = precoImagem(String(nome).replace(new RegExp(SUFIXO_CONTRASTE + '$', 'i'), ''));
  if (!base) return null;
  return base.valor + (contraste ? adicionalContraste() : 0);
}

function recalcularValorImagem() {
  const v = valorImagem($('#ex-nome').value, $('#ex-contraste').checked);
  if (v != null) $('#ex-valor').value = valorCampo(v);
}

$('#ex-contraste').addEventListener('change', recalcularValorImagem);

$('#ex-categoria').addEventListener('change', () => { atualizarSugestoesExames(); atualizarCampoContraste(); $('#ex-nome').focus(); });

// Ao escolher o exame, puxa o valor da tabela de preços
$('#ex-nome').addEventListener('input', (e) => {
  e.target.setCustomValidity('');
  const p = precoImagem(e.target.value.replace(new RegExp(SUFIXO_CONTRASTE + '$', 'i'), ''));
  if (p) {
    if ($('#ex-categoria').value !== p.categoria) { $('#ex-categoria').value = p.categoria; atualizarCampoContraste(); }
    recalcularValorImagem();
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
    let nome = campo.value.trim();
    if (!nome) { campo.setCustomValidity('Digite o nome do exame.'); campo.reportValidity(); return; }
    const contraste = $('#ex-contraste').checked && $('#ex-categoria').value === 'Tomografia';
    if (contraste && !nome.toLowerCase().endsWith(SUFIXO_CONTRASTE)) nome += SUFIXO_CONTRASTE;
    const valor = lerMoeda($('#ex-valor').value) || valorImagem(nome, contraste) || 0;
    estado.exames.imagem.push({ categoria: $('#ex-categoria').value, nome, valor, contraste });
    campo.value = '';
    $('#ex-valor').value = '';
    $('#ex-contraste').checked = false;
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
  estado.pedidoCarregado = null;
  $('#ex-codigo-pedido').value = '';
  avisoPedido('Digite o código que o médico gerou: todos os exames (imagem e laboratório) entram com os preços da tabela.');
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
      cpf: estado.paciente.cpf,
      atendimento: estado.vinculoExames?.numero || '',
      medico: ($('#ex-medico').value && $('#ex-medico').selectedOptions[0].text) || estado.vinculoExames?.medico || '',
    },
  });
  if (!pagamento) {
    $('#status-exames').textContent = 'Pagamento cancelado. A requisição não foi salva.';
    return;
  }
  requisicao.pagamento = pagamento;
  requisicao.pedido = estado.pedidoCarregado; // código do pedido do médico (ou null)
  await salvarRequisicaoExames(requisicao);
  if (estado.pedidoCarregado) {
    await marcarPedidoPago(estado.pedidoCarregado, pagamento);
    avisoPedido(`Pedido ${estado.pedidoCarregado} pago.`, 'ok');
    estado.pedidoCarregado = null;
    $('#ex-codigo-pedido').value = '';
    renderPendentes();
  }
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
  const atual = $('#filtro-medico').value;
  preencherSelect('#filtro-medico', todosMedicos().map((m) => ({ valor: m.id, texto: m.nome })), 'Todos');
  $('#filtro-medico').value = atual;
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
  const atual = $('#cons-especialidade').value;
  const especialidades = [...new Set(DADOS.medicosConsulta.map((m) => m.especialidade))];
  preencherSelect('#cons-especialidade', especialidades.map((e) => ({ valor: e, texto: e })));
  $('#cons-especialidade').value = atual;
}

$('#cons-especialidade').addEventListener('change', (e) => {
  preencherSelect('#cons-medico', DADOS.medicosConsulta
    .filter((m) => m.especialidade === e.target.value)
    .map((m) => ({ valor: m.id, texto: m.nome })));
  preencherSelect('#cons-horario', []);
  $('#pag-valor').value = '';
});

$('#cons-medico').addEventListener('change', (e) => {
  // TODO: quando tiver agenda de verdade, mostrar só os horários livres
  const m = DADOS.medicosConsulta.find((x) => String(x.id) === e.target.value);
  preencherSelect('#cons-horario', m ? DADOS.horarios.map((h) => ({ valor: h, texto: h })) : []);
  $('#pag-valor').value = m ? valorCampo(m.valorConsulta) : '';
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
    contexto: { tipo: 'CONSULTA', paciente: dados.nome, cpf: dados.cpf, medico },
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
  renderMedicos(DADOS.medicosConsulta);
  renderPlantonistas();
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
  if (!botao || botao.dataset.examesAtend || botao.dataset.concluirAtend || botao.dataset.reciboAtend || botao.dataset.reciboFin || botao.dataset.triagem) return;
  // TODO: abrir detalhes do registro botao.dataset.id
  console.log('Ação no registro', botao.dataset.id);
});

// ---------- Início ----------
(async () => {
  const lista = lerPonto();
  if (!lista.some((r) => r.foto)) return;
  try {
    for (const r of lista.filter((x) => x.foto)) { await guardarFoto(r.id, r.foto); r.temFoto = true; delete r.foto; }
    salvarPonto(lista);
  } catch (e) { /* sem IndexedDB: fotos continuam no registro */ }
})();
montarOpcoesRisco();
renderEtapas();
carregarUsuario();
carregarSetores();
carregarMedicosConsulta();
abrirTela(location.hash.slice(1) || 'atendimento');
