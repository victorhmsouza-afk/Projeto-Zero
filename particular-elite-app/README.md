# Particular Elite — código-fonte (React)

Este é o **código-fonte** do sistema **Particular Elite** (caixa do atendimento particular do Hospital da Saúde).
O resultado pronto para usar fica em **`../projeto-particularelite/index.html`** (um arquivo só — abre com dois cliques).

## Como usar o sistema (sem programar)

1. Abra `projeto-particularelite/index.html` com dois cliques (ou pelo GitHub Pages).
2. Entre com um dos acessos de demonstração (ou clique nos botões da tela de login):

| Usuário | Senha | Perfil | Vê |
|---|---|---|---|
| `admin` | `admin123` | Administrador | Dashboard, Caixa, Estatísticas, **Contábil**, **Preços** |
| `caixa` | `caixa123` | Caixa | Dashboard, Caixa, Estatísticas |

3. Use a **sidebar verde** à esquerda: ela fica recolhida (só ícones) e abre ao passar o mouse. No celular, abra pelo botão ☰.

| Aba | Para que serve |
|---|---|
| **Dashboard** | Resumo de hoje (só quantidades): atendimentos, em andamento, consultas, Pronto Socorro, gráfico por hora e quem está em andamento. |
| **Caixa** | Fila do dia (sem valores) · Novo atendimento (paciente já cadastrado ou **novo paciente**) · Consulta (com médico) ou **Pronto Socorro** (só o serviço) · pagamento (Pix, crédito até 6x, débito, dinheiro com troco ou **cortesia da diretoria**) · consulta realizada · exames pagos **aos poucos** · recibo. |
| **Estatísticas** | Consultas por **mês, dia, hora e minuto** (gráfico e tabela). Gera/remove dados de exemplo. |
| **Contábil** *(admin)* | **Único lugar com valores**: total recebido, por forma de pagamento, por dia, cortesias, recibos e **planilha CSV** para o Excel. |
| **Preços** *(admin)* | Valor do Pronto Socorro, contraste e de cada exame (salva ao sair do campo); inclui exames novos. |

**Cortesia:** escolha **CORTESIA** no pagamento → nome de quem autorizou na diretoria + senha + observação.
Senhas de demonstração: Dr. Henrique Albuquerque `1234`, Dra. Lúcia Fontes `4321`, Marcos Vieira `2468`.

Não existe cancelamento nem estorno. Os dados ficam salvos **no navegador** do computador.

## Como rodar o código (para quem programa)

Precisa do **Node.js 20+**.

```bash
cd particular-elite-app
npm install        # instala as dependências (uma vez)
npm run dev        # abre em http://localhost:5173 com recarga automática
npm run build      # gera ../projeto-particularelite/index.html (arquivo único)
npm run check      # confere os tipos (TypeScript)
```

## Tecnologias

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix UI) · Lucide React (ícones) · React Router DOM (**HashRouter** — as rotas ficam depois do `#`, então nunca dá 404) · React Hook Form + Zod (formulários) · TanStack Query (dados) · Recharts (gráficos) · Sonner (avisos).

## Pastas

```
src/
├── components/
│   ├── ui/            → componentes shadcn/ui (button, card, input, label, select, badge, dialog, table, checkbox, radio-group, tooltip, sonner…)
│   ├── layout/        → AppLayout, Sidebar (verde, autorretrátil), Header (topo), Logo, menu.ts (abas e perfis)
│   ├── caixa/         → Fila, NovoAtendimento, Comanda, PainelPagamento, paciente.ts (validação do cadastro)
│   ├── Recibo.tsx · Confirmar.tsx · StatCard.tsx · PeriodoFiltro.tsx · PageHeader.tsx · GraficoConsultas.tsx
├── hooks/             → use-auth, use-toast, use-mobile, use-tema, use-dados (TanStack Query)
├── lib/               → utils.ts (função cn), format.ts (moeda, datas, CPF, telefone, valor por extenso)
├── pages/             → Login, Dashboard, Caixa, Estatisticas, Contabil, Precos, NaoEncontrada
├── services/          → banco.ts (onde os dados são salvos), auth.ts (login), config.ts (hospital, médicos, diretoria, usuários, preços), regras.ts, exemplos.ts
├── types/             → tipos TypeScript (Paciente, Atendimento, Pagamento…)
└── index.css          → cores do design system (variáveis HSL, claro e escuro)
```

## Onde mudar cada coisa

| Quero mudar… | Arquivo |
|---|---|
| Nome, CNPJ, endereço do hospital | `src/services/config.ts` → `HOSPITAL` |
| Médicos e valor da consulta | `src/services/config.ts` → `MEDICOS` |
| Diretoria que autoriza cortesia | `src/services/config.ts` → `DIRETORIA` |
| Usuários e senhas do login | `src/services/config.ts` → `USUARIOS` |
| Tabela de preços padrão | `src/services/config.ts` → `PRECOS_PADRAO` |
| Abas da sidebar e quem vê cada uma | `src/components/layout/menu.ts` |
| Cores (verde institucional etc.) | `src/index.css` (variáveis) e `tailwind.config.ts` |
| Ligar ao banco de dados / API do hospital | **só** `src/services/banco.ts` e `src/services/auth.ts` (todas as funções já são `async`) |

> As senhas da diretoria e dos usuários estão no código **só para demonstração**.
> No sistema do hospital, login e autorização de cortesia devem ser conferidos no servidor.

Os dados usam as mesmas chaves do navegador da versão anterior (`ap.*`), então o que já foi lançado continua aparecendo.
