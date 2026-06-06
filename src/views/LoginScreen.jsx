import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MillsLogo } from '../components/UI';
import { T, BS, IS, LS, FILIAIS } from '../lib/constants';

export function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('solicitante');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name, role, unit);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'IBM Plex Sans,sans-serif',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: T.surface,
          borderRadius: 16,
          padding: 36,
          width: 400,
          boxShadow: T.shadowLg,
          border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <MillsLogo height={36} />
          <div
            style={{
              color: T.text,
              fontFamily: 'Barlow Condensed,sans-serif',
              fontWeight: 700,
              fontSize: 18,
              marginTop: 12,
            }}
          >
            GESTÃO DE FROTAS
          </div>
          <div style={{ color: T.textMuted, fontSize: 11, marginTop: 2 }}>
            Logística · Operações de Campo
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                ...BS,
                flex: 1,
                background: mode === m ? T.laranja : T.surfaceAlt,
                color: mode === m ? 'white' : T.textSec,
                border: `1px solid ${mode === m ? T.laranja : T.border}`,
              }}
            >
              {m === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={LS}>Nome completo</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={IS}
                placeholder="Seu nome"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={LS}>Perfil</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={IS}
              >
                <option value="solicitante">Solicitante</option>
                <option value="frotas">Gestão de Frotas</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={LS}>Unidade Mills</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={IS}
              >
                <option value="">— selecione —</option>
                {FILIAIS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={LS}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={IS}
            placeholder="seu@email.com"
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={LS}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={IS}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div
            style={{
              background: T.perigoLight,
              color: T.perigo,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handle}
          disabled={loading}
          style={{
            ...BS,
            width: '100%',
            background: loading ? T.borderMid : T.laranja,
            color: 'white',
            fontWeight: 700,
            fontSize: 14,
            padding: '11px 0',
          }}
        >
          {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </div>
    </div>
  );
}
