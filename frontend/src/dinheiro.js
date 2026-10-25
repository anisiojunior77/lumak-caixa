const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 3888 -> "R$ 38,88"
export const formatar = (centavos) => brl.format(centavos / 100);

// "100,50" -> 10050   (retorna null se o texto não for um valor válido)
export function paraCentavos(texto) {
  const limpo = String(texto).trim().replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(parseFloat(limpo) * 100);
}