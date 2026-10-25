import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { exigirLogin, exigirPerfil } from '../auth.js';

const router = Router();
router.use(exigirLogin, exigirPerfil('caixa', 'gerente'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMAS = ['dinheiro', 'cartao', 'pix'];

// ---------- consultas preparadas ----------
const sessaoAberta = db.prepare(
  `SELECT id FROM sessoes_caixa WHERE usuario_id = ? AND status = 'aberta'`
);
const buscarProduto = db.prepare(
  'SELECT id, nome, preco_centavos FROM produtos WHERE id = ? AND ativo = 1'
);
const estoqueDe = db.prepare('SELECT estoque, estoque_minimo FROM produtos WHERE id = ?');

const inserirVenda = db.prepare(
  'INSERT INTO vendas (id, sessao_id, usuario_id, total_centavos) VALUES (?, ?, ?, ?)'
);
const inserirItem = db.prepare(`
  INSERT INTO venda_itens
    (id, venda_id, produto_id, nome_produto, preco_unit_centavos, quantidade, subtotal_centavos)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const baixarEstoque = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');
const inserirMovimento = db.prepare(`
  INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, usuario_id, venda_id)
  VALUES (?, 'venda', ?, ?, ?)
`);
const inserirPagamento = db.prepare(`
  INSERT INTO pagamentos (id, venda_id, forma, valor_centavos, recebido_centavos, troco_centavos)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const lerVendaCab = db.prepare(`
  SELECT rowid AS numero, id, usuario_id AS usuarioId, status,
         total_centavos AS totalCentavos, criado_em_dispositivo AS criadoEm
    FROM vendas WHERE id = ?
`);
const lerItens = db.prepare(`
  SELECT produto_id AS produtoId, nome_produto AS nome, quantidade,
         preco_unit_centavos AS precoUnitCentavos, subtotal_centavos AS subtotalCentavos
    FROM venda_itens WHERE venda_id = ? ORDER BY rowid
`);
const lerPagamento = db.prepare(`
  SELECT forma, valor_centavos AS valorCentavos,
         recebido_centavos AS recebidoCentavos, troco_centavos AS trocoCentavos
    FROM pagamentos WHERE venda_id = ?
`);

// Monta a venda completa (cabeçalho + itens + pagamento), ou null.
function lerVenda(id) {
  const cab = lerVendaCab.get(id);
  if (!cab) return null;
  return { ...cab, itens: lerItens.all(id), pagamento: lerPagamento.get(id) };
}

// ---------- validação do que o navegador mandou ----------
function validar(body) {
  const { id, itens, pagamento } = body ?? {};

  if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
    return { erro: 'Id da venda inválido.' };
  }
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 200) {
    return { erro: 'A venda precisa ter de 1 a 200 itens.' };
  }

  // Junta linhas repetidas do mesmo produto (2 leituras do leite = quantidade 2).
  const juntos = new Map();
  for (const it of itens) {
    if (!Number.isInteger(it?.produtoId) || !Number.isInteger(it?.quantidade) || it.quantidade < 1) {
      return { erro: 'Item inválido: informe produtoId e quantidade (inteiros, mínimo 1).' };
    }
    juntos.set(it.produtoId, (juntos.get(it.produtoId) ?? 0) + it.quantidade);
  }
  for (const quantidade of juntos.values()) {
    if (quantidade > 999) return { erro: 'Quantidade máxima por produto: 999.' };
  }

  if (!FORMAS.includes(pagamento?.forma)) {
    return { erro: 'Forma de pagamento inválida (dinheiro, cartao ou pix).' };
  }

  return {
    id,
    itens: [...juntos].map(([produtoId, quantidade]) => ({ produtoId, quantidade })),
    pagamento,
  };
}

