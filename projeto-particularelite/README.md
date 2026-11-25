# Particular Elite (projeto-particularelite)

**Demonstrativo on-line:** https://victorhmsouza-afk.github.io/Projeto-Zero/projeto-particularelite/
(os dados ficam no navegador de quem abre; use "Gerar dados de exemplo" em Estatísticas para ver os gráficos)

Frontend feito do zero, focado em **serviço e pagamento** do atendimento particular do Hospital da Saúde.
HTML, CSS e JavaScript puro: abra o `index.html` com dois cliques, sem instalar nada.

> O projeto anterior (`../projeto-consulta-particular/`) continua no repositório só como referência.

## Como é a tela (estilo caixa / PDV)

```
┌──────────────┬──────────────────────────────┬────────────────────┐
│ + Novo       │ COMANDA (cupom)              │ TOTAL A PAGAR      │
│ dia / busca  │ Paciente · nº do atendimento │ R$ 1.025,00        │
│ resumo do dia│ ─ Consulta ........ R$ 350   │ Desconto           │
│ FILA DO DIA  │ ─ Hemograma ☑ ..... R$  25   │ [PIX] [CRÉDITO]    │
│  Maria 19:22 │ ─ Tomografia ☑ .... R$1.000  │ [DÉBITO][DINHEIRO] │
│  João  18:40 │ ─ Raio-X ☐ ........ R$  90   │ FINALIZAR PAGAMENTO│
└──────────────┴──────────────────────────────┴────────────────────┘
```

Visual **executivo** em **verde** (padrão) ou **azul-marinho**, com detalhes dourados — a cor é escolhida nas bolinhas do topo e fica salva; títulos em serifa (Playfair Display),
números em Inter, cantos retos e tema claro/escuro automático.

## Fluxo

1. **+ Novo atendimento** — a comanda abre em branco: paciente (busca um já cadastrado ou cadastra na hora),
   **Consulta** ou **Pronto Socorro**, médico e valor. O valor vai direto para o **visor do total**.
   Escolha **PIX, CRÉDITO (até 6x), DÉBITO ou DINHEIRO (com troco)**, desconto opcional, e **FINALIZAR PAGAMENTO** → recibo.
2. **Consulta realizada** — botão na comanda. Só depois disso os exames podem ser lançados.
3. **Lançar exames pedidos pelo médico** — pelo nome (imagem e laboratório), com o preço da tabela.
   Tomografia pode ser **com contraste** (+ adicional). Raio-X vale para qualquer osso (ex.: "Raio-X de joelho").
4. **Pagar exames** — marque (☑) os exames que o paciente vai pagar agora: o visor mostra o total.
   O paciente paga **tudo de uma vez ou aos poucos**. Cada exame passa por **A pagar → Pago → Realizado**.
   Só exame ainda não pago pode ser removido.
5. **Recibos** — cada pagamento gera um recibo (valor por extenso, itens, forma de pagamento), que pode ser reaberto e impresso.

Não existe cancelamento nem estorno de pagamento.

## Telas

| Tela | O que tem |
|---|---|
| **Caixa** | Fila do dia (com busca, outros dias e resumo), comanda do paciente e painel de pagamento com visor do total. |
| **Estatísticas** | Consultas por **mês, dia, hora e minuto (faixas de 15 min)**, separando Consulta e Pronto Socorro; indicadores (total, média por dia, %, horário de pico e faixa mais cheia, recebido em consultas e em exames); gráfico com dica ao passar o mouse e tabela com os mesmos números. Botões para **gerar/remover dados de exemplo** (90 dias fictícios, marcados). |
| **Preços** | Valor da consulta de Pronto Socorro, adicional de contraste e preço de cada exame (editável, com inclusão de novos). Os médicos e o valor da consulta de cada um ficam em `js/dados.js`. |

## Arquivos

```
projeto-particularelite/
├── index.html            → telas (caixa, estatísticas, preços) e janelas (recibo, confirmação)
├── css/estilo.css        → visual de caixa/PDV (tema claro e escuro, celular)
└── js/
    ├── dados.js          → CONFIG (hospital, médicos), tabela de preços padrão e o objeto Banco (onde os dados são salvos)
    ├── app.js            → caixa (fila, comanda, pagamento), recibo e preços
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
