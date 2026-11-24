# Projeto Consulta Particular

> Para ligar o sistema ao banco de dados / API do hospital, veja o **[Guia de integração](GUIA-INTEGRACAO.md)** (rascunho).

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

Os valores que vêm preenchidos são a **tabela de referência aprovada**:

| Exame / serviço | Valor |
|---|---|
| Tomografia (qualquer região) | R$ 750,00 |
| Tomografia **com contraste** | R$ 750,00 + R$ 250,00 = **R$ 1.000,00** |
| Raio-X (qualquer osso) | R$ 90,00 |
| Ultrassonografia (USG) | R$ 140,00 a R$ 180,00 |
| Ressonância magnética | R$ 750,00 a R$ 850,00 |
| Eletrocardiograma (ECG) | R$ 60,00 |
| Ecocardiograma | R$ 250,00 |
| Endoscopia digestiva alta | R$ 350,00 |
| Colonoscopia | R$ 700,00 |
| Mamografia | R$ 150,00 |
| Consulta de emergência (PS) | R$ 250,00 |
| Consultas com especialista | R$ 200,00 a R$ 350,00 |

Os **códigos laboratoriais** (40304361, 40302040, 40301630) ainda são exemplos: confira antes de usar.
Para mudar um valor, use a tela *Tabela de preços* (ou o objeto `PRECOS_EXEMPLO` / `DADOS` em `js/app.js`).
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

## Marca de paciente particular (✱ roxo)

O hospital também atende pacientes de convênio. O **particular** não tem plano e **paga por serviço**, por isso aparece
com o selo **✱ Particular** em **roxo**, uma cor que não é usada na classificação de prioridade
(vermelho, laranja, amarelo e verde). As duas marcas podem aparecer juntas sem confusão.

- Na **busca** e no **cartão do paciente** (Atendimento e Exames) o fundo fica na cor padrão do site e aparece só **✱ Particular** em negrito;
  quando o paciente já tem prioridade, o selo aparece na cor da prioridade (ex. ✱ Verde).
- Também aparece na lista de atendimentos (faixa roxa e ✱ no número),
  Painel, Agenda, tela Pacientes (coluna Tipo) e no texto do recibo.
- Regra: o paciente é particular quando o campo `convenio` está vazio (o cadastro rápido já cria assim).
  Se um paciente tiver `convenio`, o nome do convênio aparece no lugar do selo.
- Para mudar a cor, troque `--particular` e `--particular-claro` no `css/style.css`.

## Classificação de risco e fila da emergência

- No **Pronto Socorro**, depois de escolher o paciente, é obrigatório escolher a **classificação de risco**:
  **Vermelho** (emergência, imediato), **Laranja** (muito urgente, até 10 min), **Amarelo** (urgente, até 60 min),
  **Verde** (pouco urgente, até 120 min) e **Azul** (não urgente, até 240 min).
- O selo do paciente passa a ter **a cor da prioridade** e mantém o **✱ fixo** de particular: ex. **✱ Verde · Pouco urgente**.
  Sem classificação (ou na Consulta), continua o roxo **✱ Particular**. O cartão mostra a prioridade e o aviso de *sem convênio*.
- Etapas do Pronto Socorro: Paciente → **Classificação** → Pagamento → Consulta → Exames.
- O atendimento salvo leva `risco: 'VERMELHO' | 'LARANJA' | 'AMARELO' | 'VERDE'` (em `registrarAtendimento(dados)`).
- **Fila da emergência** (menu): pacientes do PS ainda sem consulta concluída, por prioridade e chegada, com tempo de espera
  (fica em vermelho quando passa da meta da cor) e contagem por cor. Ligue `carregarFila()` ao seu sistema e chame `renderFila(lista)`.

## Pré-classificação (recepção) e triagem (enfermagem)

Não existe mais a cor **azul**. Ficaram **vermelho, laranja, amarelo e verde**.

1. **Recepção:** o recepcionista faz a **pré-classificação** (obrigatória) antes do pagamento.
   O atendimento é salvo com `riscoOrigem: 'RECEPCAO'` e `historicoRisco: [{ risco, por: 'RECEPCAO', dataHora }]`.
2. **Pagamento** e liberação.
3. **Triagem de enfermagem:** botão **Triagem enfermagem** na lista de atendimentos ou na **Fila da emergência**.
   O enfermeiro confirma ou **muda a cor** e pode anotar queixa e sinais vitais. Chama `registrarTriagem(atendimento, triagem)`;
   depois dela o atendimento fica com `riscoOrigem: 'ENFERMAGEM'`, `triagemEnfermagem: true`, status `TRIADO`
   e mais um item em `historicoRisco`.
4. **Concluir consulta** só aparece depois da triagem. Depois dela ainda dá para **Reclassificar**.

A Fila mostra a coluna **Classificado por** (Recepção ou Enfermagem, com a hora e a cor anterior quando mudou).
Etapas do Pronto Socorro: Paciente → Pré-classificação → Pagamento → Triagem → Consulta → Exames.

## Retirar da tela (✕)

Quando o paciente **já pagou** e, no Pronto Socorro, **já passou pela triagem** (classificação concluída), aparece um **✕**:

- **Fila da emergência:** o ✕ tira o paciente da fila. O botão **Mostrar retirados (n)** mostra de novo, e
  **Voltar para a fila** desfaz. Os retirados ficam guardados por dia neste navegador.
- **Atendimento:** o ✕ no cartão do paciente limpa a tela para o próximo atendimento.

É só visualização: nada é apagado nem cancelado, e o pagamento continua registrado.

## Exames de imagem da tabela de preços

