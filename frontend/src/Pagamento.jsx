import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { formatar, paraCentavos } from './dinheiro.js';
import { novoId } from './uuid.js';

const FORMAS = [
  { id: 'dinheiro', nome: 'Dinheiro', tecla: 'D' },
  { id: 'pix', nome: 'Pix', tecla: 'P' },
  { id: 'cartao', nome: 'Cartão', tecla: 'C' },
];

export default function Pagamento({ itens, total, aoCancelar, aoConcluir }) {
  const [forma, setForma] = useState('dinheiro');
  const [recebido, setRecebido] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);   // a venda gravada, quando der certo

  // O id nasce UMA vez, quando a tela abre. Se precisar tentar de novo, é o mesmo id.
  const [idVenda] = useState(() => novoId());
  const ocupado = useRef(false);
  const campo = useRef(null);
  const confirmarRef = useRef(null);

  // Dinheiro: campo vazio = valor exato.
  const recebidoCentavos = recebido.trim() === '' ? total : paraCentavos(recebido);
  const insuficiente =
    forma === 'dinheiro' && (recebidoCentavos === null || recebidoCentavos < total);
  const troco = forma === 'dinheiro' && recebidoCentavos !== null ? recebidoCentavos - total : 0;

  async function confirmar() {
    if (ocupado.current || resultado) return;       // evita clique/Enter duplo
    if (insuficiente) {
      setErro('O valor recebido é menor que o total.');
      return;
    }
    ocupado.current = true;
    setErro('');
    setEnviando(true);
    try {
      const pagamento = forma === 'dinheiro' ? { forma, recebidoCentavos } : { forma };
      const venda = await api('/vendas', {
        metodo: 'POST',
        corpo: {
          id: idVenda,
          itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
          pagamento,
        },
      });
      setResultado(venda);
    } catch (err) {
      setErro(
        err.status === 0
          ? 'Sem conexão com o servidor. Tente de novo: a venda não será duplicada.'
          : err.message
      );
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }
  confirmarRef.current = confirmar;   // o atalho de teclado sempre chama a versão mais nova

  // Volta o foco para o campo quando troca para dinheiro.
  useEffect(() => {
    if (forma === 'dinheiro') campo.current?.focus();
  }, [forma]);

  // Teclado: D, P, C trocam a forma; Enter confirma; Esc volta.
  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Enter') {
        if (document.activeElement?.tagName === 'BUTTON') return;   // o botão cuida do próprio Enter
        e.preventDefault();
                if (resultado) aoConcluir(resultado);
        else confirmarRef.current();
        return;
      }
      if (resultado) return;
      if (e.key === 'Escape' && !enviando) {
        e.preventDefault();
        aoCancelar();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const f = FORMAS.find((x) => x.tecla.toLowerCase() === e.key.toLowerCase());
      if (f && !enviando) {
        e.preventDefault();          // a letra não entra no campo do valor
        setForma(f.id);
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [resultado, enviando]);

  // ---------- venda gravada ----------
  if (resultado) {
    const ehDinheiro = resultado.pagamento?.forma === 'dinheiro';
    return (
      <div className="modal-fundo">
        <div className="modal">
          <span className="rotulo">
            Venda nº {resultado.numero} concluída{resultado.repetida ? ' (já estava gravada)' : ''}
          </span>
          <div className="total-ok">{formatar(resultado.totalCentavos)}</div>

          {ehDinheiro && (
            <>
              <span className="rotulo">Troco</span>
              <div className="troco">{formatar(resultado.pagamento.trocoCentavos)}</div>
            </>
          )}

          {resultado.avisos?.map((a) => (
            <p className="aviso-est" key={a.produtoId}>
              {a.tipo === 'negativo' ? 'Estoque negativo' : 'Estoque baixo'}: {a.nome} ({a.estoque})
            </p>
          ))}

                    <button type="button" className="btn" onClick={() => aoConcluir(resultado)}>
            Nova venda (Enter)
          </button>
        </div>
      </div>
    );
  }

  // ---------- escolher como pagar ----------
  return (
    <div className="modal-fundo">
      <form className="modal" onSubmit={(e) => e.preventDefault()}>
        <span className="rotulo">Pagamento</span>
        <div className="total-pagar">{formatar(total)}</div>

        <div className="formas">
          {FORMAS.map((f) => (
            <button
              type="button"
              key={f.id}
              className={'forma' + (f.id === forma ? ' ativa' : '')}
              onClick={() => setForma(f.id)}
            >
              <kbd>{f.tecla}</kbd> {f.nome}
            </button>
          ))}
        </div>

        {forma === 'dinheiro' && (
          <>
            <label className="rotulo">
              Valor recebido (R$). Vazio = valor exato
              <input
                ref={campo}
                className="campo campo-codigo"
                value={recebido}
                onChange={(e) => { setRecebido(e.target.value); setErro(''); }}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
              />
            </label>
            {insuficiente ? (
              <div className="faltam">
                {recebidoCentavos === null
                  ? 'Valor inválido'
                  : `Faltam ${formatar(total - recebidoCentavos)}`}
              </div>
            ) : (
              <div className="troco">Troco {formatar(troco)}</div>
            )}
          </>
        )}

        {forma === 'pix' && (
          <p className="nota">Confirme que o Pix caiu na conta antes de continuar.</p>
        )}
        {forma === 'cartao' && (
          <p className="nota">Passe o valor na maquininha e só confirme depois de aprovado.</p>
        )}

        {erro && <p className="erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn-sec" onClick={aoCancelar} disabled={enviando}>
            Voltar (Esc)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => confirmarRef.current()}
            disabled={enviando || insuficiente}
          >
            {enviando ? 'Gravando…' : 'Confirmar (Enter)'}
          </button>
        </div>
      </form>
    </div>
  );
}