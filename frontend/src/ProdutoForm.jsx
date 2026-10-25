import { useEffect, useState } from 'react';
import { api } from './api.js';
import { paraCentavos } from './dinheiro.js';

// 549 -> "5,49"
const emReais = (centavos) => (centavos / 100).toFixed(2).replace('.', ',');

export default function ProdutoForm({ produto, categorias, ehGerente, aoSalvar, aoFechar }) {
  const novo = !produto;
  const [codigo, setCodigo] = useState(produto?.codigoBarras ?? '');
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [categoria, setCategoria] = useState(produto?.categoria ?? '');
  const [preco, setPreco] = useState(produto ? emReais(produto.precoCentavos) : '');
  const [minimo, setMinimo] = useState(String(produto?.estoqueMinimo ?? 0));
  const [inicial, setInicial] = useState('0');
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape' && !enviando) aoFechar();
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [enviando]);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;

    const precoCentavos = paraCentavos(preco);
    if (precoCentavos === null || precoCentavos < 1) {
      setErro('Digite um preço válido, por exemplo 5,49');
      return;
    }
    if (!/^\d+$/.test(minimo) || (novo && !/^\d+$/.test(inicial))) {
      setErro('Estoque: use só números inteiros (0 ou mais).');
      return;
    }

    const corpo = {
      codigoBarras: codigo.trim(),
      nome,
      categoria,
      precoCentavos,
      estoqueMinimo: Number(minimo),
    };
    if (novo) corpo.estoqueInicial = Number(inicial);
    else corpo.ativo = ativo;

    setErro('');
    setEnviando(true);
    try {
      await api(novo ? '/produtos' : `/produtos/${produto.id}`, {
        metodo: novo ? 'POST' : 'PUT',
        corpo,
      });
      aoSalvar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fundo">
      <form className="modal modal-largo" onSubmit={enviar}>
        <span className="rotulo">{novo ? 'Novo produto' : 'Editar produto'}</span>

        <div className="form-grade">
          <label className="rotulo span2">
            Nome
            <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>

          <label className="rotulo">
            Código de barras
            <input
              className="campo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Vazio para pão, fruta…"
              inputMode="numeric"
            />
          </label>

          <label className="rotulo">
            Categoria
            <input
              className="campo"
              list="lista-categorias"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
            <datalist id="lista-categorias">
              {categorias.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>

          <label className="rotulo">
            Preço (R$)
            <input
              className="campo"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              inputMode="decimal"
              disabled={!novo && !ehGerente}
            />
          </label>

          <label className="rotulo">
            Estoque mínimo
            <input
              className="campo"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
              inputMode="numeric"
            />
          </label>

          {novo && (
            <label className="rotulo span2">
              Estoque inicial (quantas unidades já existem)
              <input
                className="campo"
                value={inicial}
                onChange={(e) => setInicial(e.target.value)}
                inputMode="numeric"
              />
            </label>
          )}
        </div>

        {!novo && !ehGerente && <p className="nota">Só o gerente pode alterar o preço.</p>}
        {!novo && (
          <label className="check">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Produto ativo (desativado não aparece no caixa)
          </label>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn-sec" onClick={aoFechar} disabled={enviando}>
            Voltar (Esc)
          </button>
          <button className="btn" disabled={enviando || nome.trim().length < 2 || preco.trim() === ''}>
            {enviando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}