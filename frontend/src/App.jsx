import { useEffect, useState } from 'react';
import { api, token } from './api.js';
import Login from './Login.jsx';
import AbrirCaixa from './AbrirCaixa.jsx';
import Venda from './Venda.jsx';
import Produtos from './Produtos.jsx';
import { formatar } from './dinheiro.js';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [sessao, setSessao] = useState(null);     // caixa aberto (ou null)
  const [carregando, setCarregando] = useState(true);
  const [rota, setRota] = useState(window.location.hash);   // "#/produtos" ou vazio

  function sair() {
    token.apagar();
    setUsuario(null);
    setSessao(null);
  }

  // Acompanha o endereço (#/produtos ou #/).
  useEffect(() => {
    const mudou = () => setRota(window.location.hash);
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);

  // Ao abrir o programa: o token guardado ainda vale?
  useEffect(() => {
    if (!token.ler()) {
      setCarregando(false);
      return;
    }
    (async () => {
      try {
        const eu = await api('/auth/eu');
        setUsuario(eu);
        if (eu.perfil !== 'estoquista') setSessao(await api('/caixa/atual'));
      } catch {
        token.apagar();
        setUsuario(null);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  async function aoEntrar(u) {
    setUsuario(u);
    if (u.perfil === 'estoquista') return;      // estoquista não opera caixa
    try {
      setSessao(await api('/caixa/atual'));
    } catch {
      sair();
    }
  }

  if (carregando) return null;
  if (!usuario) return <Login aoEntrar={aoEntrar} />;

  const ehGestor = usuario.perfil === 'gerente' || usuario.perfil === 'estoquista';
  const querProdutos = rota === '#/produtos' || usuario.perfil === 'estoquista';

  if (querProdutos) {
    if (!ehGestor) {
      return (
        <div className="tela-centro">
          <div className="cartao">
            <h1>Sem permissão</h1>
            <p>Só gerente e estoquista cadastram produtos.</p>
            <a className="btn-sec" href="#/">Voltar ao caixa</a>
          </div>
        </div>
      );
    }
    return <Produtos usuario={usuario} aoSair={sair} />;
  }

  if (!sessao) return <AbrirCaixa usuario={usuario} aoAbrir={setSessao} aoSair={sair} />;

  return (
    <>
      <header className="topo">
        <span className="marca">◆ LUMAK CAIXA</span>
        <span className="rotulo">
          {usuario.nome} · fundo {formatar(sessao.fundoCentavos)}
        </span>
        <div className="topo-dir">
          {usuario.perfil === 'gerente' && (
            <a className="btn-sec" href="#/produtos" target="_blank" rel="noopener">Produtos</a>
          )}
          <button className="btn-sec" onClick={sair}>Sair</button>
        </div>
      </header>
      <Venda usuario={usuario} aoCaixaFechado={sair} />
    </>
  );
}