// ---------- a gravação: tudo ou nada ----------
const gravarVenda = db.transaction((id, sessaoId, usuarioId, linhas, total, forma, recebido, troco) => {
  inserirVenda.run(id, sessaoId, usuarioId, total);
  for (const l of linhas) {
    inserirItem.run(randomUUID(), id, l.produtoId, l.nome, l.precoUnit, l.quantidade, l.subtotal);
    baixarEstoque.run(l.quantidade, l.produtoId);
    inserirMovimento.run(l.produtoId, -l.quantidade, usuarioId, id);
  }
  inserirPagamento.run(randomUUID(), id, forma, total, recebido, troco);
});

// POST /api/vendas
// { "itens": [{ "produtoId": 1, "quantidade": 2 }],
//   "pagamento": { "forma": "dinheiro", "recebidoCentavos": 5000 } }
router.post('/', (req, res) => {
  // Sem corpo (ou corpo que não virou objeto): diz exatamente o que chegou.
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      erro: 'Corpo ausente ou não é JSON.',
      recebido: {
        contentType: req.headers['content-type'] ?? null,
        tamanho: req.headers['content-length'] ?? null,
      },
    });
  }

  const v = validar(req.body);
  if (v.erro) return res.status(400).json({ erro: v.erro });

  // Reenvio da mesma venda (rede caiu, o app tentou de novo): devolve a que já existe.
  if (v.id) {
    const jaExiste = lerVenda(v.id);
    if (jaExiste) {
      if (jaExiste.usuarioId !== req.usuario.id) {
        return res.status(409).json({ erro: 'Este id de venda já está em uso.' });
      }
      return res.status(200).json({ ...jaExiste, repetida: true });
    }
  }

  const sessao = sessaoAberta.get(req.usuario.id);
  if (!sessao) return res.status(409).json({ erro: 'Abra o caixa antes de vender.' });

  // O PREÇO vem do banco, nunca do navegador.
  const linhas = [];
  for (const { produtoId, quantidade } of v.itens) {
    const p = buscarProduto.get(produtoId);
    if (!p) {
      return res.status(422).json({ erro: `Produto ${produtoId} não encontrado ou desativado.` });
    }
    linhas.push({
      produtoId: p.id,
      nome: p.nome,
      precoUnit: p.preco_centavos,
      quantidade,
      subtotal: p.preco_centavos * quantidade,
    });
  }
  const total = linhas.reduce((soma, l) => soma + l.subtotal, 0);

  // Pagamento e troco, calculados aqui.
  const forma = v.pagamento.forma;
  let recebido = null;
  let troco = 0;
  if (forma === 'dinheiro') {
    recebido = v.pagamento.recebidoCentavos;
    if (!Number.isInteger(recebido)) {
      return res.status(400).json({ erro: 'Informe o valor recebido em centavos.' });
    }
    if (recebido < total) {
      return res.status(400).json({ erro: 'Valor recebido menor que o total da venda.' });
    }
    troco = recebido - total;
  }

  const id = v.id ?? randomUUID();
  gravarVenda(id, sessao.id, req.usuario.id, linhas, total, forma, recebido, troco);

  // Avisos de estoque: só avisam, nunca bloqueiam a venda.
  const avisos = [];
  for (const l of linhas) {
    const e = estoqueDe.get(l.produtoId);
    if (e.estoque < 0) {
      avisos.push({ produtoId: l.produtoId, nome: l.nome, estoque: e.estoque, tipo: 'negativo' });
    } else if (e.estoque <= e.estoque_minimo) {
      avisos.push({ produtoId: l.produtoId, nome: l.nome, estoque: e.estoque, tipo: 'baixo' });
    }
  }

  res.status(201).json({ ...lerVenda(id), avisos });
});

// GET /api/vendas/:id  -> reabrir/reimprimir uma venda
router.get('/:id', (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ erro: 'Id inválido.' });

  const venda = lerVenda(req.params.id);
  if (!venda) return res.status(404).json({ erro: 'Venda não encontrada.' });

  // Operador só vê as próprias vendas. Gerente vê todas.
  if (req.usuario.perfil !== 'gerente' && venda.usuarioId !== req.usuario.id) {
    return res.status(403).json({ erro: 'Você não tem permissão para ver esta venda.' });
  }
  res.json(venda);
});

