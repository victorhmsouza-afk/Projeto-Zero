# Projeto Consulta Particular

Projeto pessoal, separado de qualquer outro sistema, para gestão de consultas particulares.
Por enquanto é **só o front-end** (HTML + CSS + JavaScript puro, sem dependências).

## Como abrir

Dê dois cliques em `index.html`.

## Estrutura

```
projeto-consulta-particular/
├── index.html     → telas: Painel, Agenda, Nova consulta, Pacientes, Médicos, Financeiro, Configurações
├── css/style.css  → visual (paleta verde "health", menu lateral, responsivo)
└── js/app.js      → navegação entre telas + funções vazias para a sua lógica
```

## Onde colocar a sua lógica

Em `js/app.js`, procure por `TODO`. Cada tela tem uma função `carregar...()` que roda quando ela é aberta,
e os formulários já têm o `submit` capturado. Para exibir dados nas tabelas, chame:

| Função | Tela |
|---|---|
| `renderProximos(lista)` | Painel |
| `renderAgenda(lista)` | Agenda |
| `renderPacientes(lista)` | Pacientes |
| `renderMedicos(lista)` | Médicos |
| `renderFinanceiro(lista)` | Financeiro |
| `preencherSelect(seletor, [{ valor, texto }])` | Qualquer `<select>` |
