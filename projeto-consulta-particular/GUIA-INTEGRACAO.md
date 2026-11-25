# Guia de integração · Consulta Particular

> **Rascunho.** Este guia acompanha o projeto e será atualizado conforme o sistema mudar.
> Última revisão: 25/11/2026 (inclui retorno da consulta eletiva). Pendências em aberto estão no fim do documento.

Este guia é para a equipe de TI que vai ligar o **Consulta Particular** (front-end, nesta pasta) ao sistema do hospital.
Ele lista cada ponto de integração, os dados que vão e voltam e uma sugestão de rota na API.

---

## 1. Como o projeto está montado

- **Só front-end**: `index.html` + `css/style.css` + `js/app.js`, sem dependências. `demonstracao.html` é a mesma tela com dados fictícios.
- **Toda a lógica de tela já funciona.** O que falta é **trocar o conteúdo de algumas funções** do `js/app.js`
  (marcadas com `TODO`) por chamadas à API. Nenhuma outra parte da tela precisa mudar.
- Hoje, onde não há API, os dados ficam **no navegador** (`localStorage` / `IndexedDB`). Isso vale para: tabela de preços,
  plantonistas, ponto do plantão, valores dos plantões e pacientes retirados da fila. Na integração, isso passa para o banco.
- Configuração no topo do `js/app.js`:
  - `CONFIG.apiUrl` — endereço da API.
  - `CONFIG.empresa` — dados do hospital no recibo (nome, CNPJ, endereço, telefone).
  - `DADOS` — unidade, setores, médicos da consulta, plantonistas iniciais, horários.

### Sugestão de encaixe na API do hospital (`atendimento-hub`)

A API existente usa Express + Oracle, módulos em `server/modules/<nome>/` (dto, service, controller, router)
e autenticação JWT (`requireAuth`, header `Authorization: Bearer <token>`; unidade em `x-hub-id-unidade`).
Sugestão: criar um módulo **`server/modules/particular/`** montado em **`/api/particular`**, protegido por `requireAuth`,
e usar o mesmo token no front (`fetch(CONFIG.apiUrl + rota, { headers: { Authorization: 'Bearer ' + token } })`).

> As rotas e tabelas abaixo são **sugestões** para começar a conversa, não um contrato fechado.

---

## 2. Pontos de integração

Formato: **função no `js/app.js`** → quando é chamada → o que recebe/devolve → rota sugerida.

### 2.1 Usuário e unidade

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `carregarUsuario()` | Ao abrir o sistema | Preencher nome e iniciais do usuário | `GET /api/particular/me` |
| `carregarAtendimento()` | Ao abrir a tela Atendimento | Nome da unidade em `#atend-unidade` | `GET /api/particular/unidade` |

### 2.2 Pacientes

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| busca no `#form-busca-atend` → `renderResultadosBusca(lista)` | Recepção busca por nome/CPF | lista: `[{ id, nome, cpf, nascimento: 'AAAA-MM-DD', convenio }]` | `GET /api/particular/pacientes?busca=` |
| `cadastrarPaciente(paciente)` | Cadastro rápido (só o nome é obrigatório) | recebe `{ nome, cpf, nascimento, telefone, convenio: '' }`; **deve devolver o paciente com `id`** | `POST /api/particular/pacientes` |
| `#pac-cpf` (blur) | Agendar consulta: completa dados pelo CPF | paciente encontrado | `GET /api/particular/pacientes?cpf=` |
| `#form-busca-paciente` → `renderPacientes(lista)` | Tela Pacientes | `[{ id, nome, cpf, telefone, ultimaConsulta, convenio }]` | mesma rota de busca |

**Regra:** `convenio` vazio = **particular** (selo ✱). Se os pacientes já existem no Tasy, a busca pode ler de lá e só
os dados do particular ficam em tabela própria.

