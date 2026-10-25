import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatar, paraCentavos } from './dinheiro.js';

const NOMES = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' };

export default function FecharCaixa({ aoCancelar, aoConcluir }) {
  const [contado, setContado] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resumo, setResumo] = useState(null);     // vem do servidor depois de fechar

  useEffect(() => {
    function tecla(e) {
      if (e.key === 'Escape' && !resumo && !enviando) {
        e.preventDefault();
        aoCancelar();
      } else if (e.key === 'Enter' && resumo && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        aoConcluir();
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [resumo, enviando]);

  async function fechar(e) {
    e.preventDefault();
    if (enviando) return;
    const contadoCentavos = paraCentavos(contado);
    if (contadoCentavos === null) {
      setErro('Digite o valor contado na gaveta, por exemplo 138,00');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      setResumo(await api('/caixa/fechar', { metodo: 'POST', corpo: { contadoCentavos } }));
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // ---------- resultado do fechamento ----------
  if (resumo) {
    const dif = resumo.diferencaCentavos;
    return (
      <div className="modal-fundo">
        <div className="modal">
          <span className="rotulo">Caixa fechado</span>

          <div className="resumo">
            <div><span>Fundo de troco</span><span>{formatar(resumo.fundoCentavos)}</span></div>
            <div><span>Dinheiro das vendas</span><span>{formatar(resumo.dinheiroDasVendasCentavos)}</span></div>
            <div><span>Esperado na gaveta</span><span>{formatar(resumo.esperadoCentavos)}</span></div>
            <div><span>Contado por você</span><span>{formatar(resumo.contadoCentavos)}</span></div>
          </div>

          {dif === 0 && <div className="troco">Caixa batendo ✓</div>}
          {dif < 0 && <div className="faltam">Faltam {formatar(-dif)}</div>}
          {dif > 0 && <div className="sobram">Sobram {formatar(dif)}</div>}

          <div className="resumo">
            {resumo.porForma.map((f) => (
              <div key={f.forma}>
                <span>{NOMES[f.forma] ?? f.forma} ({f.vendas} {f.vendas === 1 ? 'venda' : 'vendas'})</span>
                <span>{formatar(f.totalCentavos)}</span>
              </div>
            ))}
            {resumo.vendasCanceladas > 0 && (
              <div><span>Vendas canceladas</span><span>{resumo.vendasCanceladas}</span></div>
            )}
          </div>

          <button type="button" className="btn" onClick={aoConcluir}>
            Encerrar e sair (Enter)
          </button>
        </div>
      </div>
    );
  }

  // ---------- contar a gaveta ----------
  return (
    <div className="modal-fundo">
      <form className="modal" onSubmit={fechar}>
        <span className="rotulo">Fechar caixa</span>
        <p className="nota">
          Conte o dinheiro que está na gaveta (incluindo o fundo de troco) e digite o valor.
          Depois de fechar, não dá para reabrir este caixa.
        </p>

        <label className="rotulo">
          Dinheiro contado na gaveta (R$)
          <input
            className="campo campo-codigo"
            value={contado}
            onChange={(e) => { setContado(e.target.value); setErro(''); }}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <div className="acoes">
          <button type="button" className="btn-sec" onClick={aoCancelar} disabled={enviando}>
            Voltar (Esc)
          </button>
          <button className="btn" disabled={enviando || contado.trim() === ''}>
            {enviando ? 'Fechando…' : 'Fechar caixa (Enter)'}
          </button>
        </div>
      </form>
    </div>
  );
}