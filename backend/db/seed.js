import db from './database.js';

const categorias = ['Mercearia', 'Bebidas', 'Limpeza', 'Higiene', 'Padaria'];

// [código de barras, nome, categoria, preço em CENTAVOS, estoque, estoque mínimo]
const produtos = [
  ['7891000100103', 'Leite Integral 1L',         'Mercearia',  549, 40, 10],
  ['7891000200202', 'Arroz Tipo 1 5kg',          'Mercearia', 2790, 20,  5],
  ['7891000300301', 'Feijão Carioca 1kg',        'Mercearia',  849, 30,  8],
  ['7891000400400', 'Café Torrado 500g',         'Mercearia', 1890, 25,  6],
  ['7891000500509', 'Açúcar Refinado 1kg',       'Mercearia',  479, 35, 10],
  ['7891000600608', 'Óleo de Soja 900ml',        'Mercearia',  749, 30,  8],
  ['7891000700707', 'Macarrão Espaguete 500g',   'Mercearia',  459, 40, 10],
  ['7891000800806', 'Biscoito Recheado 130g',    'Mercearia',  299, 60, 15],
  ['7891000900905', 'Refrigerante Cola 2L',      'Bebidas',   1099, 24,  6],
  ['7891001001002', 'Suco de Laranja 1L',        'Bebidas',    799, 18,  6],
  ['7891001101101', 'Água Mineral 1,5L',         'Bebidas',    249, 48, 12],
  ['7891001201200', 'Detergente 500ml',          'Limpeza',    249, 36, 10],
  ['7891001301309', 'Sabão em Pó 1kg',           'Limpeza',   1290, 15,  4],
  ['7891001401408', 'Sabonete 90g',              'Higiene',    199, 50, 12],
  ['7891001501507', 'Creme Dental 90g',          'Higiene',    399, 30,  8],
  ['7891001601606', 'Papel Higiênico 12 rolos',  'Higiene',   1990, 12,  4],
  ['7891001701705', 'Pão de Forma 500g',         'Padaria',    899, 10,  4],
];

const inserirCategoria = db.prepare('INSERT OR IGNORE INTO categorias (nome) VALUES (?)');
const buscarCategoria  = db.prepare('SELECT id FROM categorias WHERE nome = ?');
const inserirProduto   = db.prepare(`
  INSERT OR IGNORE INTO produtos
    (codigo_barras, nome, categoria_id, preco_centavos, estoque, estoque_minimo)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// Transação: ou grava tudo, ou nada.
const carregar = db.transaction(() => {
  for (const nome of categorias) inserirCategoria.run(nome);
  for (const [codigo, nome, categoria, preco, estoque, minimo] of produtos) {
    const { id } = buscarCategoria.get(categoria);
    inserirProduto.run(codigo, nome, id, preco, estoque, minimo);
  }
});

carregar();

const { n } = db.prepare('SELECT COUNT(*) AS n FROM produtos').get();
console.log(`Pronto: ${n} produtos no banco.`);