import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { formatar } from './dinheiro.js';
import Pagamento from './Pagamento.jsx';
import Busca from './Busca.jsx';
import FecharCaixa from './FecharCaixa.jsx';
import CancelarVenda from './CancelarVenda.jsx';

export default function Venda({ usuario, aoCaixaFechado }) {
  const [itens, setItens] = useState([]);        // [{ produto, quantidade }]
  const [codigo, setCodigo] = useState('');      // o que está no campo do leitor
  const [erro, setErro] = useState('');
  const [ultimo, setUltimo] = useState(null);    // último produto lido
  const [aviso, setAviso] = useState('');        // mensagem de sucesso (verde)
  const [ultimaVenda, setUltimaVenda] = useState(null);   // para poder cancelar a última venda

  // Qual janela está aberta (só uma por vez)?
  const [pagando, setPagando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const modalAberto = pagando || buscando || fechando || cancelando;
  const campo = useRef(null);
  const fim = useRef(null);

  const total = itens.reduce((soma, i) => soma + i.produto.precoCentavos * i.quantidade, 0);
  const pecas = itens.reduce((soma, i) => soma + i.quantidade, 0);

  // ---------- mexer na lista ----------
  function adicionar(produto, quantidade) {
    setItens((atual) => {
      const existe = atual.find((i) => i.produto.id === produto.id);
      if (existe) {
        return atual.map((i) =>
          i.produto.id === produto.id
            ? { ...i, quantidade: Math.min(999, i.quantidade + quantidade) }
            : i
        );
      }
      return [...atual, { produto, quantidade }];
    });
    setUltimo(produto);
  }

  function mudarQuantidade(produtoId, delta) {
    setItens((atual) =>
      atual.map((i) =>
        i.produto.id === produtoId
          ? { ...i, quantidade: Math.min(999, Math.max(1, i.quantidade + delta)) }
          : i
      )
    );
    campo.current?.focus();
  }

  function remover(produtoId) {
    setItens((atual) => atual.filter((i) => i.produto.id !== produtoId));
    campo.current?.focus();
  }

  function limparVenda() {
    if (itens.length > 0 && window.confirm('Cancelar esta venda e limpar todos os itens?')) {
      setItens([]);
      setUltimo(null);
    }
    campo.current?.focus();
  }

  // ---------- pagamento ----------
  function pagar() {
    if (itens.length > 0) setPagando(true);
  }

  function voltarDoPagamento() {
    setPagando(false);
    setTimeout(() => campo.current?.focus(), 0);
  }

  // Venda gravada: zera tudo e deixa o caixa pronto para o próximo cliente.
  function vendaConcluida(venda) {
    setUltimaVenda({ id: venda.id, numero: venda.numero, totalCentavos: venda.totalCentavos });
    setAviso('');
    setItens([]);
    setUltimo(null);
    setErro('');
    setPagando(false);
    setTimeout(() => campo.current?.focus(), 0);
  }

  // ---------- busca por nome (F2) ----------
  function escolherDaBusca(produto) {
    adicionar(produto, 1);
    setErro('');
    setAviso('');
    setBuscando(false);
    setTimeout(() => campo.current?.focus(), 0);
  }

  // ---------- fechar caixa (F10) e cancelar a última venda (F8) ----------
  function abrirFechamento() {
    if (itens.length > 0) {
      setErro('Finalize ou limpe a venda atual antes de fechar o caixa.');
      return;
    }
    setFechando(true);
  }

  function abrirCancelamento() {
    if (!ultimaVenda) {
      setErro('Não há venda recente para cancelar (só vale para a última venda feita nesta tela).');
      return;
    }
    setCancelando(true);
  }

  function fecharJanelas() {
    setBuscando(false);
    setFechando(false);
    setCancelando(false);
    setTimeout(() => campo.current?.focus(), 0);
  }

  function vendaCancelada() {
    setAviso(`Venda nº ${ultimaVenda.numero} cancelada. O estoque foi devolvido.`);
    setUltimaVenda(null);
    fecharJanelas();
  }

  // ---------- o leitor de código de barras ----------
  // O leitor digita os números e aperta Enter sozinho. Digitando à mão é igual.
  // "3*7891000100103" adiciona 3 unidades de uma vez.
  async function ler(e) {
    e.preventDefault();
    const texto = codigo.trim();
    setCodigo('');                       // limpa já, para o próximo código não se misturar
    if (!texto) return;

    const m = texto.match(/^(\d{1,3})\*(\d{1,20})$/);
    const quantidade = m ? Number(m[1]) : 1;
    const cod = m ? m[2] : texto;

    if (quantidade < 1) {
      setErro('A quantidade precisa ser 1 ou mais.');
      return;
    }
    if (!/^\d{1,20}$/.test(cod)) {
      setErro('Digite só números (código de barras). Para buscar pelo nome, use a tecla F2.');
      return;
    }

    setErro('');
    setAviso('');
    try {
      const produto = await api('/produtos/codigo/' + cod);
      adicionar(produto, quantidade);
    } catch (err) {
      setErro(err.message);
    }
  }

  // ---------- atalhos de teclado ----------
  useEffect(() => {
    if (modalAberto) return;   // com uma janela aberta, ela comanda o teclado
    function tecla(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        setBuscando(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        abrirCancelamento();
      } else if (e.key === 'F9') {
        e.preventDefault();
        pagar();
      } else if (e.key === 'F10') {
        e.preventDefault();
        abrirFechamento();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        limparVenda();
      } else if (e.key === 'Delete' && codigo === '' && itens.length > 0) {
        e.preventDefault();
        remover(itens[itens.length - 1].produto.id);   // remove o último lido
      } else if (/^\d$/.test(e.key)) {
        // Se o foco foi parar em outro lugar, o leitor continua funcionando:
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') campo.current?.focus();
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [itens, codigo, modalAberto, ultimaVenda]);

  // Mantém o último item lido visível na lista.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' });
  }, [itens.length]);

  return (
    <div className="venda">
      <section className="venda-esq">
        <form onSubmit={ler}>
          <label className="rotulo" htmlFor="codigo">Código de barras</label>
          <input
            id="codigo"
            ref={campo}
            className="campo campo-codigo"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value); setErro(''); }}
            placeholder="Passe o leitor ou digite o código e aperte Enter"
            autoComplete="off"
            autoFocus
          />
        </form>
        {erro && <p className="erro">{erro}</p>}
        {aviso && <p className="ok">{aviso}</p>}

        <div className="lista">
          {itens.length === 0 ? (
            <p className="vazio">Caixa livre. Passe o primeiro produto.</p>
          ) : (
            <table className="itens">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produto</th>
                  <th className="num">Qtd</th>
                  <th className="num">Unit.</th>
                  <th className="num">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.map((i, n) => (
                  <tr key={i.produto.id}>
                    <td>{n + 1}</td>
                    <td>{i.produto.nome}</td>
                    <td className="num">
                      <span className="qtd">
                        <button type="button" onClick={() => mudarQuantidade(i.produto.id, -1)}>−</button>
                        {i.quantidade}
                        <button type="button" onClick={() => mudarQuantidade(i.produto.id, +1)}>+</button>
                      </span>
                    </td>
                    <td className="num">{formatar(i.produto.precoCentavos)}</td>
                    <td className="num">{formatar(i.produto.precoCentavos * i.quantidade)}</td>
                    <td>
                      <button type="button" className="remover" onClick={() => remover(i.produto.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={fim} />
        </div>

        <footer className="atalhos">
          <span>3*código = quantidade</span>
          <span>Del remove o último</span>
          <span>Esc limpa a venda</span>
          <span>F2 busca</span>
          <span>F8 cancela última venda</span>
          <span>F9 paga</span>
          <span>F10 fecha caixa</span>
        </footer>
      </section>

      <aside className="venda-dir">
        <span className="rotulo">Total</span>
        <div className="total">{formatar(total)}</div>
        <span className="rotulo">{pecas} {pecas === 1 ? 'unidade' : 'unidades'}</span>

        {ultimo && (
          <div className="ultimo">
            <span className="rotulo">Último produto</span>
            <strong>{ultimo.nome}</strong>
            <span>{formatar(ultimo.precoCentavos)}</span>
            {ultimo.estoqueBaixo && <span className="aviso">estoque baixo</span>}
          </div>
        )}

        <button className="btn" disabled={itens.length === 0} onClick={pagar}>
          F9 · Pagar
        </button>
      </aside>

      {pagando && (
        <Pagamento
          itens={itens}
          total={total}
          aoCancelar={voltarDoPagamento}
          aoConcluir={vendaConcluida}
        />
      )}

      {buscando && <Busca aoEscolher={escolherDaBusca} aoFechar={fecharJanelas} />}

      {fechando && <FecharCaixa aoCancelar={fecharJanelas} aoConcluir={aoCaixaFechado} />}

      {cancelando && (
        <CancelarVenda
          venda={ultimaVenda}
          ehGerente={usuario.perfil === 'gerente'}
          aoFechar={fecharJanelas}
          aoCancelada={vendaCancelada}
        />
      )}
    </div>
  );
}