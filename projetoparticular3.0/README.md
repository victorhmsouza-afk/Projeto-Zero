# Projeto Particular 3.0 — Particular Elite

Terceira versão do sistema do **agendamento do atendimento particular** do Hospital da Saúde,
feita em **React + TypeScript + Tailwind + shadcn/ui**, com o design system verde.

**Para usar:** abra o **`index.html`** desta pasta com dois cliques (arquivo único, sem instalar nada).

**Demonstrativo on-line:** https://victorhmsouza-afk.github.io/Projeto-Zero/projetoparticular3.0/ (depois de ligar o GitHub Pages)

## Acessos de demonstração

| Usuário | Senha | O que vê |
|---|---|---|
| `admin` | `admin123` | Dashboard, Agendamento, Estatísticas, **Contábil** e **Preços** |
| `agendamento` | `agenda123` | Dashboard, Agendamento e Estatísticas |

Cortesia (senhas da diretoria): Dr. Henrique Albuquerque `1234` · Dra. Lúcia Fontes `4321` · Marcos Vieira `2468`.

## O que tem

| Tela | Para que serve |
|---|---|
| **Login** | 40% com as boas-vindas e o que o sistema faz, 60% com o formulário. |
| **Dashboard** | Resumo de hoje (só quantidades), gráfico por hora e quem está em andamento. |
| **Agendamento** | Fila do dia (sem valores) · novo atendimento (paciente cadastrado ou novo) · Consulta (com médico) ou Pronto Socorro · pagamento (Pix, crédito até 6x, débito, dinheiro com troco ou cortesia da diretoria) · exames pagos aos poucos · recibo. |
| **Estatísticas** | Consultas por mês, dia, hora e minuto. |
| **Contábil** *(admin)* | Único lugar com valores: total recebido, por forma de pagamento, por dia, cortesias, recibos e planilha CSV. |
| **Preços** *(admin)* | Valores do Pronto Socorro, contraste e exames. |

Sidebar verde autorretrátil (abre ao passar o mouse), tema claro/escuro e funciona no celular.

## Pastas

| Pasta / arquivo | O que é |
|---|---|
| `index.html` | O sistema pronto (gerado a partir do código-fonte — não edite à mão). |
| `codigo-fonte/` | Código React. Manual completo, como rodar e **onde mudar cada coisa** em [`codigo-fonte/README.md`](codigo-fonte/README.md). |

As versões anteriores continuam intactas em `../projeto-particularelite/` e `../projeto-consulta-particular/`.
