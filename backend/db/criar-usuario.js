import bcrypt from 'bcryptjs';
import db from './database.js';

// Uso: node db/criar-usuario.js <login> <senha> <caixa|gerente|estoquista> [nome completo]
const [loginBruto, senha, perfil, ...resto] = process.argv.slice(2);
const PERFIS = ['caixa', 'gerente', 'estoquista'];

if (!loginBruto || !senha || !PERFIS.includes(perfil)) {
  console.log('Uso: npm run usuario -- <login> <senha> <caixa|gerente|estoquista> [nome completo]');
  process.exit(1);
}
if (senha.length < 6 || senha.length > 72) {
  console.log('A senha precisa ter de 6 a 72 caracteres.');
  process.exit(1);
}

const login = loginBruto.trim().toLowerCase();
const nome = resto.join(' ').trim() || login;
const hash = bcrypt.hashSync(senha, 10);

const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login);
if (existente) {
  db.prepare('UPDATE usuarios SET senha_hash = ?, perfil = ?, nome = ?, ativo = 1 WHERE id = ?')
    .run(hash, perfil, nome, existente.id);
  console.log(`Usuário "${login}" atualizado (${perfil}).`);
} else {
  db.prepare('INSERT INTO usuarios (nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?)')
    .run(nome, login, hash, perfil);
  console.log(`Usuário "${login}" criado (${perfil}).`);
}