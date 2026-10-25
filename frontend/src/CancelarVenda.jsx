import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatar } from './dinheiro.js';

export default function CancelarVenda({ venda, ehGerente, aoFechar, aoCancelada }) {
  const [motivo, setMotivo] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape' && !enviando) {
        e.preventDefault();
        aoFechar();
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [enviando]);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    setEnviando(true);
    try {
      const corpo = { motivo };
      if (!ehGerente) corpo.gerente = { login, senha };   // operador precisa de um gerente
      await api(`/vendas/${venda.id}/cancelar`, { metodo: 'POST', corpo });
      aoCancelada();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  const faltaPreencher = motivo.trim().length < 3 || (!ehGerente && (!login || !senha));

  return (
    <div className="modal-fundo">
      <form className="modal" onSubmit={enviar}>
        <span className="rotulo">Cancelar venda nº {venda.numero}</span>
        <div className="total-ok">{formatar(venda.totalCentavos)}</div>

        <label className="rotulo">
          Motivo
          <input
            className="campo"
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setErro(''); }}
            placeholder="Ex.: cliente desistiu"
            autoComplete="off"
            autoFocus
          />
        </label>

        {!ehGerente && (
          <>
            <p className="nota">Peça a um gerente para digitar o usuário e a senha dele.</p>
            <label className="rotulo">
              Usuário do gerente
              <input
                className="campo"
                value={login}
                onChange={(e) => { setLogin(e.target.value); setErro(''); }}
                autoComplete="off"
              />
            </label>
            <label className="rotulo">
              Senha do gerente
              <input
                className="campo"
                type="password"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(''); }}
                autoComplete="off"
              />
            </label>
          </>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn-sec" onClick={aoFechar} disabled={enviando}>
            Voltar (Esc)
          </button>
          <button className="btn" disabled={enviando || faltaPreencher}>
            {enviando ? 'Cancelando…' : 'Cancelar a venda'}
          </button>
        </div>
      </form>
    </div>
  );
}