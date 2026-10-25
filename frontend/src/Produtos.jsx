import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { formatar } from './dinheiro.js';
import ProdutoForm from './ProdutoForm.jsx';
import EstoqueForm from './EstoqueForm.jsx';

// Tira acentos e deixa minúsculo, para "pao" achar "Pão".
const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Produtos({ usuario, aoSair }) {
  const [lista, setLista] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [inativos, setInativos] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);   // null | 'novo' | um produto
  const [movendo, setMovendo] = useState(null);     // produto que vai receber entrada/ajuste

  const ehGerente = usuario.perfil === 'gerente';

  async function carregar() {
    try {
      const [p, c] = await Promise.all([api('/produtos/gestao'), api('/produtos/categorias')]);
      setLista(p);
      setCategorias(c);
      setErro('');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const visiveis = useMemo(() => {
    const f = norm(filtro.trim());
    return lista.filter(
      (p) =>
        (inativos || p.ativo) &&
        (!f || norm(p.nome).includes(f) || (p.codigoBarras ?? '').includes(f) || norm(p.categoria).includes(f))
    );
  }, [lista, filtro, inativos]);

  const baixos = lista.filter((p) => p.ativo && p.estoque <= p.estoqueMinimo).length;

  function aoSalvar() {
    setEditando(null);
    setMovendo(null);
    carregar();
  }

  return (
    <>
      <header className="topo">
        <span className="marca">◆ LUMAK · PRODUTOS</span>
        <span className="rotulo">{usuario.nome}</span>
        <div className="topo-dir">
          {ehGerente && <a className="btn-sec" href="#/">← Caixa</a>}
          <button className="btn-sec" onClick={aoSair}>Sair</button>
        </div>
      </header>

      <main className="pagina">
        <div className="barra">
          <input
            className="campo"
            placeholder="Filtrar por nome, código ou categoria"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            autoFocus
          />
          <label className="check">
            <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} />
            Mostrar desativados
          </label>
          <button className="btn btn-auto" onClick={() => setEditando('novo')}>+ Novo produto</button>
        </div>

        {erro && <p className="erro">{erro}</p>}
        <span className="rotulo">
          {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'}
          {baixos > 0 && ` · ${baixos} com estoque baixo`}
        </span>

        <div className="lista">
          {carregando ? (
            <p className="vazio">Carregando…</p>
          ) : visiveis.length === 0 ? (
            <p className="vazio">Nenhum produto encontrado.</p>
          ) : (
            <table className="itens">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="num">Preço</th>
                  <th className="num">Estoque</th>
                  <th className="num">Mín.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((p) => (
                  <tr key={p.id} className={p.ativo ? '' : 'inativo'}>
                    <td className="mono">{p.codigoBarras ?? '—'}</td>
                    <td>{p.nome}{!p.ativo && ' (desativado)'}</td>
                    <td>{p.categoria ?? '—'}</td>
                    <td className="num">{formatar(p.precoCentavos)}</td>
                    <td className={'num ' + (p.estoque < 0 ? 'estoque-neg' : p.estoque <= p.estoqueMinimo ? 'estoque-baixo' : '')}>
                      {p.estoque}
                    </td>
                    <td className="num">{p.estoqueMinimo}</td>
                    <td className="acoes-linha">
                      <button className="btn-peq" onClick={() => setMovendo(p)}>Estoque</button>
                      <button className="btn-peq" onClick={() => setEditando(p)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {editando && (
        <ProdutoForm
          produto={editando === 'novo' ? null : editando}
          categorias={categorias}
          ehGerente={ehGerente}
          aoSalvar={aoSalvar}
          aoFechar={() => setEditando(null)}
        />
      )}
      {movendo && (
        <EstoqueForm produto={movendo} aoSalvar={aoSalvar} aoFechar={() => setMovendo(null)} />
      )}
    </>
  );
}