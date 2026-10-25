import jwt from 'jsonwebtoken';
import db from './db/database.js';

const SEGREDO = process.env.JWT_SEGREDO;
if (!SEGREDO || SEGREDO.length < 32) {
  console.error('ERRO: defina JWT_SEGREDO (32+ caracteres) no arquivo backend/.env');
  process.exit(1);
}

const buscarUsuario = db.prepare(
  'SELECT id, nome, login, perfil FROM usuarios WHERE id = ? AND ativo = 1'
);

export function criarToken(usuario) {
  return jwt.sign({ id: usuario.id }, SEGREDO, { expiresIn: '12h' });
}

// Middleware: só deixa passar quem mandou um token válido.
export function exigirLogin(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  let dados;
  try {
    dados = jwt.verify(token, SEGREDO);
  } catch {
    return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }

  // Confere no banco a cada requisição: usuário desativado perde o acesso na hora.
  const usuario = buscarUsuario.get(dados.id);
  if (!usuario) {
    return res.status(401).json({ erro: 'Usuário inativo ou inexistente.' });
  }

  req.usuario = usuario;
  next();


  try {
    const dados = jwt.verify(token, SEGREDO);
    // Confere no banco a cada requisição: usuário desativado perde o acesso na hora.
    const usuario = buscarUsuario.get(dados.id);
    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário inativo ou inexistente.' });
    }
    req.usuario = usuario;
    next();
  } catch {
    res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
  }
}

// Middleware: só deixa passar os perfis permitidos. Use DEPOIS de exigirLogin.
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para isso.' });
    }
    next();
  };
}