### 2.3 Atendimento (Consulta e Pronto Socorro)

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `carregarSetores()` → `preencherSetores(lista)` | Troca de aba | `[{ id, nome, valorConsulta? }]` (no PS, `valorConsulta` = consulta de emergência) | `GET /api/particular/setores?modalidade=` |
| `carregarMedicosConsulta()` → `preencherMedicosConsulta(lista)` | Troca de aba | Consulta: `[{ id, nome, especialidade, valorConsulta }]`; PS: plantonistas **com ponto de entrada aberto** | `GET /api/particular/medicos?modalidade=` |
| `carregarAtendimentosAnteriores()` → `renderAnteriores(lista)` | Ao escolher paciente / trocar aba | `[{ numero, tipo: 'CONSULTA'\|'PRONTO_SOCORRO', senha, status, entrada, alta, medico, valor, pago, pagamento, exames, risco, riscoOrigem, triagemEnfermagem, historicoRisco }]` | `GET /api/particular/atendimentos?pacienteId=&modalidade=` |
| `registrarAtendimento(dados)` | Depois do **pagamento confirmado** (ou no **retorno** da consulta eletiva) | `{ paciente, setor, modalidade, medico, valor, pagamento, risco?, riscoOrigem?, historicoRisco?, retorno?, consultaOrigem? }` → gravar com status `AGUARDANDO` (Liberado para consulta). No retorno: `retorno: true`, `valor: 0`, `pagamento: null` | `POST /api/particular/atendimentos` |
| `registrarTriagem(atendimento, triagem)` | Enfermagem faz a triagem (PS) | `triagem = { risco, observacoes, por: 'ENFERMAGEM', dataHora }` → atendimento fica `risco`, `riscoOrigem: 'ENFERMAGEM'`, `triagemEnfermagem: true`, `status: 'TRIADO'` e mais um item em `historicoRisco` | `POST /api/particular/atendimentos/:numero/triagem` |
| `registrarConclusaoConsulta(atendimento)` | Botão Concluir consulta | status `ATENDIDA` | `POST /api/particular/atendimentos/:numero/concluir` |
| `carregarFila()` → `renderFila(lista)` | Tela Fila da emergência (atualiza a cada minuto) | atendimentos de PS do dia sem consulta concluída: `[{ numero, paciente, particular, risco, entrada, status, medico, pago, triagemEnfermagem, riscoOrigem, historicoRisco }]` | `GET /api/particular/fila` |

**Status do atendimento:** `AGUARDANDO` (liberado para consulta) → `TRIADO` (só PS) → `ATENDIDA`.
**Risco:** `VERMELHO` · `LARANJA` · `AMARELO` · `VERDE` (não existe azul).

### 2.4 Pagamentos e recibo

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `registrarPagamento(pagamento)` | **Todo** pagamento confirmado (consulta, PS, exames, agendamento) | `{ forma: 'PIX'\|'CREDITO'\|'DEBITO'\|'DINHEIRO', valor, dataHora, parcelas?, autorizacao?, idTransacao?, recebido?, troco?, descricao, itens: [{ nome, valor }], desconto, contexto: { tipo: 'CONSULTA'\|'EXAMES', paciente, cpf, medico, atendimento? } }`; **pode devolver `{ numeroRecibo }`** | `POST /api/particular/pagamentos` |
| impressão do recibo | Botão Imprimir recibo | hoje `window.print()` | trocar se usar impressora térmica |

**Regras:** não existe cancelamento nem estorno. O número do recibo deve vir do sistema (hoje é provisório).

### 2.5 Exames

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `salvarRequisicaoExames(requisicao)` | Depois do **pagamento** dos exames | `{ paciente, origem: null \| { modalidade, numero, entrada, medico, risco }, medico, data, observacoes, imagem: [{ categoria, nome, valor, contraste }], laboratorial: [{ numero, codigo, nome, valor }], subtotalImagem, subtotalLaboratorial, desconto, total, pagamento }` | `POST /api/particular/requisicoes-exames` |
| `carregarTabelaPrecos()` / `salvarTabelaPrecos()` | Tela Tabela de preços | `{ adicionais: { contrasteTomografia }, imagem: [{ categoria, nome, valor }], laboratorial: [{ codigo, nome, valor }] }` | `GET/PUT /api/particular/tabela-precos` |

