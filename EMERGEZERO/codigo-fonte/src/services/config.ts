// Configuração fixa do sistema. Troque pelos dados reais do hospital.
import type { ItemPreco, Medico, TabelaPrecos, TipoAtendimento, FormaPagamento } from '@/types';

export const HOSPITAL = {
  nome: 'Hospital da Saúde',
  cnpj: '00.000.000/0000-00',
  endereco: 'Endereço da unidade',
  telefone: '(00) 0000-0000',
};

/** Médicos da CONSULTA ELETIVA. O Pronto Socorro não tem médico (o plantonista muda sempre). */
export const MEDICOS: Medico[] = [
  { id: 1, nome: 'Dra. Fernanda Costa', especialidade: 'Cardiologia', valorConsulta: 350 },
  { id: 2, nome: 'Dr. Ricardo Mendes', especialidade: 'Ortopedia', valorConsulta: 300 },
  { id: 3, nome: 'Dra. Juliana Rocha', especialidade: 'Ginecologia', valorConsulta: 320 },
  { id: 4, nome: 'Dr. Paulo Nogueira', especialidade: 'Clínica geral', valorConsulta: 200 },
  { id: 6, nome: 'Dra. Camila Andrade', especialidade: 'Pediatria', valorConsulta: 250 },
];

/**
 * Diretoria que autoriza CORTESIA. As senhas são SÓ DE DEMONSTRAÇÃO:
 * no sistema do hospital a conferência deve ser feita no servidor (services/banco.ts → autorizarCortesia).
 */
export const DIRETORIA = [
  { id: 1, nome: 'Dr. Henrique Albuquerque', cargo: 'Diretor Geral', senha: '1234' },
  { id: 2, nome: 'Dra. Lúcia Fontes', cargo: 'Diretora Clínica', senha: '4321' },
  { id: 3, nome: 'Marcos Vieira', cargo: 'Diretor Administrativo', senha: '2468' },
];

/** Usuários do sistema (demonstração). ADMIN vê tudo; AGENDAMENTO não vê Contábil nem Preços. */
export const USUARIOS = [
  { login: 'admin', senha: 'admin123', nome: 'Administrador', perfil: 'ADMIN' as const },
  { login: 'agendamento', senha: 'agenda123', nome: 'Atendente do Agendamento', perfil: 'AGENDAMENTO' as const },
];

export const TIPOS: Record<TipoAtendimento, { nome: string; descricao: string }> = {
  CONSULTA: { nome: 'Consulta', descricao: 'Consulta eletiva' },
  PRONTO_SOCORRO: { nome: 'Pronto Socorro', descricao: 'Consulta de emergência' },
};

export const NOMES_FORMA: Record<FormaPagamento, string> = {
  PIX: 'Pix',
  CREDITO: 'Cartão de crédito',
  DEBITO: 'Cartão de débito',
  DINHEIRO: 'Dinheiro',
  CORTESIA: 'Cortesia (diretoria)',
};

/** "Consulta · Dra. X" ou só "Pronto Socorro". */
export function nomeServico(tipo: TipoAtendimento, medicoNome?: string) {
  if (tipo === 'PRONTO_SOCORRO' || !medicoNome) return TIPOS[tipo]?.nome || 'Consulta';
  return `${TIPOS[tipo].nome} · ${medicoNome}`;
}

const REGIOES_TOMOGRAFIA = ['crânio', 'face', 'seios da face', 'órbitas', 'ouvidos (mastoides)', 'pescoço', 'tórax', 'abdome superior',
  'abdome total', 'pelve', 'coluna cervical', 'coluna torácica', 'coluna lombar', 'ombro', 'braço', 'cotovelo',
  'antebraço', 'punho', 'mão', 'quadril', 'coxa', 'joelho', 'perna', 'tornozelo', 'pé'];

const LABORATORIO: [string, number][] = [
  ['Hemograma completo', 25], ['Glicose', 10], ['Ureia', 12], ['Creatinina', 12], ['Sódio', 12], ['Potássio', 12],
  ['TGO (AST)', 15], ['TGP (ALT)', 15], ['Colesterol total', 15], ['Triglicerídeos', 15], ['Hemoglobina glicada', 35],
  ['TSH', 40], ['T4 livre', 40], ['PCR (proteína C reativa)', 30], ['VHS', 15], ['Urina tipo I', 20], ['Urocultura', 40],
  ['Beta-HCG', 45], ['Coagulograma', 40], ['Troponina', 80], ['CK-MB', 50], ['Amilase', 25], ['Lipase', 30],
  ['Gasometria arterial', 60], ['Dengue NS1', 80], ['Tipagem sanguínea', 25],
];

/** Tabela de preços padrão (editável na tela Preços). Valores de laboratório são EXEMPLOS. */
export const PRECOS_PADRAO: TabelaPrecos = {
  prontoSocorro: 250,
  adicionalContraste: 250,
  exames: [
    { categoria: 'Raio-X', nome: 'Raio-X', valor: 90 },
    ...REGIOES_TOMOGRAFIA.map((r): ItemPreco => ({ categoria: 'Tomografia', nome: `Tomografia de ${r}`, valor: 750 })),
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
    ...LABORATORIO.map(([nome, valor]): ItemPreco => ({ categoria: 'Laboratório', nome, valor })),
  ],
};

/** Encontra o exame na tabela. Qualquer "Raio-X de ..." usa o preço do Raio-X. */
export function identificarExame(texto: string, precos: TabelaPrecos): ItemPreco | null {
  const t = texto.trim();
  const sem = t.replace(/ com contraste$/i, '');
  const item = precos.exames.find((e) => e.nome.toLowerCase() === sem.toLowerCase());
  if (item) return { ...item };
  if (/^(raio[\s-]?x|rx)\b/i.test(t)) {
    const rx = precos.exames.find((e) => e.categoria === 'Raio-X');
    return rx ? { categoria: 'Raio-X', nome: t, valor: rx.valor } : null;
  }
  return null;
}
