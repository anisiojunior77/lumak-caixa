import express from 'express';
import cors from 'cors';
import db from './db/database.js';
import { exigirLogin } from './auth.js';
import authRouter from './routes/auth.js';
import caixaRouter from './routes/caixa.js';
import produtosRouter from './routes/produtos.js';
import vendasRouter from './routes/vendas.js';

const app = express();
const PORTA = process.env.PORT ?? 3002;

// 1) Primeiro os "leitores" que valem para TODAS as rotas.
app.use(cors());          // em desenvolvimento, aceita qualquer origem
app.use(express.json());  // entende JSON no corpo das requisições

// 2) Depois as rotas.
app.get('/api/saude', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM produtos').get();
  res.json({ ok: true, produtos: n });
});

app.use('/api/auth', authRouter);                      // login (público)
app.use('/api/caixa', caixaRouter);                    // abrir caixa (logado)
app.use('/api/produtos', exigirLogin, produtosRouter); // produtos (logado)
app.use('/api/vendas', vendasRouter);                  // vendas (caixa ou gerente)

// 3) Por último: rota inexistente e tratamento de erros.
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// '0.0.0.0' deixa outros computadores da rede da loja acessarem.
app.listen(PORTA, '0.0.0.0', () => {
  console.log(`Lumak Caixa API rodando em http://localhost:${PORTA}`);
});