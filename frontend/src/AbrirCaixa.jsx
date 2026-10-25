import { useState } from 'react';
import { api } from './api.js';
import { paraCentavos } from './dinheiro.js';

export default function AbrirCaixa({ usuario, aoAbrir, aoSair }) {
  const [fundo, setFundo] = useState('100,00');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const fundoCentavos = paraCentavos(fundo);
    if (fundoCentavos === null) {
      setErro('Digite um valor válido, por exemplo 100,00');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const sessao = await api('/caixa/abrir', { metodo: 'POST', corpo: { fundoCentavos } });
      aoAbrir(sessao);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-centro">
      <form className="cartao" onSubmit={enviar}>
        <span className="rotulo">Operador: {usuario.nome}</span>
        <h1>Abrir caixa</h1>

        <label className="rotulo">
          Fundo de troco (R$)
          <input
            className="campo"
            value={fundo}
            onChange={(e) => setFundo(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button className="btn" disabled={enviando}>
          {enviando ? 'Abrindo…' : 'Abrir caixa'}
        </button>
        <button type="button" className="btn-sec" onClick={aoSair}>Sair</button>
      </form>
    </div>
  );
}