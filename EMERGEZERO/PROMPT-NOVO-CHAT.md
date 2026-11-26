# Prompt para continuar o projeto num chat novo (na rede do hospital)

Copie tudo o que está entre as linhas `=====` e cole no novo chat do Claude Code aberto num computador da rede do hospital.

=====================================================================

Olá! Vou continuar com você um projeto que comecei em outro chat (na nuvem). Agora estou num computador **dentro da rede do hospital (SAMEL)**, então você consegue acessar as APIs internas. Responda sempre em **português do Brasil**, de forma simples e clara (não sou programador), e me explique o que fez no final de cada tarefa.

## 1. O projeto

**EMERGEZERO — "Particular Elite"** (sucessor do Projeto Particular 3.0): sistema web do **agendamento do atendimento particular** do Hospital da Saúde (rede SAMEL). É um protótipo que depois será integrado ao sistema do hospital.

Fluxo: **consulta → pagamento → consulta realizada → médico pede exames → paciente paga os exames aos poucos → exames realizados**, com estatísticas e contábil.

## 2. Onde está o código

- Repositório GitHub: **https://github.com/victorhmsouza-afk/Projeto-Zero** (branch `main`)
- Pasta da versão atual: **`EMERGEZERO/`** (a pasta `projetoparticular3.0/` é a versão anterior — NÃO ALTERAR)
  - `index.html` → o sistema pronto, **arquivo único** (abre com dois cliques). É gerado pelo build — não editar à mão.
  - `codigo-fonte/` → código React. **Leia primeiro** `EMERGEZERO/README.md` e `EMERGEZERO/codigo-fonte/README.md` (têm o manual e a tabela "onde mudar cada coisa").
- Outras pastas do repositório (**NÃO ALTERAR**, são versões antigas guardadas): `projeto-particularelite/` (versão 2), `projeto-consulta-particular/` (versão 1), `cadastro-atendentes/`, `Health/` e o `index.html` da raiz.

Primeiro passo: clone (ou atualize) o repositório numa pasta deste computador, rode `npm install` em `EMERGEZERO/codigo-fonte` e confirme que `npm run check` e `npm run build` funcionam. Se o GitHub não estiver acessível daqui, me avise que eu baixo o .zip.

```
git clone https://github.com/victorhmsouza-afk/Projeto-Zero.git
cd Projeto-Zero/EMERGEZERO/codigo-fonte
npm install
npm run check   # TypeScript
npm run build   # gera ../index.html (EMERGEZERO/index.html)
npm run dev     # desenvolvimento em http://localhost:5173
```

## 3. Tecnologias (manter)

React 18 · TypeScript · Vite 5 (com `vite-plugin-singlefile`: o build gera **um único** `index.html` em `EMERGEZERO/`) · Tailwind CSS 3 · shadcn/ui (Radix) · Lucide React · React Router DOM com **HashRouter** (rotas depois do `#`, nunca dá 404) · React Hook Form + Zod · TanStack Query · Recharts · Sonner. Versões fixadas no `package.json` — não atualizar sem eu pedir.

Estrutura: `src/components/ui` (shadcn), `src/components/layout` (Sidebar, Header, menu.ts), `src/components/agendamento` (Fila, NovoAtendimento, Comanda, PainelPagamento), `src/pages` (Login, Dashboard, Agendamento, FilaPS, Estatisticas, Contabil, Precos), `src/services` (banco.ts, auth.ts, config.ts, prontuario.ts, regras.ts, exemplos.ts), `src/hooks`, `src/lib`, `src/types`, `src/index.css`.

## 4. Design system (manter exatamente)

