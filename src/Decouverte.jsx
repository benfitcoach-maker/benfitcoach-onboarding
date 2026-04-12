import { useState } from 'react';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const OBJECTIF_OPTIONS = ['\u00c9nergie', 'Poids', 'Hormones', 'Digestion', 'Performance'];
const DEJA_OPTIONS = ['Oui', 'Non'];
const LIEU_OPTIONS = ['Nyon & r\u00e9gion', 'Gen\u00e8ve', 'Autre'];

export default function Decouverte() {
  const [objectif, setObjectif] = useState('');
  const [dejaConsulte, setDejaConsulte] = useState('');
  const [lieu, setLieu] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');

  const handleSendMail = () => {
    const p = prenom || '(non pr\u00e9cis\u00e9)';
    const subject = `Nouvelle demande de RDV — ${p}`;
    const body = `Bonjour Anissa, ${p} souhaite \u00eatre contact\u00e9(e). Objectif : ${objectif || '(non pr\u00e9cis\u00e9)'}. D\u00e9j\u00e0 consult\u00e9 : ${dejaConsulte || '(non pr\u00e9cis\u00e9)'}. R\u00e9gion : ${lieu || '(non pr\u00e9cis\u00e9)'}. Email : ${email || '(non pr\u00e9cis\u00e9)'}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=anissa.nutri@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

  const EbookVisual = () => (
    <div style={{
      background: '#1A2E1F',
      borderRadius: 10,
      padding: '18px 16px',
      textAlign: 'center',
      color: '#F5F2EC',
      fontSize: '.78rem',
      fontWeight: 700,
      letterSpacing: '.5px',
      textTransform: 'uppercase',
    }}>
      E-book
    </div>
  );

  return (
    <div className="dec-page">
      {/* Hero */}
      <section className="dec-hero">
        <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="dec-logo" />
        <h1 className="dec-hero-title">Et si votre fatigue avait une cause pr{'\u00e9'}cise ?</h1>
        <p className="dec-hero-sub">
          Anissa Deroubaix — Nutritionniste {'\u00e0'} Nyon.<br />
          Approche bas{'\u00e9'}e sur vos biomarqueurs, votre physiologie et votre mode de vie.
        </p>
        <div className="dec-cta-row">
          <a href="tel:+41766210205" className="dec-cta">Appeler</a>
          <button className="dec-cta" onClick={() => window.open('https://wa.me/41766210205', '_blank')}>WhatsApp</button>
        </div>
      </section>

      {/* Duo */}
      <section className="dec-section">
        <div className="dec-duo">
          En synergie avec Benoit Deroubaix, coach sportif &amp; massoth{'\u00e9'}rapeute — un accompagnement sport + nutrition unique {'\u00e0'} Nyon.
        </div>
      </section>

      {/* MGD Lab */}
      <section className="dec-section">
        <div className="dec-badge">
          En partenariat avec <strong>MGD Lab Suisse</strong> — analyses biologiques et g{'\u00e9'}n{'\u00e9'}tiques de pr{'\u00e9'}cision
        </div>
      </section>

      {/* E-books */}
      <section className="dec-section">
        <h2 className="dec-section-title">Ressources offertes</h2>
        <div className="dec-ebooks">
          <div className="dec-ebook-card">
            <EbookVisual />
            <h3 className="dec-ebook-title">Vous {'\u00ea'}tes {'\u00e9'}puis{'\u00e9'}e. Et si votre corps vous envoyait un message ?</h3>
            <a href="#" className="dec-ebook-btn">T{'\u00e9'}l{'\u00e9'}charger gratuitement</a>
          </div>
          <div className="dec-ebook-card">
            <EbookVisual />
            <h3 className="dec-ebook-title">R{'\u00e9'}{'\u00e9'}quilibrer vos hormones naturellement</h3>
            <a href="#" className="dec-ebook-btn">T{'\u00e9'}l{'\u00e9'}charger gratuitement</a>
          </div>
        </div>
      </section>

      {/* Mini questionnaire */}
      <section className="dec-section">
        <h2 className="dec-section-title">Vous reconnaissez-vous ?</h2>
        <div className="dec-quiz">
          <div className="dec-quiz-q" style={{ marginBottom: 20 }}>
            <label className="dec-label">Votre objectif ?</label>
            <BtnGroup options={OBJECTIF_OPTIONS} value={objectif} onChange={setObjectif} />
          </div>
          <div className="dec-quiz-q" style={{ marginBottom: 20 }}>
            <label className="dec-label">Vous avez d{'\u00e9'}j{'\u00e0'} consult{'\u00e9'} un nutritionniste ?</label>
            <BtnGroup options={DEJA_OPTIONS} value={dejaConsulte} onChange={setDejaConsulte} />
          </div>
          <div className="dec-quiz-q" style={{ marginBottom: 20 }}>
            <label className="dec-label">Vous {'\u00ea'}tes bas{'\u00e9'}(e) o{'\u00f9'} ?</label>
            <BtnGroup options={LIEU_OPTIONS} value={lieu} onChange={setLieu} />
          </div>
          <div className="dec-quiz-fields">
            <input
              className="dec-input"
              type="text"
              placeholder="Prénom"
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
          <button className="dec-cta dec-cta-full" onClick={() => {
            const msg = `Bonjour Anissa, je souhaite \u00eatre contact\u00e9e. Pr\u00e9nom : ${prenom || '(non pr\u00e9cis\u00e9)'}. Objectif : ${objectif || '(non pr\u00e9cis\u00e9)'}. D\u00e9j\u00e0 consult\u00e9 un nutritionniste : ${dejaConsulte || '(non pr\u00e9cis\u00e9)'}. R\u00e9gion : ${lieu || '(non pr\u00e9cis\u00e9)'}. Email : ${email || '(non pr\u00e9cis\u00e9)'}`;
            window.open(`https://wa.me/41766210205?text=${encodeURIComponent(msg)}`, '_blank');
          }}>
            Contacter Anissa sur WhatsApp {'\u2192'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="dec-footer">
        <span>anissa.nutri@gmail.com</span>
        <span>076 621 02 05</span>
        <span>www.anissanutrition.ch</span>
        <span>Rue de Rive 28, 1260 Nyon</span>
      </footer>
    </div>
  );
}
