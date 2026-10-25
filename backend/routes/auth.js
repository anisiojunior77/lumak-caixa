import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { criarToken, exigirLogin } from '../auth.js';

const router = Router();

const buscarUsuario = db.prepare(
  'SELECT id, nome, login, perfil, senha_hash FROM usuarios WHERE login = ? AND ativo = 1'
);

// Hash de mentira: quando o login não existe, comparamos com ele mesmo assim,
// para a resposta demorar igual e ninguém descobrir quais logins existem.
const HASH_FALSO = bcrypt.hashSync('uma-senha-que-ninguem-usa', 10);

router.post('/login', (req, res) => {
  const { login, senha } = req.body ?? {};

  if (typeof login !== 'string' || typeof senha !== 'string' || !login || !senha || senha.length > 72) {
    return res.status(400).json({ erro: 'Informe usuário e senha.' });
  }

  const usuario = buscarUsuario.get(login.trim().toLowerCase());
  const confere = bcrypt.compareSync(senha, usuario ? usuario.senha_hash : HASH_FALSO);

  if (!usuario || !confere) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }

  res.json({
    token: criarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil },
  });
});

// Quem sou eu? O front usa ao abrir, para saber se o token ainda vale.
router.get('/eu', exigirLogin, (req, res) => {
  res.json(req.usuario);
});

export default router;