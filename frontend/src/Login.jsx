import { useState } from 'react';
import { api, token } from './api.js';

export default function Login({ aoEntrar }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();          // não deixa o navegador recarregar a página
    setErro('');
    setEnviando(true);
    try {
      const r = await api('/auth/login', { metodo: 'POST', corpo: { login, senha } });
      token.guardar(r.token);
      aoEntrar(r.usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-centro">
      <form className="cartao" onSubmit={enviar}>
        <span className="rotulo">Lumak Caixa</span>
        <h1>Entrar</h1>

        <label className="rotulo">
          Usuário
          <input
            className="campo"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="rotulo">
          Senha
          <input
            className="campo"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button className="btn" disabled={enviando || !login || !senha}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}