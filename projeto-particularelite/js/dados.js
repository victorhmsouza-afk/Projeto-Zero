/* =========================================================
   Particular Elite · dados.js
   Tudo o que é salvo ou lido passa por aqui.
   Hoje os dados ficam no navegador (localStorage).
   Para ligar ao banco/API do hospital, troque SÓ as funções
   do objeto Banco: o resto do sistema não muda.
   ========================================================= */

// ---------- Configuração (edite aqui) ----------
const CONFIG = {
  hospital: {
    nome: 'Hospital da Saúde',
    cnpj: '00.000.000/0000-00',
    endereco: 'Endereço da unidade',
    telefone: '(00) 0000-0000',
  },
  // Médicos (lista fixa, sem tela de cadastro). Valor = consulta eletiva.
  medicos: [
    { id: 1, nome: 'Dra. Fernanda Costa', especialidade: 'Cardiologia', valorConsulta: 350 },
    { id: 2, nome: 'Dr. Ricardo Mendes', especialidade: 'Ortopedia', valorConsulta: 300 },
    { id: 3, nome: 'Dra. Juliana Rocha', especialidade: 'Ginecologia', valorConsulta: 320 },
    { id: 4, nome: 'Dr. Paulo Nogueira', especialidade: 'Clínica geral', valorConsulta: 200 },
    { id: 5, nome: 'Dr. Rafael Monteiro', especialidade: 'Emergência', valorConsulta: 250 },
    { id: 6, nome: 'Dra. Camila Andrade', especialidade: 'Pediatria', valorConsulta: 250 },
  ],
};

const TIPOS = {
  CONSULTA: { nome: 'Consulta', descricao: 'Consulta eletiva' },
  PRONTO_SOCORRO: { nome: 'Pronto Socorro', descricao: 'Consulta de emergência' },
};

// ---------- Tabela de preços padrão (pode ser alterada na tela Preços) ----------
// Valores de laboratório são EXEMPLOS: troque pela tabela do hospital.
const PRECOS_PADRAO = {
  prontoSocorro: 250,           // consulta de emergência
  adicionalContraste: 250,      // somado à tomografia com contraste
  exames: [
    { categoria: 'Raio-X', nome: 'Raio-X', valor: 90 },
    ...['crânio', 'face', 'seios da face', 'órbitas', 'ouvidos (mastoides)', 'pescoço', 'tórax', 'abdome superior',
      'abdome total', 'pelve', 'coluna cervical', 'coluna torácica', 'coluna lombar', 'ombro', 'braço', 'cotovelo',
      'antebraço', 'punho', 'mão', 'quadril', 'coxa', 'joelho', 'perna', 'tornozelo', 'pé']
      .map((r) => ({ categoria: 'Tomografia', nome: `Tomografia de ${r}`, valor: 750 })),
    { categoria: 'Ultrassonografia', nome: 'USG de abdome total', valor: 180 },
    { categoria: 'Ultrassonografia', nome: 'USG pélvica', valor: 140 },
    { categoria: 'Ultrassonografia', nome: 'USG de tireoide', valor: 140 },
    { categoria: 'Ultrassonografia', nome: 'USG de rins e vias urinárias', valor: 150 },
    { categoria: 'Ultrassonografia', nome: 'USG obstétrica', valor: 160 },
    { categoria: 'Ressonância', nome: 'Ressonância de crânio', valor: 800 },
    { categoria: 'Ressonância', nome: 'Ressonância de coluna lombar', valor: 850 },
    { categoria: 'Ressonância', nome: 'Ressonância de joelho', valor: 750 },
    { categoria: 'Cardiologia', nome: 'Eletrocardiograma (ECG)', valor: 60 },
    { categoria: 'Cardiologia', nome: 'Ecocardiograma', valor: 250 },
    { categoria: 'Endoscopia', nome: 'Endoscopia digestiva alta', valor: 350 },
    { categoria: 'Endoscopia', nome: 'Colonoscopia', valor: 700 },
    { categoria: 'Mamografia', nome: 'Mamografia bilateral', valor: 150 },
    ...[
      ['Hemograma completo', 25], ['Glicose', 10], ['Ureia', 12], ['Creatinina', 12], ['Sódio', 12], ['Potássio', 12],
      ['TGO (AST)', 15], ['TGP (ALT)', 15], ['Colesterol total', 15], ['Triglicerídeos', 15], ['Hemoglobina glicada', 35],
      ['TSH', 40], ['T4 livre', 40], ['PCR (proteína C reativa)', 30], ['VHS', 15], ['Urina tipo I', 20], ['Urocultura', 40],
      ['Beta-HCG', 45], ['Coagulograma', 40], ['Troponina', 80], ['CK-MB', 50], ['Amilase', 25], ['Lipase', 30],
      ['Gasometria arterial', 60], ['Dengue NS1', 80], ['Tipagem sanguínea', 25],
    ].map(([nome, valor]) => ({ categoria: 'Laboratório', nome, valor })),
  ],
};

