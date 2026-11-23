# Projeto Consulta Particular

Projeto pessoal, separado de qualquer outro sistema, para gestão de consultas particulares.
Por enquanto é **só o front-end** (HTML + CSS + JavaScript puro, sem dependências).

## Como abrir

Dê dois cliques em `index.html`.

## Estrutura

```
projeto-consulta-particular/
├── index.html     → telas: Atendimento, Exames, Tabela de preços, Painel, Agenda, Agendar consulta, Pacientes, Médicos, Financeiro, Relatórios, Administrador
├── css/style.css  → visual (layout de hub: barra superior, menu lateral recolhível, responsivo)
└── js/app.js      → navegação entre telas + funções vazias para a sua lógica
```

## Onde colocar a sua lógica

Em `js/app.js`, procure por `TODO`. Cada tela tem uma função `carregar...()` que roda quando ela é aberta,
e os formulários já têm o `submit` capturado. Para exibir dados nas tabelas, chame:

| Função | Tela |
|---|---|
| `renderResultadosBusca(lista)` | Atendimento (busca de paciente) |
| `renderAnteriores(lista)` | Atendimento (atendimentos anteriores) |
| `renderExames()` | Exames (redesenha as listas a partir de `estado.exames`) |
| `renderProximos(lista)` | Painel |
| `renderAgenda(lista)` | Agenda |
| `renderPacientes(lista)` | Pacientes |
| `renderMedicos(lista)` | Médicos |
| `renderFinanceiro(lista)` | Financeiro |
| `preencherSelect(seletor, [{ valor, texto }])` | Qualquer `<select>` |

## Tela de Exames

- **Imagem e outros:** escolha o tipo (Ultrassonografia, Tomografia…) e digite o nome do exame, um por um.
- **Laboratorial:** digite o nº laboratorial de cada exame; cada item ganha uma numeração (01, 02, 03…).
  Dá para colar vários números de uma vez separados por vírgula ou espaço, e corrigir o número direto na tabela.
- **Preços:** todo exame tem valor. Ele vem da **Tabela de preços** (pelo nome do exame ou pelo nº laboratorial)
  e pode ser alterado na própria requisição. Aparecem subtotal de imagem, subtotal laboratorial, desconto e total.
  Exame sem valor fica marcado em vermelho e não deixa salvar.
- O botão **Salvar requisição** monta o objeto com tudo e chama o `TODO` para você ligar ao seu salvamento.

## Tabela de preços

Os valores e códigos que vêm preenchidos são **exemplos**. Ajuste na tela *Tabela de preços*.
As alterações ficam salvas no navegador (`localStorage`). Quando tiver API, troque `carregarTabelaPrecos()`
e `salvarTabelaPrecos()` em `js/app.js`.

## Atendimento: abas Consulta e Pronto Socorro

- **Consulta:** consulta particular, cobrada como particular.
- **Pronto Socorro:** o paciente é atendido no PS e, se o médico pedir exames, eles são feitos como particulares.
  Na lista de atendimentos de PS, o botão **Exames** abre a requisição já vinculada àquele atendimento
  (aparece no quadro **Origem** da tela de Exames e vai no campo `origem` ao salvar).
- Cada aba tem seus setores (`carregarSetores()`) e seus atendimentos (`carregarAtendimentosAnteriores()`, filtrando por `estado.modalidade`).

## Pagamento obrigatório

Nada é concluído sem pagamento:

- **Consulta:** escolha paciente, setor e médico. O botão **Pagar e abrir consulta** abre a janela de pagamento;
  a consulta só é aberta (`registrarAtendimento(dados)`) depois que o pagamento é confirmado.
- **Exames:** o botão **Pagar e salvar requisição** abre a janela com os itens e o total;
  a requisição só é salva (`salvarRequisicaoExames(requisicao)`) depois do pagamento.
- **Pronto Socorro:** o atendimento abre sem cobrança; os exames pedidos pelo médico passam pelo pagamento acima.

Formas: Pix (ID da transação), crédito (1x a 6x, NSU), débito (NSU) e dinheiro (valor recebido e troco).
Use `abrirPagamento({ descricao, itens, valor, valorEditavel, desconto })` em qualquer tela: devolve o pagamento
confirmado ou `null` se a pessoa cancelar.

## Fluxo do atendimento

As etapas aparecem no topo da tela de Atendimento:

