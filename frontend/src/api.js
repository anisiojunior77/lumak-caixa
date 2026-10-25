const CHAVE = 'lumak.token';

export const token = {
  ler: () => localStorage.getItem(CHAVE),
  guardar: (t) => localStorage.setItem(CHAVE, t),
  apagar: () => localStorage.removeItem(CHAVE),
};

export class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const cabecalhos = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  const t = token.ler();
  if (t) cabecalhos.Authorization = `Bearer ${t}`;

  let resposta;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor.');
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ErroApi(resposta.status, dados?.erro ?? 'Erro inesperado.');
  return dados;
}