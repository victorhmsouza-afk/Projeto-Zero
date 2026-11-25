# Atendimento Particular

Frontend feito do zero, focado em **serviço e pagamento** do atendimento particular do Hospital da Saúde.
HTML, CSS e JavaScript puro: abra o `index.html` com dois cliques, sem instalar nada.

> O projeto anterior (`../projeto-consulta-particular/`) continua no repositório só como referência.

## Fluxo

1. **Novo atendimento** — paciente (busca um já cadastrado ou cadastra na hora), tipo (**Consulta** ou **Pronto Socorro**),
   médico e valor → **pagamento** (Pix, crédito em até 6x, débito, dinheiro com troco; desconto opcional) → **recibo**.
2. **Consulta realizada** — botão no atendimento. Só depois disso os exames podem ser adicionados.
3. **Exames pedidos pelo médico** — adicionados pelo nome (imagem e laboratório), com o preço da tabela.
   Tomografia pode ser **com contraste** (+ adicional). Raio-X vale para qualquer osso (ex.: "Raio-X de joelho").
4. **Pagamento dos exames** — o paciente paga **tudo de uma vez ou aos poucos**: marque os exames e clique em *Pagar*.
   Cada exame passa por **A pagar → Pago → Realizado**. Só exame ainda não pago pode ser removido.
5. **Pagamentos** — cada pagamento gera um recibo (valor por extenso, itens, forma de pagamento) que pode ser reaberto e impresso.

Não existe cancelamento nem estorno de pagamento.

## Telas

| Tela | O que tem |
|---|---|
| **Atendimentos** | Resumo do dia (atendimentos, recebido, exames a pagar), lista do dia com busca e situação de cada um, e o detalhe do atendimento selecionado. Dá para ver outros dias pelo campo de data. |
| **Estatísticas** | Consultas por **mês, dia, hora e minuto (faixas de 15 min)**, separando Consulta e Pronto Socorro; indicadores (total, média por dia, %, horário de pico e faixa mais cheia, recebido em consultas e em exames); gráfico com dica ao passar o mouse e tabela com os mesmos números. Botões para **gerar/remover dados de exemplo** (90 dias fictícios, marcados). |
| **Preços** | Valor da consulta de Pronto Socorro, adicional de contraste e preço de cada exame (editável, com inclusão de novos). Os médicos e o valor da consulta de cada um ficam em `js/dados.js`. |

## Arquivos

```
atendimento-particular/
├── index.html            → telas e janelas (novo atendimento, pagamento, recibo, confirmação)
├── css/estilo.css        → visual (tema claro e escuro, celular)
└── js/
    ├── dados.js          → CONFIG (hospital, médicos), tabela de preços padrão e o objeto Banco (onde os dados são salvos)
    ├── app.js            → atendimentos, pagamento, recibo e preços
    └── estatisticas.js   → estatísticas e dados de exemplo
```

## Onde os dados ficam

Hoje tudo fica salvo **no navegador** (localStorage), então o sistema funciona de verdade no computador onde for usado.
Para ligar ao banco de dados / API do hospital, troque **só as funções do objeto `Banco`** em `js/dados.js`
(todas já são `async`, prontas para `fetch`):

| Função | O que faz |
|---|---|
| `buscarPacientes(texto)` / `salvarPaciente(p)` | pacientes `{ id, nome, cpf, telefone }` |
| `listarAtendimentos({ inicio, fim })` / `obterAtendimento(id)` / `salvarAtendimento(a)` | atendimento `{ id, numero, pacienteId, pacienteNome, cpf, telefone, tipo: 'CONSULTA' \| 'PRONTO_SOCORRO', medicoId, medicoNome, valorConsulta, abertoEm, pagamentoConsultaId, consultaRealizadaEm, exames: [{ id, nome, categoria, valor, status: 'PENDENTE' \| 'PAGO' \| 'REALIZADO', pedidoEm, pagoEm, pagamentoId, realizadoEm }] }` |
| `registrarPagamento(pg)` / `listarPagamentos({ inicio, fim, atendimentoId })` | pagamento `{ id, numeroRecibo, referente: 'CONSULTA' \| 'EXAMES', atendimentoId, atendimentoNumero, pacienteNome, cpf, medicoNome, tipoConsulta, forma, valor, subtotal, desconto, itens, parcelas?, autorizacao?, idTransacao?, recebido?, troco?, dataHora }` |
| `lerPrecos()` / `salvarPrecos(p)` / `restaurarPrecos()` | `{ prontoSocorro, adicionalContraste, exames: [{ categoria, nome, valor }] }` |

## Observações

- Valores de laboratório e de alguns exames são **exemplos**: ajuste na tela Preços.
- Os dados de exemplo das estatísticas têm `exemplo: true` e somem com **Remover dados de exemplo**.
- Imprimir recibo usa `window.print()` e imprime só o recibo.
