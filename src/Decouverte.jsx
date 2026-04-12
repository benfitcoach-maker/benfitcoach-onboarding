import { useState } from 'react';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const OBJECTIF_OPTIONS = ['Energie', 'Poids', 'Hormones', 'Digestion', 'Performance'];
const DEJA_OPTIONS = ['Oui', 'Non'];
const LIEU_OPTIONS = ['Nyon & region', 'Geneve', 'Autre'];

export default function Decouverte() {
  const [objectif, setObjectif] = useState('');
  const [dejaConsulte, setDejaConsulte] = useState('');
  const [lieu, setLieu] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');

  const handleRdv = () => {
    const subject = 'Demande RDV decouverte';
    const body = `Bonjour Anissa, ${prenom || '(prenom)'} souhaite un RDV decouverte. Objectif: ${objectif || '(non precise)'}. Email: ${email || '(non precise)'}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=anissanutrition@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const BtnGroup = ({ options, value, onChange }) => (
    <div className="dec-btn-group">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          className={`dec-btn-option ${value === opt ? 'dec-btn-active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <div className="dec-page">
      {/* Hero */}
      <section className="dec-hero">
        <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="dec-logo" />
        <h1 className="dec-hero-title">Et si votre fatigue avait une cause precise ?</h1>
        <p className="dec-hero-sub">
          Anissa Deroubaix — Nutritionniste a Nyon.<br />
          Approche basee sur vos biomarqueurs, votre physiologie et votre mode de vie.
        </p>
        <a
          href="mailto:anissanutrition@gmail.com"
          className="dec-cta"
        >
          Prendre rendez-vous
        </a>
      </section>

      {/* Duo */}
      <section className="dec-section">
        <div className="dec-duo">
          En synergie avec Benoit Deroubaix, coach sportif &amp; massotherapeute — un accompagnement sport + nutrition unique a Nyon.
        </div>
      </section>

      {/* MGD Lab */}
      <section className="dec-section">
        <div className="dec-badge">
          En partenariat avec <strong>MGD Lab Suisse</strong> — analyses biologiques et genetiques de precision
        </div>
      </section>

      {/* E-books */}
      <section className="dec-section">
        <h2 className="dec-section-title">Ressources offertes</h2>
        <div className="dec-ebooks">
          <div className="dec-ebook-card">
            <h3 className="dec-ebook-title">Vous etes epuisee. Et si votre corps vous envoyait un message ?</h3>
            <a href="#" className="dec-ebook-btn">Telecharger gratuitement</a>
          </div>
          <div className="dec-ebook-card">
            <h3 className="dec-ebook-title">Reequilibrer vos hormones naturellement</h3>
            <a href="#" className="dec-ebook-btn">Telecharger gratuitement</a>
          </div>
        </div>
      </section>

      {/* Mini questionnaire */}
      <section className="dec-section">
        <h2 className="dec-section-title">Vous reconnaissez-vous ?</h2>
        <div className="dec-quiz">
          <div className="dec-quiz-q">
            <label className="dec-label">Votre objectif ?</label>
            <BtnGroup options={OBJECTIF_OPTIONS} value={objectif} onChange={setObjectif} />
          </div>
          <div className="dec-quiz-q">
            <label className="dec-label">Vous avez deja consulte un nutritionniste ?</label>
            <BtnGroup options={DEJA_OPTIONS} value={dejaConsulte} onChange={setDejaConsulte} />
          </div>
          <div className="dec-quiz-q">
            <label className="dec-label">Vous etes base ou ?</label>
            <BtnGroup options={LIEU_OPTIONS} value={lieu} onChange={setLieu} />
          </div>
          <div className="dec-quiz-fields">
            <input
              className="dec-input"
              type="text"
              placeholder="Prenom"
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
            />
            <input
              className="dec-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <button className="dec-cta dec-cta-full" onClick={handleRdv}>
            Je veux un RDV decouverte
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="dec-footer">
        <span>anissanutrition@gmail.com</span>
        <span>076 621 02 05</span>
        <span>www.anissanutrition.ch</span>
        <span>Rue de Rive 28, 1260 Nyon</span>
      </footer>
    </div>
  );
}