| Consulta particular | Pronto Socorro |
|---|---|
| 1. Paciente (buscar ou cadastrar) | 1. Paciente (basta o nome: cadastro rápido) |
| 2. **Pagamento** da consulta (valor do médico) | 2. **Pagamento** da consulta de emergência (valor do setor) |
| 3. Consulta (botão **Concluir consulta**) | 3. Consulta com o médico de plantão (**Concluir consulta**) |
| 4. Exames (se o médico pedir, **pagos antes**) | 4. Exames (se o médico pedir, **pagos antes**) |

Nas duas abas o paciente **só é liberado para a consulta depois de pagar**.
No Pronto Socorro o valor vem do setor: `preencherSetores([{ id, nome, valorConsulta }])`.

- Depois de pagar, o paciente fica **Liberado para consulta** (status `AGUARDANDO`). Grave esse status em `registrarAtendimento()`.
- **Concluir consulta** chama `registrarConclusaoConsulta(atendimento)` (status `ATENDIDA`).
  Só depois disso aparece **Pedir exames**.
- O botão de cadastro ao lado da busca abre o **cadastro rápido** (`cadastrarPaciente()`): só o nome é obrigatório.
- Cada atendimento pode ter o campo `exames` (quantidade já pedida), mostrado como "Pedir exames (2)".

## Pagamento por médico e Financeiro

- **Agendar consulta** também exige pagamento: o valor vem do médico escolhido e o botão **Pagar e agendar consulta**
  abre a janela de pagamento. Só depois de confirmar chama `agendarConsulta(dados)`.
- Todo pagamento confirmado (consulta ou exames) passa por `registrarPagamento(pagamento)`, com
  `pagamento.contexto = { tipo: 'CONSULTA' | 'EXAMES', paciente, medico }`. Grave ali o recebimento.
- O **Financeiro** mostra os totais por forma de pagamento, o quadro **Recebido por médico** (consultas, exames e total)
  e a lista de recebimentos. Basta chamar `renderFinanceiro(lista)` com
  `[{ data, paciente, tipo, medico, formaPagamento: 'PIX' | 'CREDITO' | 'DEBITO' | 'DINHEIRO', valor }]`.

## Recibo de pagamento

- Abre sozinho logo depois de cada pagamento confirmado (`CONFIG.reciboAutomatico`).
- Também abre pelo botão **Recibo de consulta** no topo do Atendimento (último pagamento), pelo botão **Recibo**
  em cada atendimento pago e pelo botão **Recibo** no Financeiro.
- Mostra os dados do hospital (`CONFIG.empresa`, preencha com os dados reais), número, data e hora, paciente e CPF,
  valor **por extenso**, itens, desconto, forma de pagamento (parcelas, NSU, ID Pix, troco) e linha de assinatura.
- **Imprimir recibo** usa `window.print()` e imprime só o recibo.
- O número do recibo é provisório (data e hora). Se o seu sistema gerar o número, devolva `{ numeroRecibo }` em `registrarPagamento()`.
- Para o botão Recibo aparecer na lista e no Financeiro, cada atendimento ou recebimento precisa trazer o campo `pagamento`.
- Não existe cancelamento nem estorno de pagamento.

## Versão de demonstração

`demonstracao.html` é o sistema com **dados fictícios** (pacientes, médicos, setores e valores), igual ao link de teste.
Abra com dois cliques para testar o fluxo sem precisar da sua lógica. Ela começa do zero e nada é salvo de verdade.
O sistema de verdade continua sendo o `index.html` (com `css/style.css` e `js/app.js`).

## Cadastros do hospital (`DADOS` em `js/app.js`)

- **Unidade:** Hospital da Saúde (aparece no atendimento e no recibo).
- **Setores:** Consulta → *Consultórios*; Pronto Socorro → *Emergência* (valor da consulta de emergência: R$ 250,00).
  Quando só existe um setor, ele já vem selecionado.
- **Médicos da consulta:** Dra. Fernanda Costa (Cardiologia), Dr. Ricardo Mendes (Ortopedia),
  Dra. Juliana Rocha (Ginecologia) e Dr. Paulo Nogueira (Clínica geral), cada um com seu valor.
- **Médicos de plantão da Emergência:** Dr. Rafael Monteiro, Dra. Camila Andrade, Dr. Thiago Barbosa,
  Dra. Larissa Pinheiro e Dr. Eduardo Farias.
- No Pronto Socorro é obrigatório escolher o **médico de plantão** antes de pagar; o pagamento entra no Financeiro no nome dele.

Nomes, CRMs e valores são **exemplos**: edite o objeto `DADOS` para colocar os reais.