Tomografia com contraste = valor da tomografia + `adicionais.contrasteTomografia` (hoje R$ 250,00).

### 2.5.1 Pedido do médico (código)

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `salvarPedidoMedico(pedido)` | Médico clica em Gerar pedido | `{ codigo: 'PED-XXXXXX', criadoEm, paciente: { id, nome, cpf, nascimento, convenio }, origem, medicoId, medicoNome, observacoes, itens: [{ tipo: 'imagem', categoria, nome, contraste? } \| { tipo: 'laboratorial', codigo, nome }], status: 'PENDENTE' }` | `POST /api/particular/pedidos` |
| `buscarPedidoMedico(codigo)` | Recepção digita o código | devolve o pedido ou `null` | `GET /api/particular/pedidos/:codigo` |
| `marcarPedidoPago(codigo, pagamento)` | Depois do pagamento dos exames | status `PAGO`, `pagoEm` | `POST /api/particular/pedidos/:codigo/pago` |
| `lerPedidos()` | Pedidos de hoje / pendentes | lista de pedidos | `GET /api/particular/pedidos?data=&status=` |

**Regras:** o médico não define preço (vem da tabela na recepção); um pedido **pago** não pode ser cobrado de novo;
o código não usa caracteres que confundem (0/O, 1/I). Sugestão de tabelas: `PARTICULAR_PEDIDO` e `PARTICULAR_PEDIDO_ITEM`.

### 2.6 Agenda e agendamento

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `agendarConsulta(dados)` | Depois do **pagamento** do agendamento | `{ cpf, nome, nascimento, telefone, email, especialidade, medico, data, horario, valor, observacoes, pagamento }` | `POST /api/particular/agendamentos` |
| `#cons-medico` / `#cons-data` (change) | Escolha de médico e data | horários livres (hoje fixos em `DADOS.horarios`) | `GET /api/particular/agenda/horarios?medicoId=&data=` |
| filtro da Agenda → `renderAgenda(lista)` | Tela Agenda | `[{ id, data, horario, paciente, medico, valor, status }]` | `GET /api/particular/agendamentos?data=&medicoId=&status=` |
| `carregarPainel()` → `renderProximos(lista)` | Tela Painel | consultas do dia + números do resumo | `GET /api/particular/painel` |

### 2.7 Financeiro

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `carregarFinanceiro()` / filtro → `renderFinanceiro(lista)` | Tela Financeiro | `[{ data, paciente, tipo: 'CONSULTA'\|'EXAMES', medico, formaPagamento, valor, pagamento }]` (totais e "Recebido por médico" são calculados na tela) | `GET /api/particular/recebimentos?inicio=&fim=` |

### 2.8 Médicos plantonistas e ponto do plantão

| Função | Quando | Dados | Rota sugerida |
|---|---|---|---|
| `carregarPlantonistas()` / `salvarPlantonistas()` | Tela Médicos | `[{ id, nome, crm, especialidade: 'Emergencista'\|'Clínico geral'\|'Ortopedista'\|'Pediatra' }]` | `GET/POST/DELETE /api/particular/plantonistas` |
| `lerPonto()` / `salvarPonto()` | Tela Ponto do plantão | registros `{ id, medicoId, medicoNome, especialidade, crm, tipo: 'ENTRADA'\|'SAIDA', horas: 6\|12, entradaId, dataHora, temFoto }` | `GET /api/particular/ponto?mes=` |
| `registrarPonto(registro, foto)` | Entrada ou saída com foto | registro acima + foto JPEG (~320 px, data URL) | `POST /api/particular/ponto` (foto em BLOB) |
| valores dos plantões (`lerValoresPlantao`) | Fechamento do mês | `{ 6: valor, 12: valor }` | `GET/PUT /api/particular/plantoes/valores` |

**Regras:** médico está "no plantão" se o último registro (últimas 24 h) é uma ENTRADA. Registros de ponto **não podem
ser apagados nem editados**; guardar fotos e horários por **13 meses** para auditoria. O pagamento do mês usa o
plantão **contratado** (6 h ou 12 h) e mostra pendências (sem saída, saída mais de 15 min antes, em andamento).