- **Raio-X:** um item só (vale para qualquer osso). Se escrever a região, como "Raio-X de joelho" ou "RX de tórax",
  o valor do Raio-X vem preenchido do mesmo jeito.
- **Tomografia por região** (R$ 750,00 cada): crânio, face, seios da face, órbitas, ouvidos (mastoides), pescoço, tórax, abdome superior,
  abdome total, pelve, coluna cervical, torácica e lombar, ombro, braço, cotovelo, antebraço, punho, mão, quadril,
  coxa, joelho, perna, tornozelo e pé.
- Também: ultrassonografias, ressonâncias, mamografia, densitometria, **eletrocardiograma**, ecocardiograma e
  **endoscopia** (digestiva alta e colonoscopia).
- Quem já tinha a tabela salva no navegador recebe os exames novos automaticamente, sem perder os valores que alterou.
- Os valores são **exemplos**: ajuste na tela Tabela de preços.

## Tomografia com contraste

Quando o tipo do exame é **Tomografia**, aparece a opção **Com contraste (+ R$ 250,00)**. Marcando, o valor do exame
soma o adicional (ex.: TC de crânio com contraste = R$ 1.000,00) e o nome fica "TC de crânio com contraste"
(na lista, na janela de pagamento e no recibo). O adicional pode ser mudado na tela **Tabela de preços**
("Adicional de contraste na tomografia"). No código: `precos.adicionais.contrasteTomografia`.

## Cadastro de médicos plantonistas

Na tela **Médicos**, quadro **Médicos plantonistas · Emergência**:

- **Cadastrar plantonista:** nome, CRM e especialidade (**Emergencista, Clínico geral, Ortopedista ou Pediatra**).
  Não deixa cadastrar dois médicos com o mesmo CRM. O médico novo já entra no plantão.
- **No plantão:** agora vem do **ponto** (veja abaixo). Médico recém-cadastrado só entra no plantão depois de registrar a entrada.
- **Remover:** tira o médico da lista (com confirmação). Atendimentos já feitos não mudam.
- No Atendimento (aba Pronto Socorro) há o atalho **+ Cadastrar plantonista**.

Os plantonistas ficam salvos **neste navegador**. Quando tiver banco de dados, troque `carregarPlantonistas()` e
`salvarPlantonistas()` em `js/app.js`. As especialidades ficam em `DADOS.especialidadesPlantao`.

## Ponto do plantão (com foto)

Tela **Ponto do plantão** (menu):

1. O médico escolhe o nome (plantonistas cadastrados na tela Médicos).
2. Tira a foto: **Abrir câmera → Tirar foto** (no computador, abrindo o `index.html` no Chrome/Edge) ou **Enviar foto**
   (no celular abre a câmera; no computador escolhe uma imagem).
3. **Registrar entrada**: ele passa a aparecer em *Médico de plantão* no Pronto Socorro.
   No próximo ponto o botão vira **Registrar saída**, e ele sai da lista.

- **No plantão agora:** foto, nome, especialidade e há quanto tempo está no plantão.
- **Registros de hoje:** hora, médico, entrada/saída e a foto.
- Na tela Médicos, a coluna *No plantão* mostra "Sim · desde 07:02" ou o atalho para registrar o ponto.
- Se ninguém registrou entrada, o Atendimento mostra "Nenhum médico no plantão · registrar ponto".
- A foto é reduzida (~320 px). Fotos (no IndexedDB) e horários (no localStorage) ficam guardados **neste navegador** por **13 meses**, para auditoria. Foto do rosto é dado
  sensível pela LGPD: use só para o ponto. Quando tiver banco de dados, troque `lerPonto()`, `salvarPonto()` e `registrarPonto()`.

## Tipo de plantão e pagamento do mês

- Na **entrada** do ponto o médico escolhe **Plantão 6 horas** ou **Plantão 12 horas** (obrigatório). A saída usa o mesmo tipo.
- O ponto mostra o horário previsto de término (ex.: "plantão 12 h · desde 07:30 até 19:30").
- Quadro **Plantões do mês · pagamento médico** (na tela Ponto do plantão): escolha o mês e preencha o
  **valor do plantão de 6 h** e **de 12 h**. Para cada médico aparecem os plantões de 6 h e 12 h, as horas trabalhadas,
  as **pendências** (sem saída registrada, saída mais de 15 min antes do horário, plantão em andamento) e o **valor a pagar**,
  com o total do mês para o contas a pagar.
- Registro salvo: `{ tipo: 'ENTRADA' | 'SAIDA', horas: 6 | 12, entradaId, medicoId, dataHora, foto }`.

## Auditoria dos plantões

- Os registros de ponto **não podem ser apagados pela tela**. Fotos e horários ficam **13 meses** (`DIAS_GUARDAR_REGISTROS` / `DIAS_GUARDAR_FOTO`).
- No quadro **Plantões do mês**, o botão **Auditoria** de cada médico mostra plantão por plantão: data, tipo contratado (6/12 h),
  **entrada com foto e hora**, **saída com foto e hora**, horas trabalhadas e a situação:
  *Cumprido*, *Faltaram X h* (em vermelho, ex.: fez 6 h de 12 h), *Sem saída registrada* ou *Em andamento*. Clique na foto para ampliar.
- As fotos ficam no **IndexedDB** do navegador (cabe muito mais que o localStorage). Quando tiver banco de dados,
  envie registro e foto em `registrarPonto(registro, foto)` e guarde lá para auditoria.
- Foto do rosto é dado sensível (LGPD): defina com o jurídico do hospital por quanto tempo guardar e quem pode ver.
