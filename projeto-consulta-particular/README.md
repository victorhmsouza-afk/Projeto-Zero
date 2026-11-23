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
