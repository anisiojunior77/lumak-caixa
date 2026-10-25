import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { exigirLogin, exigirPerfil } from '../auth.js';

const router = Router();

// Tudo daqui exige login e perfil de caixa ou gerente.
router.use(exigirLogin, exigirPerfil('caixa', 'gerente'));

const sessaoAberta = db.prepare(`
  SELECT id,
         usuario_id     AS usuarioId,
         aberto_em      AS abertoEm,
         fundo_centavos AS fundoCentavos
    FROM sessoes_caixa
   WHERE usuario_id = ? AND status = 'aberta'
`);

// GET /api/caixa/atual  -> a sessão aberta deste usuário, ou null
router.get('/atual', (req, res) => {
  res.json(sessaoAberta.get(req.usuario.id) ?? null);
});

// POST /api/caixa/abrir  { "fundoCentavos": 10000 }
router.post('/abrir', (req, res) => {
  const fundo = req.body?.fundoCentavos ?? 0;

  if (!Number.isInteger(fundo) || fundo < 0 || fundo > 100_000_00) {
    return res.status(400).json({ erro: 'Fundo de troco inválido.' });
  }
  if (sessaoAberta.get(req.usuario.id)) {
    return res.status(409).json({ erro: 'Você já tem um caixa aberto.' });
  }

  db.prepare('INSERT INTO sessoes_caixa (id, usuario_id, fundo_centavos) VALUES (?, ?, ?)')
    .run(randomUUID(), req.usuario.id, fundo);

  res.status(201).json(sessaoAberta.get(req.usuario.id));
});

// ---------- fechar o caixa ----------
// Só o dinheiro físico entra na conta da gaveta (Pix e cartão não).
// O troco já saiu da gaveta, por isso conta o valor da venda, não o recebido.
const somaDinheiro = db.prepare(`
  SELECT COALESCE(SUM(p.valor_centavos), 0) AS total
    FROM pagamentos p JOIN vendas v ON v.id = p.venda_id
   WHERE v.sessao_id = ? AND v.status = 'finalizada' AND p.forma = 'dinheiro'
`);
const resumoPorForma = db.prepare(`
  SELECT p.forma, COUNT(*) AS vendas, SUM(p.valor_centavos) AS totalCentavos
    FROM pagamentos p JOIN vendas v ON v.id = p.venda_id
   WHERE v.sessao_id = ? AND v.status = 'finalizada'
   GROUP BY p.forma ORDER BY p.forma
`);
const contarCanceladas = db.prepare(
  `SELECT COUNT(*) AS n FROM vendas WHERE sessao_id = ? AND status = 'cancelada'`
);
const fecharSessao = db.prepare(`
  UPDATE sessoes_caixa
     SET status = 'fechada', fechado_em = datetime('now', 'localtime'),
         contado_centavos = ?, esperado_centavos = ?
   WHERE id = ? AND status = 'aberta'
`);

// POST /api/caixa/fechar  { "contadoCentavos": 14888 }
router.post('/fechar', (req, res) => {
  const contado = req.body?.contadoCentavos;
  if (!Number.isInteger(contado) || contado < 0 || contado > 100_000_00 * 100) {
    return res.status(400).json({ erro: 'Informe o valor contado na gaveta, em centavos.' });
  }

  const sessao = sessaoAberta.get(req.usuario.id);
  if (!sessao) return res.status(409).json({ erro: 'Você não tem caixa aberto.' });

  const dinheiro = somaDinheiro.get(sessao.id).total;
  const esperado = sessao.fundoCentavos + dinheiro;
  fecharSessao.run(contado, esperado, sessao.id);

  res.json({
    sessaoId: sessao.id,
    fundoCentavos: sessao.fundoCentavos,
    dinheiroDasVendasCentavos: dinheiro,
    esperadoCentavos: esperado,
    contadoCentavos: contado,
    diferencaCentavos: contado - esperado,   // negativo = faltou, positivo = sobrou
    porForma: resumoPorForma.all(sessao.id),
    vendasCanceladas: contarCanceladas.get(sessao.id).n,
  });
});

export default router;