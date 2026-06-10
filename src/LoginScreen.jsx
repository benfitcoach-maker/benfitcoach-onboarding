import { useState } from 'react';
import { signIn, USERS } from './supabaseClient';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';
const BENOIT_AVATAR = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d2ce74b02c89db7a529560_Benfitcoach%20application%20mobile%20coaching%20sportif%20Nyon.png';
const ANISSA_AVATAR = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select'); // 'select' | 'password'

  const handleSelectUser = (user) => {
    setUsername(user);
    setError('');
    setStep('password');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(username, password);
      sessionStorage.setItem('bfc_auth', 'true');
      sessionStorage.setItem('bfc_user', username);
      onLogin(username);
    } catch (err) {
      setError('Mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setPassword('');
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        {step === 'select' ? (
          <>
            <p className="login-subtitle">Choisis ton profil pour accéder au dashboard.</p>
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
            <h2>Mot de passe</h2>
            <p className="login-subtitle">Entre ton mot de passe.</p>

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

              {error && <div className="login-error">{error}</div>}

              <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                {loading ? 'Chargement...' : 'Se connecter'}
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