// ---------- Acesso aos dados ----------
// Cada função é assíncrona (async) para que a troca por chamadas à API (fetch) seja direta.
const Banco = (() => {
  const CHAVES = {
    pacientes: 'ap.pacientes',
    atendimentos: 'ap.atendimentos',
    pagamentos: 'ap.pagamentos',
    precos: 'ap.precos',
    contadores: 'ap.contadores',
  };

  const ler = (chave, padrao) => {
    try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch (e) { return padrao; }
  };
  const gravar = (chave, valor) => {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  };
  const copia = (v) => JSON.parse(JSON.stringify(v));

  function proximo(nome, inicio) {
    const c = ler(CHAVES.contadores, {});
    c[nome] = (c[nome] || inicio) + 1;
    gravar(CHAVES.contadores, c);
    return c[nome];
  }

  return {
    // ----- Pacientes -----
    async buscarPacientes(texto) {
      const t = String(texto || '').trim().toLowerCase();
      const digitos = t.replace(/\D/g, '');
      const lista = ler(CHAVES.pacientes, []);
      if (!t) return lista.slice(-20).reverse();
      return lista.filter((p) => p.nome.toLowerCase().includes(t) || (digitos && String(p.cpf || '').replace(/\D/g, '').includes(digitos)));
    },
    async salvarPaciente(paciente) {
      const lista = ler(CHAVES.pacientes, []);
      if (paciente.id) {
        const i = lista.findIndex((p) => p.id === paciente.id);
        if (i >= 0) lista[i] = paciente; else lista.push(paciente);
      } else {
        paciente = { ...paciente, id: `P${proximo('paciente', 1000)}` };
        lista.push(paciente);
      }
      gravar(CHAVES.pacientes, lista);
      return paciente;
    },

    // ----- Atendimentos -----
    // inicio/fim: 'AAAA-MM-DD' (comparado com a data de abertura)
    async listarAtendimentos({ inicio, fim } = {}) {
      return ler(CHAVES.atendimentos, []).filter((a) => {
        const d = a.abertoEm.slice(0, 10);
        return (!inicio || d >= inicio) && (!fim || d <= fim);
      });
    },
    async obterAtendimento(id) {
      return ler(CHAVES.atendimentos, []).find((a) => a.id === id) || null;
    },
    async salvarAtendimento(atendimento) {
      const lista = ler(CHAVES.atendimentos, []);
      if (!atendimento.id) {
        atendimento = { ...atendimento, id: `A${Date.now()}${Math.floor(Math.random() * 1000)}`, numero: proximo('atendimento', 10000) };
        lista.push(atendimento);
      } else {
        const i = lista.findIndex((a) => a.id === atendimento.id);
        if (i >= 0) lista[i] = atendimento; else lista.push(atendimento);
      }
      if (!gravar(CHAVES.atendimentos, lista)) throw new Error('Não foi possível salvar.');
      return copia(atendimento);
    },

    // ----- Pagamentos (não existe cancelamento nem estorno) -----
    async registrarPagamento(pagamento) {
      const lista = ler(CHAVES.pagamentos, []);
      const salvo = { ...pagamento, id: `G${Date.now()}${Math.floor(Math.random() * 1000)}`, numeroRecibo: `${new Date().getFullYear()}-${String(proximo('recibo', 0)).padStart(5, '0')}` };
      lista.push(salvo);
      if (!gravar(CHAVES.pagamentos, lista)) throw new Error('Não foi possível salvar o pagamento.');
      return salvo;
    },
    async listarPagamentos({ inicio, fim, atendimentoId } = {}) {
      return ler(CHAVES.pagamentos, []).filter((p) => {
        const d = p.dataHora.slice(0, 10);
        return (!inicio || d >= inicio) && (!fim || d <= fim) && (!atendimentoId || p.atendimentoId === atendimentoId);
      });
    },

    // ----- Preços -----
    async lerPrecos() {
      const salvo = ler(CHAVES.precos, null);
      if (!salvo) return copia(PRECOS_PADRAO);
      // acrescenta exames novos da tabela padrão que ainda não existem na tabela salva
      const nomes = new Set(salvo.exames.map((e) => e.nome.toLowerCase()));
      PRECOS_PADRAO.exames.forEach((e) => { if (!nomes.has(e.nome.toLowerCase())) salvo.exames.push({ ...e }); });
      return { ...copia(PRECOS_PADRAO), ...salvo };
    },
    async salvarPrecos(precos) { gravar(CHAVES.precos, precos); },
    async restaurarPrecos() { localStorage.removeItem(CHAVES.precos); return copia(PRECOS_PADRAO); },

    // ----- Dados de exemplo (só para testar as estatísticas) -----
    async gravarExemplos(atendimentos, pagamentos) {
      gravar(CHAVES.atendimentos, [...ler(CHAVES.atendimentos, []), ...atendimentos]);
      gravar(CHAVES.pagamentos, [...ler(CHAVES.pagamentos, []), ...pagamentos]);
    },
    async removerExemplos() {
      gravar(CHAVES.atendimentos, ler(CHAVES.atendimentos, []).filter((a) => !a.exemplo));
      gravar(CHAVES.pagamentos, ler(CHAVES.pagamentos, []).filter((p) => !p.exemplo));
    },
    async temExemplos() { return ler(CHAVES.atendimentos, []).some((a) => a.exemplo); },
  };
})();
