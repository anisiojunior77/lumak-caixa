import { Router } from 'express';
import db, { semAcento } from '../db/database.js';
import { exigirPerfil } from '../auth.js';

const router = Router();

const SELECT_PRODUTO = `
  SELECT p.id,
         p.codigo_barras  AS codigoBarras,
         p.nome,
         p.preco_centavos AS precoCentavos,
         p.estoque,
         p.estoque_minimo AS estoqueMinimo,
         c.nome           AS categoria
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
   WHERE p.ativo = 1
`;

const porCodigo = db.prepare(`${SELECT_PRODUTO} AND p.codigo_barras = ?`);
const porNome = db.prepare(`
  ${SELECT_PRODUTO}
     AND sem_acento(p.nome) LIKE ? ESCAPE '\\'
   ORDER BY p.nome
   LIMIT 20
`);

// Acrescenta um aviso de estoque baixo (o caixa só avisa, não bloqueia).
function formatar(p) {
  return { ...p, estoqueBaixo: p.estoque <= p.estoqueMinimo };
}

// GET /api/produtos/codigo/7891000100103   <- o leitor chama esta rota
router.get('/codigo/:codigo', (req, res) => {
  const codigo = req.params.codigo.trim();

  if (!/^\d{1,20}$/.test(codigo)) {
    return res.status(400).json({ erro: 'Código de barras inválido.' });
  }

  const produto = porCodigo.get(codigo);
  if (!produto) {
    return res.status(404).json({ erro: `Produto com código ${codigo} não cadastrado.` });
  }

  res.json(formatar(produto));
});

// GET /api/produtos?busca=acucar   <- tecla F2 (buscar por nome)
router.get('/', (req, res) => {
  const termo = semAcento(req.query.busca).trim();
  if (termo.length < 2) return res.json([]);

  // Protege os caracteres especiais do LIKE (% e _) digitados pelo usuário.
  const padrao = '%' + termo.replace(/[\\%_]/g, '\\$&') + '%';
  res.json(porNome.all(padrao).map(formatar));
});

// =====================================================================
//  GESTÃO DE PRODUTOS  (gerente e estoquista)
// =====================================================================
const gestao = exigirPerfil('gerente', 'estoquista');

const SELECT_GESTAO = `
  SELECT p.id,
         p.codigo_barras  AS codigoBarras,
         p.nome,
         c.nome           AS categoria,
         p.preco_centavos AS precoCentavos,
         p.estoque,
         p.estoque_minimo AS estoqueMinimo,
         p.ativo
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
`;
const listarGestao = db.prepare(`${SELECT_GESTAO} ORDER BY p.nome`);
const lerGestao = db.prepare(`${SELECT_GESTAO} WHERE p.id = ?`);
const listarCategorias = db.prepare('SELECT nome FROM categorias ORDER BY nome');

const codigoEmUso = db.prepare('SELECT id, nome FROM produtos WHERE codigo_barras = ? AND id != ?');
const inserirCategoria = db.prepare('INSERT OR IGNORE INTO categorias (nome) VALUES (?)');
const buscarCategoria = db.prepare('SELECT id FROM categorias WHERE nome = ?');
const inserirProduto = db.prepare(`
  INSERT INTO produtos (codigo_barras, nome, categoria_id, preco_centavos, estoque, estoque_minimo)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const atualizarProduto = db.prepare(`
  UPDATE produtos
     SET codigo_barras = ?, nome = ?, categoria_id = ?, preco_centavos = ?,
         estoque_minimo = ?, ativo = ?
   WHERE id = ?
`);
const mudarEstoque = db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');
const inserirMovimento = db.prepare(`
  INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, usuario_id, motivo)
  VALUES (?, ?, ?, ?, ?)
