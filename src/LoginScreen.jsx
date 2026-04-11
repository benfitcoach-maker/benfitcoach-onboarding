import { useState, useEffect } from 'react';
import { hashPassword, getStoredPasswordHash, setPasswordHash, USERS } from './supabaseClient';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';
const BENOIT_AVATAR = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d2ce74b02c89db7a529560_Benfitcoach%20application%20mobile%20coaching%20sportif%20Nyon.png';
const ANISSA_AVATAR = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [storedHash, setStoredHash] = useState(null);
  const [step, setStep] = useState('select'); // 'select' | 'password'

  const handleSelectUser = async (user) => {
    setUsername(user);
    setError('');
    setLoading(true);
    try {
      const hash = await getStoredPasswordHash(user);
      setStoredHash(hash);
      setIsFirstSetup(!hash);
      setStep('password');
    } catch {
      setError('Impossible de se connecter a Supabase.');
    } finally {
      setLoading(false);
    }
  };

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
        await setPasswordHash(username, hash);
        sessionStorage.setItem('bfc_auth', 'true');
        sessionStorage.setItem('bfc_user', username);
        onLogin(username);
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
        sessionStorage.setItem('bfc_user', username);
        onLogin(username);
      } else {
        setError('Mot de passe incorrect.');
      }
    } catch {
      setError('Erreur de verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  if (loading && step === 'select') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <img src={LOGO_URL} alt="Benfitcoach" className="login-logo" />
          <div className="loading">
            <div className="loading-spinner" />
            <p>Connexion...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {step === 'select' ? (
          <>
            <p className="login-subtitle">Choisissez votre profil pour acceder au dashboard.</p>
            <div className="login-users">
              {USERS.map(user => (
                <button
                  key={user}
                  className={`login-user-btn ${user === 'Benoit' ? 'login-user-benoit' : 'login-user-anissa'}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <img
                    src={user === 'Benoit' ? BENOIT_AVATAR : ANISSA_AVATAR}
                    alt={user}
                    className="login-user-avatar-img"
                  />
                  <span className="login-user-name">{user}</span>
                </button>
              ))}
            </div>
            {error && <div className="login-error" style={{ marginTop: 16 }}>{error}</div>}
          </>
        ) : (
          <>
            <button className="login-back" onClick={handleBack}>&larr; Retour</button>
            <div className="login-selected-user">
              <img
                src={username === 'Benoit' ? BENOIT_AVATAR : ANISSA_AVATAR}
                alt={username}
                className="login-selected-avatar-img"
              />
              <span>{username}</span>
            </div>
            <h2>{isFirstSetup ? 'Creer votre mot de passe' : 'Mot de passe'}</h2>
            <p className="login-subtitle">
              {isFirstSetup
                ? 'Premier acces — choisissez un mot de passe.'
                : 'Entrez votre mot de passe.'}
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
          </>
        )}

        <div className="login-footer">
          AB Coaching Sarl — Onboarding System
        </div>
      </div>
    </div>
  );
}
