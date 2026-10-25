// Cria um identificador único para cada venda (UUID versão 4).
// O servidor usa esse id para não gravar a mesma venda duas vezes,
// mesmo que a internet caia e o caixa tente de novo.
export function novoId() {
  // crypto.randomUUID só existe em páginas seguras (https ou localhost).
  // Na rede da loja (http://192.168...) ele não existe, por isso o plano B:
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;   // marca como versão 4
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}