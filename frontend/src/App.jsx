import { useEffect, useState } from 'react';
import { api, token } from './api.js';
import Login from './Login.jsx';
import AbrirCaixa from './AbrirCaixa.jsx';
import { formatar } from './dinheiro.js';
import Venda from './Venda.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [sessao, setSessao] = useState(null);     // caixa aberto (ou null)
  const [carregando, setCarregando] = useState(true);

  function sair() {
    token.apagar();
    setUsuario(null);
    setSessao(null);
  }

  // Ao abrir o programa: o token guardado ainda vale?
  useEffect(() => {
    if (!token.ler()) {
      setCarregando(false);
      return;
    }
    (async () => {
      try {
        setUsuario(await api('/auth/eu'));
        setSessao(await api('/caixa/atual'));
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
    try {
      setSessao(await api('/caixa/atual'));
    } catch {
      sair();
    }
  }

  if (carregando) return null;
  if (!usuario) return <Login aoEntrar={aoEntrar} />;
  if (!sessao) return <AbrirCaixa usuario={usuario} aoAbrir={setSessao} aoSair={sair} />;

  return (
    <>
      <header className="topo">
        <span className="marca">◆ LUMAK CAIXA</span>
        <span className="rotulo">
          {usuario.nome} · fundo {formatar(sessao.fundoCentavos)}
        </span>
        <button className="btn-sec" onClick={sair}>Sair</button>
      </header>
                <Venda usuario={usuario} aoCaixaFechado={sair} />  
    </>
  );
}