`);

// Devolve o id da categoria, criando se ainda não existir. Vazio = sem categoria.
function categoriaId(nome) {
  if (!nome) return null;
  inserirCategoria.run(nome);
  return buscarCategoria.get(nome).id;
}

// Confere o que veio da tela. Devolve { erro } ou { dados }.
function validarProduto(corpo, criando) {
  const c = corpo ?? {};

  const nome = typeof c.nome === 'string' ? c.nome.trim() : '';
  if (nome.length < 2 || nome.length > 80) {
    return { erro: 'O nome precisa ter de 2 a 80 caracteres.' };
  }

  let codigo = null;
  if (c.codigoBarras !== undefined && c.codigoBarras !== null && String(c.codigoBarras).trim() !== '') {
    codigo = String(c.codigoBarras).trim();
    if (!/^\d{1,20}$/.test(codigo)) {
      return { erro: 'Código de barras: use só números (até 20 dígitos).' };
    }
  }

  const categoria = typeof c.categoria === 'string' ? c.categoria.trim() : '';
  if (categoria.length > 40) return { erro: 'Nome de categoria muito longo (máximo 40).' };

  if (!Number.isInteger(c.precoCentavos) || c.precoCentavos < 1 || c.precoCentavos > 10_000_000) {
    return { erro: 'Preço inválido (de R$ 0,01 a R$ 100.000,00).' };
  }

  const estoqueMinimo = c.estoqueMinimo ?? 0;
  if (!Number.isInteger(estoqueMinimo) || estoqueMinimo < 0 || estoqueMinimo > 100_000) {
    return { erro: 'Estoque mínimo inválido.' };
  }

  let estoqueInicial = 0;
  if (criando) {
    estoqueInicial = c.estoqueInicial ?? 0;
    if (!Number.isInteger(estoqueInicial) || estoqueInicial < 0 || estoqueInicial > 1_000_000) {
      return { erro: 'Estoque inicial inválido.' };
    }
  }

  const ativo = typeof c.ativo === 'boolean' ? c.ativo : true;

  return { dados: { nome, codigo, categoria, precoCentavos: c.precoCentavos, estoqueMinimo, estoqueInicial, ativo } };
}

const criarProduto = db.transaction((d, usuarioId) => {
  const info = inserirProduto.run(
    d.codigo, d.nome, categoriaId(d.categoria), d.precoCentavos, d.estoqueInicial, d.estoqueMinimo
  );
  const id = Number(info.lastInsertRowid);
  if (d.estoqueInicial > 0) inserirMovimento.run(id, 'entrada', d.estoqueInicial, usuarioId, 'Estoque inicial');
  return id;
});

const editarProduto = db.transaction((id, d) => {
  atualizarProduto.run(d.codigo, d.nome, categoriaId(d.categoria), d.precoCentavos, d.estoqueMinimo, d.ativo ? 1 : 0, id);
});

const lancarMovimento = db.transaction((id, delta, tipo, usuarioId, motivo) => {
  mudarEstoque.run(delta, id);
  inserirMovimento.run(id, tipo, delta, usuarioId, motivo);
});

const comAtivoBoolean = (p) => ({ ...p, ativo: p.ativo === 1 });

// Lê o :id da URL (inteiro positivo) ou devolve null.
function lerId(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/produtos/gestao  -> TODOS os produtos (inclusive desativados)
router.get('/gestao', gestao, (req, res) => {
  res.json(listarGestao.all().map(comAtivoBoolean));
});

// GET /api/produtos/categorias  -> nomes das categorias (para o formulário)
router.get('/categorias', gestao, (req, res) => {
  res.json(listarCategorias.all().map((c) => c.nome));
});

// POST /api/produtos
// { "codigoBarras": "789...", "nome": "...", "categoria": "Bebidas",
//   "precoCentavos": 549, "estoqueMinimo": 10, "estoqueInicial": 40 }
router.post('/', gestao, (req, res) => {
  const v = validarProduto(req.body, true);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  const d = v.dados;

  if (d.codigo) {
    const em = codigoEmUso.get(d.codigo, 0);
    if (em) return res.status(409).json({ erro: `Este código de barras já é do produto "${em.nome}".` });
  }

  const id = criarProduto(d, req.usuario.id);
  res.status(201).json(comAtivoBoolean(lerGestao.get(id)));
});

// PUT /api/produtos/:id   (não mexe no estoque; para isso, use /:id/estoque)
router.put('/:id', gestao, (req, res) => {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'Id inválido.' });

  const atual = lerGestao.get(id);
  if (!atual) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const v = validarProduto(req.body, false);
  if (v.erro) return res.status(400).json({ erro: v.erro });
  const d = v.dados;

  // Preço é coisa de gerente.
  if (req.usuario.perfil !== 'gerente' && d.precoCentavos !== atual.precoCentavos) {
    return res.status(403).json({ erro: 'Só o gerente pode alterar preços.' });
  }

  if (d.codigo) {
    const em = codigoEmUso.get(d.codigo, id);
    if (em) return res.status(409).json({ erro: `Este código de barras já é do produto "${em.nome}".` });
  }

  editarProduto(id, d);
  res.json(comAtivoBoolean(lerGestao.get(id)));
});

// POST /api/produtos/:id/estoque
// Entrada de mercadoria:  { "tipo": "entrada", "quantidade": 12, "motivo": "Nota 123" }
// Contagem (ajuste):      { "tipo": "ajuste", "novoEstoque": 30, "motivo": "Contagem do mês" }
router.post('/:id/estoque', gestao, (req, res) => {
  const id = lerId(req);
  if (!id) return res.status(400).json({ erro: 'Id inválido.' });

  const atual = lerGestao.get(id);
  if (!atual) return res.status(404).json({ erro: 'Produto não encontrado.' });

  const { tipo, quantidade, novoEstoque } = req.body ?? {};
  const motivoBruto = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (motivoBruto.length > 200) return res.status(400).json({ erro: 'Motivo muito longo (máximo 200).' });

  if (tipo === 'entrada') {
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 1_000_000) {
      return res.status(400).json({ erro: 'Quantidade de entrada inválida.' });
    }
    lancarMovimento(id, quantidade, 'entrada', req.usuario.id, motivoBruto || 'Entrada de mercadoria');
  } else if (tipo === 'ajuste') {
    if (!Number.isInteger(novoEstoque) || novoEstoque < 0 || novoEstoque > 1_000_000) {
      return res.status(400).json({ erro: 'Informe o estoque contado (número inteiro, 0 ou mais).' });
    }
    if (motivoBruto.length < 3) {
      return res.status(400).json({ erro: 'Informe o motivo do ajuste (mínimo 3 caracteres).' });
    }
    const delta = novoEstoque - atual.estoque;
    if (delta === 0) return res.status(400).json({ erro: 'O estoque já está com esse valor.' });
    lancarMovimento(id, delta, 'ajuste', req.usuario.id, motivoBruto);
  } else {
    return res.status(400).json({ erro: 'Tipo inválido (use "entrada" ou "ajuste").' });
  }

  res.json(comAtivoBoolean(lerGestao.get(id)));
});

export default router;