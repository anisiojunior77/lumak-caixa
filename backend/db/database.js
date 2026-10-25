import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const caminhoBanco = process.env.CAIXA_DB ?? path.join(pasta, 'caixa.db');

const db = new Database(caminhoBanco);
db.pragma('journal_mode = WAL');   // melhor para vários caixas lendo/gravando
db.pragma('foreign_keys = ON');    // o SQLite NÃO liga isso sozinho

// Cria as tabelas que ainda não existem (pode rodar quantas vezes quiser).
db.exec(readFileSync(path.join(pasta, 'schema.sql'), 'utf8'));

// Tira acentos e põe em minúsculas: "Açúcar" vira "acucar".
export function semAcento(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Ensina essa função ao SQL, para podermos escrever: WHERE sem_acento(nome) LIKE ...
db.function('sem_acento', { deterministic: true }, semAcento);

export default db;