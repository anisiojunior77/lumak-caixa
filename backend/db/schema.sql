-- Lumak Caixa: modelo de dados (SQLite)
-- Valores em CENTAVOS (inteiros). Vendas, itens, pagamentos e sessões de caixa
-- usam UUID (texto), para o caixa poder vender offline sem conflito de ids.

CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  login       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  perfil      TEXT NOT NULL CHECK (perfil IN ('caixa', 'gerente', 'estoquista')),
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS produtos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barras   TEXT UNIQUE,
  nome            TEXT NOT NULL,
  categoria_id    INTEGER REFERENCES categorias(id),
  preco_centavos  INTEGER NOT NULL CHECK (preco_centavos > 0),
  estoque         INTEGER NOT NULL DEFAULT 0,
  estoque_minimo  INTEGER NOT NULL DEFAULT 0,
  ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

CREATE TABLE IF NOT EXISTS sessoes_caixa (
  id                 TEXT PRIMARY KEY,
  usuario_id         INTEGER NOT NULL REFERENCES usuarios(id),
  aberto_em          TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  fundo_centavos     INTEGER NOT NULL DEFAULT 0 CHECK (fundo_centavos >= 0),
  fechado_em         TEXT,
  contado_centavos   INTEGER CHECK (contado_centavos >= 0),
  esperado_centavos  INTEGER,
  status             TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada'))
);

CREATE TABLE IF NOT EXISTS vendas (
  id                     TEXT PRIMARY KEY,
  sessao_id              TEXT NOT NULL REFERENCES sessoes_caixa(id),
  usuario_id             INTEGER NOT NULL REFERENCES usuarios(id),
  dispositivo_id         TEXT NOT NULL DEFAULT 'servidor',
  criado_em_dispositivo  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  recebido_em            TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status                 TEXT NOT NULL DEFAULT 'finalizada' CHECK (status IN ('finalizada', 'cancelada')),
  total_centavos         INTEGER NOT NULL CHECK (total_centavos > 0),
  motivo_cancelamento    TEXT,
  cancelada_por          INTEGER REFERENCES usuarios(id),
  CHECK (status = 'finalizada' OR motivo_cancelamento IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS venda_itens (
  id                   TEXT PRIMARY KEY,
  venda_id             TEXT NOT NULL REFERENCES vendas(id),
  produto_id           INTEGER NOT NULL REFERENCES produtos(id),
  nome_produto         TEXT NOT NULL,
  preco_unit_centavos  INTEGER NOT NULL CHECK (preco_unit_centavos > 0),
  quantidade           INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal_centavos    INTEGER NOT NULL CHECK (subtotal_centavos > 0)
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id                 TEXT PRIMARY KEY,
  venda_id           TEXT NOT NULL REFERENCES vendas(id),
  forma              TEXT NOT NULL CHECK (forma IN ('dinheiro', 'cartao', 'pix')),
  valor_centavos     INTEGER NOT NULL CHECK (valor_centavos > 0),
  recebido_centavos  INTEGER,
  troco_centavos     INTEGER NOT NULL DEFAULT 0 CHECK (troco_centavos >= 0)
);

CREATE TABLE IF NOT EXISTS movimentos_estoque (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id  INTEGER NOT NULL REFERENCES produtos(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'venda', 'ajuste', 'cancelamento')),
  quantidade  INTEGER NOT NULL CHECK (quantidade != 0),
  criado_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  venda_id    TEXT REFERENCES vendas(id),
  motivo      TEXT
);
-- O próprio banco garante: cada usuário só pode ter UM caixa aberto por vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_uma_sessao_aberta
  ON sessoes_caixa(usuario_id) WHERE status = 'aberta';