// ---------- cancelar venda ----------
const buscarGerente = db.prepare(
  `SELECT id, senha_hash FROM usuarios WHERE login = ? AND perfil = 'gerente' AND ativo = 1`
);
const HASH_FALSO = bcrypt.hashSync('uma-senha-que-ninguem-usa', 10);

const vendaParaCancelar = db.prepare(`
  SELECT v.status, v.usuario_id AS usuarioId, s.status AS statusSessao
    FROM vendas v JOIN sessoes_caixa s ON s.id = v.sessao_id
   WHERE v.id = ?
`);
const marcarCancelada = db.prepare(`
  UPDATE vendas
     SET status = 'cancelada', motivo_cancelamento = ?, cancelada_por = ?
   WHERE id = ? AND status = 'finalizada'
`);
const itensParaDevolver = db.prepare(
  'SELECT produto_id AS produtoId, quantidade FROM venda_itens WHERE venda_id = ?'
);
const devolverEstoque = db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');
const inserirMovCancelamento = db.prepare(`
  INSERT INTO movimentos_estoque (produto_id, tipo, quantidade, usuario_id, venda_id, motivo)
  VALUES (?, 'cancelamento', ?, ?, ?, ?)
`);

// Tudo ou nada: marca cancelada + devolve o estoque de cada item.
const gravarCancelamento = db.transaction((id, motivo, autorizadoPor, usuarioId) => {
  marcarCancelada.run(motivo, autorizadoPor, id);
  for (const it of itensParaDevolver.all(id)) {
    devolverEstoque.run(it.quantidade, it.produtoId);
    inserirMovCancelamento.run(it.produtoId, it.quantidade, usuarioId, id, motivo);
  }
});

// POST /api/vendas/:id/cancelar
// Gerente logado:  { "motivo": "Cliente desistiu" }
// Operador de caixa precisa da autorização de um gerente:
//   { "motivo": "...", "gerente": { "login": "gerente", "senha": "..." } }
router.post('/:id/cancelar', (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return res.status(400).json({ erro: 'Id inválido.' });

  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
  if (motivo.length < 3 || motivo.length > 200) {
    return res.status(400).json({ erro: 'Informe o motivo do cancelamento (3 a 200 caracteres).' });
  }

  const venda = vendaParaCancelar.get(id);
  if (!venda) return res.status(404).json({ erro: 'Venda não encontrada.' });

  // Operador só mexe nas próprias vendas.
  if (req.usuario.perfil !== 'gerente' && venda.usuarioId !== req.usuario.id) {
    return res.status(403).json({ erro: 'Você não tem permissão para cancelar esta venda.' });
  }

  // Quem autorizou: o próprio gerente logado, ou o gerente que digitou a senha no caixa.
  let autorizadoPor;
  if (req.usuario.perfil === 'gerente') {
    autorizadoPor = req.usuario.id;
  } else {
    const { login, senha } = req.body?.gerente ?? {};
    const g = typeof login === 'string' ? buscarGerente.get(login.trim().toLowerCase()) : undefined;
    const confere = bcrypt.compareSync(
      typeof senha === 'string' ? senha : '',
      g ? g.senha_hash : HASH_FALSO
    );
    if (!g || !confere) {
      return res.status(403).json({ erro: 'Autorização do gerente inválida.' });
    }
    autorizadoPor = g.id;
  }

  if (venda.status === 'cancelada') {
    return res.status(409).json({ erro: 'Esta venda já foi cancelada.' });
  }
  if (venda.statusSessao !== 'aberta') {
    return res.status(409).json({ erro: 'O caixa desta venda já foi fechado. Não dá mais para cancelar.' });
  }

  gravarCancelamento(id, motivo, autorizadoPor, req.usuario.id);
  res.json(lerVenda(id));
});

export default router;