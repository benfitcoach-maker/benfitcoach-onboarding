import { useState, useEffect } from 'react';
import { hashPassword, getStoredPasswordHash, setPasswordHash } from './supabaseClient';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [storedHash, setStoredHash] = useState(null);

  useEffect(() => {
    getStoredPasswordHash().then(hash => {
      setStoredHash(hash);
      setIsFirstSetup(!hash);
      setLoading(false);
    }).catch(() => {
      setError('Impossible de se connecter a Supabase. Verifiez votre configuration.');
      setLoading(false);
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Entrez un mot de passe.');
      return;
    }

    if (isFirstSetup) {
      if (password.length < 4) {
        setError('Le mot de passe doit faire au moins 4 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
      setLoading(true);
      try {
        const hash = await hashPassword(password);
        await setPasswordHash(hash);
        sessionStorage.setItem('bfc_auth', 'true');
        onLogin();
      } catch {
        setError('Erreur lors de la creation du mot de passe.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const hash = await hashPassword(password);
      if (hash === storedHash) {
        sessionStorage.setItem('bfc_auth', 'true');
        onLogin();
      } else {
        setError('Mot de passe incorrect.');
      }
    } catch {
      setError('Erreur de verification.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !error) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <img src={LOGO_URL} alt="Benfitcoach" className="login-logo" />
          <div className="loading">
            <div className="loading-spinner" />
            <p>Connexion a Supabase...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={LOGO_URL} alt="Benfitcoach" className="login-logo" />
        <h2>{isFirstSetup ? 'Creer un mot de passe' : 'Connexion'}</h2>
        <p className="login-subtitle">
          {isFirstSetup
            ? 'Choisissez un mot de passe pour proteger votre espace coach.'
            : 'Entrez votre mot de passe pour acceder au dashboard.'}
        </p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="field">
            <label htmlFor="login-pw">Mot de passe</label>
            <input
              id="login-pw"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {isFirstSetup && (
            <div className="field">
              <label htmlFor="login-pw2">Confirmer le mot de passe</label>
              <input
                id="login-pw2"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Chargement...' : isFirstSetup ? 'Creer et entrer' : 'Se connecter'}
          </button>
        </form>

        <div className="login-footer">
          Benfitcoach Onboarding System
        </div>
      </div>
    </div>
  );
}
