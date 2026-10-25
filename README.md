# Lumak Caixa

Sistema de **caixa (PDV)** para mercadinho, supermercado, padaria, lanchonete e comércio de esquina. Foi pensado para o caixa **nunca parar de vender**: leitor de código de barras, atalhos de teclado, pagamento em dinheiro com troco, Pix e cartão, e (na próxima fase) funcionamento **sem internet**, num programa de Windows que sincroniza com o servidor da loja.

> Projeto de estudo, construído passo a passo. O visual segue uma paleta inspirada em balanças comerciais: amarelo, preto e cinza claro, com botões retos e rótulos em fonte monoespaçada.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Estado atual](#estado-atual)
3. [Funcionalidades](#funcionalidades)
4. [Como o sistema vai ser (visão final)](#como-o-sistema-vai-ser-visão-final)
5. [Arquitetura e tecnologias](#arquitetura-e-tecnologias)
6. [Regras de negócio](#regras-de-negócio)
7. [Banco de dados](#banco-de-dados)
8. [API](#api)
9. [Atalhos de teclado](#atalhos-de-teclado)
10. [Como rodar](#como-rodar)
11. [Usar em vários computadores da rede](#usar-em-vários-computadores-da-rede)
12. [Estrutura de pastas](#estrutura-de-pastas)
13. [Segurança](#segurança)
14. [Roadmap](#roadmap)
15. [Decisões em aberto](#decisões-em-aberto)

---

## Visão geral

O operador de caixa passa os produtos no leitor, o sistema soma, ele escolhe a forma de pagamento, confirma, e a próxima venda já está pronta. Ao final do turno ele conta a gaveta e o sistema mostra se o caixa **bateu**, **faltou** ou **sobrou** dinheiro.

**Para quem é:** mercadinhos e supermercados pequenos primeiro; depois padaria, comércio de esquina e restaurante.

**Princípios:**

- **Velocidade acima de tudo.** Tudo se faz pelo teclado; o campo do leitor está sempre pronto.
- **O caixa não trava.** Estoque negativo só gera aviso, nunca bloqueia uma venda.
- **O servidor manda.** Preço, total e troco são calculados no servidor; a tela só mostra.
- **Nada se perde.** Cada venda tem um identificador único, então reenviar a mesma venda nunca a duplica.
- **Rastreável.** Cancelamentos exigem motivo e autorização de gerente, e tudo fica registrado.

---

## Estado atual

| Área | Situação |
|---|---|
| Backend (API, banco, login, vendas, caixa) | ✅ Pronto |
| Tela do caixa em React | ✅ Pronta |
| Cadastro de produtos e entrada de estoque | ⏳ Próximo passo |
| Relatórios | ⏳ Planejado |
| Programa de Windows (Electron) e modo offline | ⏳ Planejado |
| Sincronização com o servidor da loja | ⏳ Planejado |
| Impressão de cupom, nota fiscal (NFC-e) | ⏳ Planejado |

---

## Funcionalidades

### Já funcionando

**Acesso e perfis**
- Login com usuário e senha; a sessão dura 12 horas.
- Três perfis: **caixa** (opera o caixa), **gerente** (autoriza cancelamentos) e **estoquista** (reservado para o cadastro de produtos).

**Abertura e fechamento de caixa**
- Abertura com **fundo de troco**.
- Um operador só pode ter **um caixa aberto** por vez (garantido pelo próprio banco de dados).
- Fechamento "**caixa cego**": o operador conta a gaveta e digita o valor *antes* de ver o esperado.
- Resumo ao fechar: valor esperado, contado, diferença (falta ou sobra), total por forma de pagamento e número de vendas canceladas.
- Depois de fechado, o caixa não pode ser reaberto.

**Venda**
- Leitura por **código de barras** (o leitor funciona como um teclado).
- **Busca por nome** (sem diferenciar acentos: "pao" encontra "Pão").
- Quantidade rápida: `3*7891000100103` adiciona 3 unidades.
- Lista da venda com ajuste de quantidade e remoção de itens.
- Total grande, último produto lido e aviso de estoque baixo.

**Pagamento**
- **Dinheiro:** digita o valor recebido, vê o troco na hora; campo vazio significa valor exato.
- **Pix** e **cartão** (a maquininha é separada; o sistema só registra a forma de pagamento).
- Tela de confirmação com o número da venda e o troco em destaque.
- Avisos de **estoque baixo** ou **negativo** logo após a venda.

**Cancelamento**
- Cancela a última venda com **motivo obrigatório**.
- O operador precisa da **autorização de um gerente** (usuário e senha dele); um gerente logado cancela direto.
- O **estoque volta** automaticamente, com registro no histórico.
- Só é possível cancelar enquanto o caixa daquela venda ainda está aberto.

**Estoque**
- Cada venda e cada cancelamento gera um **movimento de estoque** (histórico completo).

### Planejado

- Cadastro e edição de produtos, categorias, preços e **entrada de estoque**.
- Relatórios: vendas do dia, por forma de pagamento, por operador, produtos mais vendidos, produtos com estoque baixo.
- Histórico de vendas, com **reimpressão** de comprovante.
- **Impressão de cupom** em impressora térmica.
- Produtos vendidos **por peso** (balança).
- Descontos e acréscimos, com permissão de gerente.
- **Sangria e suprimento** de caixa (retirar ou colocar dinheiro durante o turno).
- **Nota fiscal (NFC-e)** por integração com um provedor.
- Backup automático do banco de dados.
- Modos para **padaria** e **restaurante** (comandas e mesas).

---

## Como o sistema vai ser (visão final)

```
┌──────────────────────┐        ┌──────────────────────┐
│  Caixa 1 (Windows)   │        │  Caixa 2 (Windows)   │
│  programa Lumak      │        │  programa Lumak      │
│  banco local SQLite  │        │  banco local SQLite  │
│  fila de vendas      │        │  fila de vendas      │
└──────────┬───────────┘        └──────────┬───────────┘
           │   sincroniza quando há rede   │
           └───────────────┬───────────────┘
                           ▼
              ┌─────────────────────────┐
              │   Servidor da loja      │
              │   API + banco SQLite    │
              │   (fonte da verdade)    │
              └─────────────────────────┘
```

**Como vai funcionar:**

1. O operador abre o **programa de Windows** (um `.exe`, feito com **Electron**). Ele traz a mesma tela de caixa que existe hoje.
2. O caixa guarda uma **cópia do catálogo** (produtos e preços) no próprio computador.
3. Cada venda é gravada **localmente primeiro**, então a internet ou a rede da loja podem cair sem parar o atendimento.
4. Quando a conexão volta, as vendas guardadas são **enviadas ao servidor local da loja**, em ordem.
5. Como cada venda tem um **identificador único (UUID)**, enviar duas vezes não duplica nada.
6. O servidor consolida estoque, relatórios e fechamento de todos os caixas.

O ponto-chave: hoje a tela já gera o identificador da venda no computador do caixa, e o servidor já sabe reconhecer uma venda repetida. A base do modo offline está pronta.

---

## Arquitetura e tecnologias

| Camada | Tecnologia |
|---|---|
| Servidor (API) | Node.js 22, Express 5 |
| Banco de dados | SQLite (`better-sqlite3`), modo WAL, chaves estrangeiras ligadas |
| Autenticação | `jsonwebtoken` (JWT) e `bcryptjs` (senhas) |
| Tela do caixa | React + Vite |
| Programa de Windows (futuro) | Electron |
| Editor | VS Code |

**Por que SQLite?** Um único arquivo, sem instalar servidor de banco, rápido e confiável para uma loja pequena. O mesmo motor funcionará dentro do programa de Windows para o modo offline.

---

## Regras de negócio

- **Dinheiro em centavos inteiros.** Nunca em decimal, para evitar erros de arredondamento (`R$ 38,88` é guardado como `3888`).
- **Preço vem do banco.** O que a tela envia como preço é ignorado.
- **Instantâneo da venda.** O nome e o preço de cada item ficam copiados na venda, então alterar o produto depois não muda vendas antigas.
- **Estoque negativo permitido.** Só avisa; o caixa não trava por causa de contagem errada.
- **Idempotência.** Reenviar uma venda com o mesmo `id` devolve a venda já gravada.
- **Venda é "tudo ou nada".** Venda, itens, pagamento e estoque são gravados numa única transação.
- **Fechamento:** `esperado = fundo de troco + dinheiro das vendas finalizadas`. Pix, cartão e vendas canceladas não entram na gaveta.
- **Cancelamento:** exige motivo, autorização de gerente (para operadores) e caixa ainda aberto.
- **Quantidade máxima:** 999 por produto e 200 itens por venda.

---

## Banco de dados

| Tabela | Para que serve |
|---|---|
| `usuarios` | Operadores e gerentes (senha guardada só como hash) |
| `categorias` | Agrupamento de produtos |
| `produtos` | Código de barras, nome, preço, estoque, estoque mínimo |
| `sessoes_caixa` | Cada abertura/fechamento: fundo, esperado, contado |
| `vendas` | Cabeçalho da venda, status, total, motivo e autorizador do cancelamento |
| `venda_itens` | Itens da venda (com nome e preço copiados) |
| `pagamentos` | Forma, valor, recebido e troco |
| `movimentos_estoque` | Histórico: entrada, venda, ajuste e cancelamento |

Vendas, itens, pagamentos e sessões usam **UUID** como identificador, para que vários caixas possam criar registros offline sem conflito.

---

## API

Todas as rotas começam com `/api`. Exceto `saude` e `login`, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | Perfil | O que faz |
|---|---|---|---|
| GET | `/saude` | público | Confere se o servidor está de pé |
| POST | `/auth/login` | público | Entra com `{ login, senha }` e recebe o token |
| GET | `/auth/eu` | logado | Dados do usuário do token |
| GET | `/caixa/atual` | caixa, gerente | Caixa aberto do usuário (ou `null`) |
| POST | `/caixa/abrir` | caixa, gerente | Abre o caixa com `{ fundoCentavos }` |
| POST | `/caixa/fechar` | caixa, gerente | Fecha com `{ contadoCentavos }` e devolve o resumo |
| GET | `/produtos/codigo/:codigo` | logado | Produto pelo código de barras |
| GET | `/produtos?busca=leite` | logado | Busca por nome (sem acento, até 20 resultados) |
| POST | `/vendas` | caixa, gerente | Grava uma venda |
| GET | `/vendas/:id` | caixa, gerente | Consulta uma venda (operador vê só as próprias) |
| POST | `/vendas/:id/cancelar` | caixa, gerente | Cancela com `{ motivo, gerente? }` |

**Exemplo de venda:**

```json
POST /api/vendas
{
  "id": "opcional-um-uuid",
  "itens": [
    { "produtoId": 1, "quantidade": 2 },
    { "produtoId": 2, "quantidade": 1 }
  ],
  "pagamento": { "forma": "dinheiro", "recebidoCentavos": 5000 }
}
```

**Códigos de resposta:** `400` dados inválidos · `401` não logado · `403` sem permissão · `404` não encontrado · `409` conflito (por exemplo, caixa fechado) · `422` produto inexistente.

---

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Enter` | Adiciona o código digitado ou lido |
| `3*código` | Adiciona 3 unidades de uma vez |
| `F2` | Busca produto pelo nome |
| `F8` | Cancela a última venda |
| `F9` | Pagamento |
| `F10` | Fecha o caixa |
| `Del` | Remove o último item |
| `Esc` | Limpa a venda (pede confirmação) |
| `D` / `P` / `C` | No pagamento: dinheiro, Pix, cartão |

---

## Como rodar

**Requisitos:** Node.js 22 ou mais novo.

**1. Backend**, na pasta `backend`:

```bash
npm install
```

Crie o arquivo `backend/.env` com um segredo aleatório (32+ caracteres):

```
JWT_SEGREDO=cole-aqui-um-texto-aleatorio-bem-longo
```

Depois:

```bash
npm run seed                                       # cria o banco com produtos de exemplo
npm run usuario -- gerente SUASENHA gerente "Nome" # cria um gerente
npm run usuario -- ana SUASENHA caixa "Ana"        # cria um operador
npm run dev                                        # API em http://localhost:3002
```

**2. Frontend**, em outro terminal, na pasta `frontend`:

```bash
npm install
npm run dev                                        # tela em http://localhost:5173
```

Abra `http://localhost:5173`, entre com um usuário, abra o caixa e passe um produto.

**Códigos de barras de exemplo** (do `seed`): `7891000100103` (leite), `7891000200202` (arroz), `7891000400400` (café).

---

## Usar em vários computadores da rede

1. Deixe o backend e o frontend rodando no computador servidor (o frontend já está configurado com `host: true`).
2. Descubra o IP do servidor (`ipconfig`, procure **Endereço IPv4**, algo como `192.168.0.15`).
3. Libere as portas no Firewall do Windows (rede **Privada**):

   ```powershell
   New-NetFirewallRule -DisplayName "Lumak Caixa" -Direction Inbound -Protocol TCP -LocalPort 5173,3002 -Action Allow -Profile Private
   ```

4. Nos outros computadores, abra `http://IP-DO-SERVIDOR:5173`.

**Dica:** crie **um usuário por computador**, porque cada usuário só pode ter um caixa aberto por vez.

---

## Estrutura de pastas

```
lumak-caixa/
├── README.md
├── backend/
│   ├── server.js              # monta a API (cors, JSON, rotas, erros)
│   ├── auth.js                # login, token, permissões por perfil
│   ├── db/
│   │   ├── schema.sql         # definição das tabelas
│   │   ├── database.js        # conexão com o SQLite
│   │   ├── seed.js            # produtos de exemplo
│   │   └── criar-usuario.js   # cria ou atualiza usuários
│   └── routes/
│       ├── auth.js            # /api/auth
│       ├── caixa.js           # /api/caixa (abrir e fechar)
│       ├── produtos.js        # /api/produtos
│       └── vendas.js          # /api/vendas (vender, consultar, cancelar)
└── frontend/
    └── src/
        ├── App.jsx            # decide a tela: login, abrir caixa ou venda
        ├── Login.jsx
        ├── AbrirCaixa.jsx
        ├── Venda.jsx          # tela principal do caixa
        ├── Pagamento.jsx
        ├── Busca.jsx
        ├── CancelarVenda.jsx
        ├── FecharCaixa.jsx
        ├── api.js             # comunicação com o servidor
        ├── dinheiro.js        # formatação e leitura de valores em reais
        ├── uuid.js            # identificador único de cada venda
        └── index.css          # cores e estilos
```

---

## Segurança

- Senhas guardadas com **bcrypt**, nunca em texto.
- Login responde com a mesma mensagem e o mesmo tempo para usuário inexistente e senha errada (não revela quais usuários existem).
- O token contém só o id do usuário, e o usuário é **conferido no banco a cada requisição**: desativar alguém corta o acesso na hora.
- Todas as consultas ao banco usam **parâmetros** (sem montar SQL com texto do usuário).
- O arquivo `.env` e o banco de dados **não vão para o Git**.
- Cada operador só enxerga e cancela as próprias vendas.

**Limitações atuais:** o modo de desenvolvimento usa `http` (sem criptografia), então só deve ser usado numa rede interna de confiança. HTTPS e um modo de produção entram junto com o programa de Windows.

---

## Roadmap

- [x] Banco de dados e dados de exemplo
- [x] Login e perfis
- [x] Abrir caixa
- [x] Vendas (preço e troco calculados no servidor)
- [x] Cancelar venda com autorização de gerente
- [x] Fechar caixa com conferência da gaveta
- [x] Tela do caixa em React (leitor, busca, pagamento, atalhos)
- [ ] **Cadastro de produtos e entrada de estoque**
- [ ] Relatórios e histórico de vendas
- [ ] Modo de produção (um só servidor entrega API e tela)
- [ ] **Programa de Windows (Electron)**
- [ ] **Modo offline com fila e sincronização**
- [ ] Impressão de cupom (impressora térmica)
- [ ] Produtos por peso, descontos, sangria e suprimento
- [ ] Backup automático
- [ ] Nota fiscal (NFC-e)
- [ ] Modos padaria e restaurante

---

## Decisões em aberto

- **Preço no modo offline:** o caixa usará o preço da cópia local do catálogo; falta definir como o servidor valida ou aceita essa venda ao sincronizar.
- **Produtos por peso:** a quantidade hoje é um número inteiro; vender por quilo exige guardar quantidades fracionadas.
- **Nota fiscal:** escolher o provedor de NFC-e e o regime fiscal da loja.
- **Impressora e leitor:** modelos reais a validar com uma loja piloto.
- **Nome e identidade visual:** confirmar o direito de uso antes de qualquer divulgação pública.

---

## Licença

Projeto de estudo, sem licença definida por enquanto.