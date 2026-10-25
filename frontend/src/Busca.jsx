import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatar } from './dinheiro.js';

export default function Busca({ aoEscolher, aoFechar }) {
  const [termo, setTermo] = useState('');
  const [lista, setLista] = useState([]);
  const [sel, setSel] = useState(0);      // qual linha está destacada
  const [erro, setErro] = useState('');

  // Busca 250 ms depois que a pessoa para de digitar (não a cada letra).
  useEffect(() => {
    if (termo.trim().length < 2) {
      setLista([]);
      return;
    }
    let ativo = true;                     // ignora respostas velhas que chegarem atrasadas
    const espera = setTimeout(async () => {
      try {
        const r = await api('/produtos?busca=' + encodeURIComponent(termo.trim()));
        if (ativo) {
          setLista(r);
          setSel(0);
          setErro('');
        }
      } catch (err) {
        if (ativo) setErro(err.message);
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [termo]);

  function tecla(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.max(0, Math.min(s + 1, lista.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (lista[sel]) aoEscolher(lista[sel]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      aoFechar();
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <span className="rotulo">Buscar produto pelo nome</span>
        <input
          className="campo campo-codigo"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={tecla}
          placeholder="Ex.: leite, arroz, pão…"
          autoComplete="off"
          autoFocus
        />
        {erro && <p className="erro">{erro}</p>}

        <ul className="resultados">
          {lista.map((p, n) => (
            <li
              key={p.id}
              className={n === sel ? 'sel' : ''}
              onClick={() => aoEscolher(p)}
              onMouseEnter={() => setSel(n)}
            >
              <span>{p.nome}</span>
              <span className="est">estoque {p.estoque}</span>
              <span className="num">{formatar(p.precoCentavos)}</span>
            </li>
          ))}
        </ul>
        {termo.trim().length >= 2 && lista.length === 0 && !erro && (
          <p className="nota">Nenhum produto encontrado.</p>
        )}

        <span className="atalhos">↑ ↓ escolhe · Enter adiciona · Esc fecha</span>
      </div>
    </div>
  );
}