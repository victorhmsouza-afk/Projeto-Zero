'use strict';
const STORAGE_KEY = 'health-atendentes-v1';
const ACESSOS = ['Atendimento', 'Triagem', 'Compra de materiais'];
const FUNCOES = ['Atendente de recepção', 'Atendente de triagem', 'Assistente de compras', 'Atendente multifuncional', 'Supervisor de atendimento'];
const NOMES = {
  A: ['Ana Almeida', 'André Alves', 'Amanda Azevedo', 'Arthur Amaral', 'Alice Andrade'],
  B: ['Beatriz Barros', 'Bruno Batista', 'Bianca Borges', 'Bernardo Braga', 'Bárbara Brito'],
  C: ['Camila Castro', 'Carlos Carvalho', 'Clara Costa', 'Caio Correia', 'Cecília Campos'],
  D: ['Daniel Dias', 'Débora Duarte', 'Diego Dantas', 'Diana Damasceno', 'Davi Domingues']
};
const iniciais = Object.entries(NOMES).flatMap(([grupo, nomes]) => nomes.map((nome, i) => ({ nome, grupo, funcao: FUNCOES[i], acessos: [...ACESSOS] })));
const form = document.querySelector('#cadastro');
const status = document.querySelector('#status');
let atendentes = iniciais;
try {
  const salvo = localStorage.getItem(STORAGE_KEY);
  if (salvo !== null) {
    const dados = JSON.parse(salvo);
    if (!Array.isArray(dados) || !dados.every(p => p && typeof p.nome === 'string' && p.nome.trim() && Object.hasOwn(NOMES, p.grupo) && FUNCOES.includes(p.funcao) && Array.isArray(p.acessos) && p.acessos.length > 0 && p.acessos.every(a => ACESSOS.includes(a)))) throw new Error('Dados inválidos');
    atendentes = dados;
  }
} catch {
  status.textContent = 'Não foi possível carregar os dados locais. Exibindo os exemplos iniciais.';
}
const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function elemento(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}
function renderizar() {
  const busca = normalizar(document.querySelector('#busca').value.trim());
  const grupo = document.querySelector('#filtro').value;
  const lista = atendentes.filter(p => (!grupo || p.grupo === grupo) && normalizar(`${p.nome} ${p.funcao}`).includes(busca));
  const corpo = document.querySelector('#equipe');
  corpo.replaceChildren();
  lista.forEach(p => {
    const linha = elemento('tr');
    const pessoa = elemento('td');
    const bloco = elemento('div', 'person');
    const avatar = elemento('span', 'avatar', p.nome.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join(''));
    avatar.setAttribute('aria-hidden', 'true');
    const texto = elemento('div');
    texto.append(elemento('strong', '', p.nome), elemento('small', '', p.funcao));
    bloco.append(avatar, texto);
    pessoa.append(bloco);
    const colunaGrupo = elemento('td');
    colunaGrupo.append(elemento('span', 'group', p.grupo));
    const colunaAcessos = elemento('td');
    const acessos = elemento('div', 'accesses');
    p.acessos.forEach(a => acessos.append(elemento('span', '', a)));
    colunaAcessos.append(acessos);
    linha.append(pessoa, colunaGrupo, colunaAcessos);
    corpo.append(linha);
  });
  document.querySelector('#total').textContent = atendentes.length;
  document.querySelector('#result-count').textContent = `${lista.length} ${lista.length === 1 ? 'pessoa' : 'pessoas'}`;
  document.querySelector('#empty').hidden = lista.length !== 0;
}
document.querySelector('#busca').addEventListener('input', renderizar);
document.querySelector('#filtro').addEventListener('change', renderizar);
form.addEventListener('submit', event => {
  event.preventDefault();
  const nome = form.elements.nome.value.trim().replace(/\s+/g, ' ');
  const acessos = [...form.querySelectorAll('[name="acesso"]:checked')].map(input => input.value);
  if (!nome) {
    status.textContent = 'Informe um nome válido.';
    form.elements.nome.focus();
    return;
  }
  if (!acessos.length) {
    status.textContent = 'Selecione pelo menos uma área de acesso.';
    form.querySelector('[name="acesso"]').focus();
    return;
  }
  const novo = { nome, grupo: form.elements.grupo.value, funcao: form.elements.funcao.value, acessos };
  if (atendentes.some(p => normalizar(p.nome) === normalizar(nome) && p.grupo === novo.grupo)) {
    status.textContent = 'Esse nome já está cadastrado neste grupo.';
    return;
  }
  const atualizados = [...atendentes, novo];
  let persistiu = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizados)); } catch { persistiu = false; }
  atendentes = atualizados;
  form.reset();
  document.querySelector('#busca').value = '';
  document.querySelector('#filtro').value = novo.grupo;
  renderizar();
  status.textContent = persistiu ? `${nome} cadastrado no grupo ${novo.grupo}. Dados salvos neste navegador.` : `${nome} adicionado à sessão. O navegador bloqueou o armazenamento; o cadastro será perdido ao recarregar.`;
});
renderizar();