- Cores em variáveis HSL no `src/index.css`. Claro: fundo `hsl(0,0%,98%)`, texto verde escuro `hsl(155,30%,25%)`, **primary verde institucional `hsl(155,85%,19%)` (#0d6955)**, secondary `hsl(210,16%,55%)`, accent `hsl(155,48%,52%)`, muted `hsl(155,10%,95%)`, destructive `hsl(0,84%,60%)`, border `hsl(155,15%,88%)`, card branco. Escuro: fundo `hsl(155,35%,12%)`, card `hsl(155,30%,15%)`, texto branco, border `hsl(155,25%,25%)`.
- **Login**: 40% esquerda verde com boas-vindas e sobre o sistema; 60% direita com card branco centralizado (logo circular verde, título verde bold, subtítulo #666, labels verdes, botão verde, botão secundário outline).
- **Sidebar verde autorretrátil**: recolhida mostra só ícones, expande ao passar o mouse, item ativo com fundo muted; recolhe depois de escolher uma aba; no celular abre pelo botão ☰.
- **Header** sticky branco com logo, nome do sistema, página, "Atualizado às" com relógio, tema claro/escuro e usuário.
- Cards com ícones coloridos; grid 1 coluna (celular) / 2 (tablet) / 4 (desktop); títulos `text-2xl font-bold`; toasts no canto inferior.

## 5. Regras de negócio (não mudar sem eu pedir)

- **Login de demonstração**: `admin`/`admin123` (vê tudo) e `agendamento`/`agenda123` (Dashboard, Agendamento, Fila do PS, Estatísticas). Contábil e Preços só para ADMIN (bloqueado também pelo endereço).
- **Agendamento** (tela principal, antes se chamava "Caixa"):
  - Fila do dia **sem valores em dinheiro**; mostra só **em andamento** e o **último atendido** (concluído = consulta realizada e nenhum exame pendente de pagamento); os demais pela busca.
  - Novo atendimento: **paciente já cadastrado** (busca nome/CPF) ou **novo paciente** (nome obrigatório; CPF com máscara, dígito verificador e sem duplicar; nascimento com idade; telefone; e-mail).
  - **Consulta** (eletiva, escolhe médico, valor do médico) ou **Pronto Socorro** (**só o serviço, sem nome de médico** — plantonista muda sempre; valor da tabela).
  - Pagamento: **Pix, Crédito (até 6x), Débito, Dinheiro (com troco)** e **CORTESIA** (paciente não paga; exige **nome da diretoria + senha + Observação**; gera comprovante de cortesia).
  - **Depois de pago não existe cancelamento nem estorno.** Antes de pagar: "Registrar e pagar depois" (fica *Aguardando pagamento*) e "Cancelar atendimento" com motivo. Cada pagamento gera recibo (valor por extenso, imprimir só o recibo).
  - **Finalizar atendimento** manualmente (mesmo sem ver mais o paciente); **reabrir por até 6 horas** para o **retorno médico** (mesmo dia, sem cobrança). Atendimentos de dias anteriores saem de "Em andamento" sozinhos.
  - Exames: só depois da "consulta realizada"; lançados pelo nome com preço da tabela; tomografia com contraste (+adicional); "Raio-X de …" usa o preço do Raio-X; o paciente paga **aos poucos** (marca quais paga agora); status A pagar → Pago → Realizado; só exame não pago pode ser removido.
- **Estatísticas**: só **quantidades** (mês, dia, hora, minuto em faixas de 15 min; Consulta x Pronto Socorro). Sem valores.
- **Contábil** (admin): **único lugar com valores** — total recebido, por forma de pagamento, por dia, cortesias, descontos, recibos e exportação CSV.
- **Preços** (admin): Pronto Socorro, contraste e exames.
- Dados hoje ficam no navegador (localStorage, chaves `ap.*`), isolados em `src/services/banco.ts` para depois trocar por API.

## 6. (JÁ FEITO) API da fila do Pronto Socorro

Já existe a tela **"Fila do PS"** (`src/pages/FilaPS.tsx` + `src/services/prontuario.ts`) que faz:

`GET https://api-prontuario.samel.com.br/prontuario/ps/filaDeAtendimentoProntoSocorroV2/49/Pronto%20Socorro`

(unidade 49, setor "Pronto Socorro"). No chat da nuvem não deu para testar porque esse domínio aponta para um IP interno (192.168.2.70) — só funciona aqui na rede do hospital. A tela hoje monta as colunas automaticamente a partir do JSON.

Quero que você:
1. Chame a API (curl ou similar) e me mostre **a estrutura** da resposta (campos e tipos) — **sem expor dados pessoais** dos pacientes no chat (mostre no máximo 1 registro com nome/CPF mascarados).
2. Crie um **tipo TypeScript** para o registro da fila e adapte `FilaPS.tsx` aos campos reais: colunas com nomes claros em português, ordem útil (senha/atendimento, paciente, idade, classificação de risco, chegada, **tempo de espera** calculado, situação), **cores da classificação de risco** (protocolo de Manchester: vermelho, laranja, amarelo, verde, azul), contagem por classificação, busca e atualização automática a cada 1 minuto (já existe).
3. Verifique se a chamada funciona **no navegador** abrindo o `EMERGEZERO/index.html` gerado (pode haver bloqueio de **CORS**). Se houver: em desenvolvimento já existe proxy no `vite.config.ts` (`/api-prontuario`); para o arquivo pronto, me explique as opções (pedir à TI para liberar CORS, ou servir o sistema pelo mesmo domínio) e qual recomenda.
4. Se fizer sentido, mostre no **Dashboard** um cartão com o total de pacientes na fila do PS.
5. Rode `npm run check` e `npm run build`, teste no navegador e me mostre o resultado.

## 7. Como trabalhar comigo

- Sempre em português, passo a passo, com linguagem simples. Pode demorar o quanto precisar para ficar bom, claro e fácil.
- **Não altere as versões antigas** (pastas fora de `EMERGEZERO/`).
- Depois de mudar o código, **sempre rode o build** (o `index.html` pronto precisa ficar atualizado) e teste.
- **LGPD**: não copie dados reais de pacientes para o código, commits, prints ou mensagens; use dados fictícios em testes.
- Quando eu pedir para "salvar no git/GitHub", faça commit em português no `main` e dê push.
- Antes de qualquer coisa, me diga em poucas linhas o que entendeu e confirme que o projeto rodou aqui.

=====================================================================
