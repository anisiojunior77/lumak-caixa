import { Router } from 'express';
import db, { semAcento } from '../db/database.js';

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

export default router;