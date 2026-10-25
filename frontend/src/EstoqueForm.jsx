import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function EstoqueForm({ produto, aoSalvar, aoFechar }) {
  const [tipo, setTipo] = useState('entrada');     // 'entrada' | 'ajuste'
  const [quantidade, setQuantidade] = useState('');
  const [contado, setContado] = useState(String(produto.estoque));
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape' && !enviando) aoFechar();
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [enviando]);

  // Quanto vai ficar o estoque, para o operador conferir antes de salvar.
  const entrada = /^\d+$/.test(quantidade) ? Number(quantidade) : null;
  const previa = tipo === 'entrada'
    ? (entrada === null ? null : produto.estoque + entrada)
    : (/^\d+$/.test(contado) ? Number(contado) : null);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;

    let corpo;
    if (tipo === 'entrada') {
      if (entrada === null || entrada < 1) {
        setErro('Digite quantas unidades chegaram (número inteiro, 1 ou mais).');
        return;
      }
      corpo = { tipo, quantidade: entrada, motivo };
    } else {
      if (previa === null) {
        setErro('Digite o estoque contado (número inteiro, 0 ou mais).');
        return;
      }
      corpo = { tipo, novoEstoque: previa, motivo };
    }

    setErro('');
    setEnviando(true);
    try {
      await api(`/produtos/${produto.id}/estoque`, { metodo: 'POST', corpo });
      aoSalvar();
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fundo">
      <form className="modal" onSubmit={enviar}>
        <span className="rotulo">Estoque</span>
        <strong>{produto.nome}</strong>
        <span className="rotulo">Estoque atual: {produto.estoque}</span>

        <div className="formas dupla">
          <button type="button" className={'forma' + (tipo === 'entrada' ? ' ativa' : '')} onClick={() => setTipo('entrada')}>
            Entrada de mercadoria
          </button>
          <button type="button" className={'forma' + (tipo === 'ajuste' ? ' ativa' : '')} onClick={() => setTipo('ajuste')}>
            Contagem (ajuste)
          </button>
        </div>

        {tipo === 'entrada' ? (
          <label className="rotulo">
            Quantas unidades chegaram?
            <input
              className="campo campo-codigo"
              value={quantidade}
              onChange={(e) => { setQuantidade(e.target.value); setErro(''); }}
              inputMode="numeric"
              autoFocus
            />
          </label>
        ) : (
          <label className="rotulo">
            Estoque contado na prateleira
            <input
              className="campo campo-codigo"
              value={contado}
              onChange={(e) => { setContado(e.target.value); setErro(''); }}
              inputMode="numeric"
              autoFocus
            />
          </label>
        )}

        <label className="rotulo">
          Motivo {tipo === 'entrada' ? '(opcional, ex.: nota 123)' : '(obrigatório)'}
          <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>

        {previa !== null && <p className="nota">Estoque depois de salvar: <strong>{previa}</strong></p>}
        {erro && <p className="erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn-sec" onClick={aoFechar} disabled={enviando}>
            Voltar (Esc)
          </button>
          <button className="btn" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}