---

## 3. Sugestão de tabelas (Oracle)

Prefixo sugerido `PARTICULAR_` (ajustar ao padrão do banco):

| Tabela | Conteúdo |
|---|---|
| `PARTICULAR_ATENDIMENTO` | número, paciente, modalidade, setor, médico, status, entrada, alta, valor, risco atual, origem do risco, triagem feita |
| `PARTICULAR_RISCO_HIST` | histórico de classificação: atendimento, risco, por (RECEPCAO/ENFERMAGEM), data/hora, observações |
| `PARTICULAR_PAGAMENTO` | forma, valor, parcelas, NSU/ID Pix, recebido, troco, data/hora, número do recibo, tipo, paciente, médico, atendimento |
| `PARTICULAR_PAGAMENTO_ITEM` | itens pagos (descrição, valor) e desconto |
| `PARTICULAR_REQ_EXAME` / `_ITEM` | requisição de exames e seus itens (imagem/laboratorial, contraste, valor) |
| `PARTICULAR_TABELA_PRECO` | categoria, nome/código, valor; adicional de contraste |
| `PARTICULAR_AGENDAMENTO` | consulta agendada e paga |
| `PARTICULAR_PLANTONISTA` | médico, CRM, especialidade |
| `PARTICULAR_PONTO` | registros de ponto + foto (BLOB), sem UPDATE/DELETE pela aplicação |
| `PARTICULAR_PLANTAO_VALOR` | valor do plantão de 6 h e de 12 h (com vigência) |

---

## 4. Regras de negócio que a API também deve garantir

1. **Pagamento antes:** consulta, consulta de emergência, exames e agendamento só são gravados com pagamento confirmado.
   Exceção: **retorno da consulta eletiva** (mesmo médico, até 30 dias, um por consulta) é sem cobrança.
   **Pronto Socorro não tem retorno.**
2. **Pronto Socorro:** pré-classificação de risco (recepção) obrigatória antes do pagamento; consulta só pode ser
   concluída depois da **triagem de enfermagem**; "Pedir exames" só depois da consulta concluída.
3. **Particular:** paciente sem convênio, paga por serviço (selo ✱).
4. **Sem cancelamento ou estorno** de pagamentos.
5. **Ponto:** imutável, com foto, guardado 13 meses; plantão de 6 h ou 12 h.

---

## 5. Exemplo de chamada (curl)

Com a API rodando em `http://localhost:3000` e um token válido:

```bash
curl -X POST "http://localhost:3000/api/particular/atendimentos" \
  -H "Authorization: Bearer <token>" \
  -H "x-hub-id-unidade: <id-da-unidade>" \
  -H "Content-Type: application/json" \
  -d '{"pacienteId": 123, "modalidade": "PRONTO_SOCORRO", "setorId": 10, "medicoId": 101, "risco": "VERDE", "valor": 250, "pagamento": {"forma": "PIX", "valor": 250}}'
```

```bash
curl -X GET "http://localhost:3000/api/particular/fila" \
  -H "Authorization: Bearer <token>" \
  -H "x-hub-id-unidade: <id-da-unidade>"
```

---

## 6. Pontos em aberto (antes de implantar)

- [ ] **Exames de laboratório:** trocar códigos `LAB-xxx` e valores de exemplo pela tabela do laboratório.
- [x] **Retorno de consulta**: só na eletiva, sem cobrança, mesmo médico, até 30 dias (confirmar o prazo). Emergência não tem retorno.
- [ ] **Médicos e valores reais** da consulta particular (hoje fictícios).
- [ ] **Jurídico:** cobrança antes do atendimento de **vermelho/laranja** (art. 135-A do Código Penal).
- [ ] **LGPD:** prazo de guarda das fotos do ponto e quem pode ver a auditoria.
- [ ] **Pagamento do plantão incompleto:** pagar o contratado (atual) ou proporcional às horas?
- [ ] **Número do recibo** e **impressão** (impressora comum ou térmica).
- [ ] Origem dos **pacientes** (Tasy ou cadastro próprio).
