import { useState } from 'react';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const APP_SCREENS = [
  {
    src: 'https://anissa-client-app.vercel.app/marketing/home.png',
    alt: 'Écran d\u2019accueil de l\u2019app — bonjour Chloé, votre prochain repas',
    caption: 'Votre journée',
  },
  {
    src: 'https://anissa-client-app.vercel.app/marketing/semaine.png',
    alt: 'Écran Votre semaine — sélecteur de jour, repas avec alternatives',
    caption: 'Votre semaine',
  },
  {
    src: 'https://anissa-client-app.vercel.app/marketing/lettre.png',
    alt: 'Écran Votre lettre — mot personnalisé d\u2019Anissa',
    caption: 'Votre lettre',
  },
];

const TESTIMONIALS = [
  {
    text: 'En 2 mois j\u2019ai retrouvé une énergie que je n\u2019avais plus depuis 5 ans. Pour la première fois on a regardé mes analyses avant de me parler d\u2019alimentation. Je comprends enfin ce qui se passait.',
    author: 'M., 38 ans',
    location: 'Lausanne',
  },
  {
    text: 'J\u2019avais consulté trois nutritionnistes avant Anissa. Aucune n\u2019avait pris le temps de regarder mes hormones. Six mois plus tard mon cycle est régulier, je dors mieux, j\u2019ai perdu 6 kilos sans forcer.',
    author: 'S., 42 ans',
    location: 'Genève',
  },
  {
    text: 'L\u2019analyse ADN a tout changé. J\u2019ai compris pourquoi certains aliments me plombaient malgré une alimentation saine. Aujourd\u2019hui je récupère mieux et mes performances en CrossFit ont décollé.',
    author: 'L., 29 ans',
    location: 'Nyon',
  },
];

const OBJECTIF_OPTIONS = ['\u00c9nergie', 'Poids', 'Hormones', 'Digestion', 'Performance'];
const DEJA_OPTIONS = ['Oui', 'Non'];
const LIEU_OPTIONS = ['Nyon & r\u00e9gion', 'Gen\u00e8ve', 'Autre'];

const UTM = '?utm_source=instagram&utm_medium=bio&utm_campaign=insta_decouverte';
const URL_CALL = `https://anissanutrition.ch/consultation${UTM}&utm_content=cta_call_primary`;
const URL_CALL_FOOTER = `https://anissanutrition.ch/consultation${UTM}&utm_content=cta_call_footer`;
const URL_SITE = `https://anissanutrition.ch/${UTM}&utm_content=cta_site`;
const URL_BENFITCOACH = `https://benfitcoach.ch/${UTM}&utm_content=cta_duo`;

export default function Decouverte() {
  const [objectif, setObjectif] = useState('');
  const [dejaConsulte, setDejaConsulte] = useState('');
  const [lieu, setLieu] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');

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

  const handleQuizSubmit = () => {
    const msg = `Bonjour Anissa, je souhaite \u00eatre contact\u00e9e. Pr\u00e9nom : ${prenom || '(non pr\u00e9cis\u00e9)'}. Objectif : ${objectif || '(non pr\u00e9cis\u00e9)'}. D\u00e9j\u00e0 consult\u00e9 un nutritionniste : ${dejaConsulte || '(non pr\u00e9cis\u00e9)'}. R\u00e9gion : ${lieu || '(non pr\u00e9cis\u00e9)'}. Email : ${email || '(non pr\u00e9cis\u00e9)'}`;
    window.open(`https://wa.me/41766210205?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="dec-page">
      {/* 1. Hero */}
      <section className="dec-hero">
        <img src={ANISSA_LOGO} alt="Anissa Deroubaix Nutrition" className="dec-logo" />
        <h1 className="dec-hero-title">Et si votre fatigue avait une cause pr{'\u00e9'}cise ?</h1>
        <p className="dec-hero-sub">
          Anissa Deroubaix — Nutritionniste {'\u00e0'} Nyon.<br />
          Approche bas{'\u00e9'}e sur vos biomarqueurs, votre physiologie et votre mode de vie.
        </p>
        <a href={URL_CALL} className="dec-cta-primary">
          R{'\u00e9'}server mon appel · 15 min offert
        </a>
        <div className="dec-cta-row dec-cta-row-secondary">
          <a href="tel:+41766210205" className="dec-cta dec-cta-ghost">Appeler</a>
          <button className="dec-cta dec-cta-ghost" onClick={() => window.open('https://wa.me/41766210205', '_blank')}>WhatsApp</button>
        </div>
      </section>

      {/* 2. Bandeau confiance */}
      <section className="dec-section">
        <div className="dec-trust">
          <div className="dec-trust-item">
            <span className="dec-trust-label">Partenaire</span>
            <span className="dec-trust-value">MGD Lab Suisse</span>
          </div>
          <div className="dec-trust-item">
            <span className="dec-trust-label">Form{'\u00e9'}e</span>
            <span className="dec-trust-value">TCMA Gen{'\u00e8'}ve</span>
          </div>
          <div className="dec-trust-item">
            <span className="dec-trust-label">Cabinet</span>
            <span className="dec-trust-value">Nyon · visio Romandie</span>
          </div>
        </div>
      </section>

      {/* 3. Pourquoi c'est différent */}
      <section className="dec-section">
        <h2 className="dec-section-title">Une approche bas{'\u00e9'}e sur votre biologie</h2>
        <div className="dec-pillars">
          <div className="dec-pillar">
            <div className="dec-pillar-icon" aria-hidden>{'\u25CF'}</div>
            <h3 className="dec-pillar-title">Bilan sanguin comment{'\u00e9'}</h3>
            <p className="dec-pillar-text">On regarde vos analyses avant de parler d{'\u2019'}alimentation. Ferritine, vitamine D, TSH, glyc{'\u00e9'}mie : les marqueurs qui orientent vraiment votre corps.</p>
          </div>
          <div className="dec-pillar">
            <div className="dec-pillar-icon" aria-hidden>{'\u25CF'}</div>
            <h3 className="dec-pillar-title">Analyse g{'\u00e9'}n{'\u00e9'}tique</h3>
            <p className="dec-pillar-text">Pourquoi le m{'\u00ea'}me r{'\u00e9'}gime ne marche pas pour deux personnes. Vos g{'\u00e8'}nes orientent ce que votre corps tol{'\u00e8'}re et m{'\u00e9'}tabolise.</p>
          </div>
          <div className="dec-pillar">
            <div className="dec-pillar-icon" aria-hidden>{'\u25CF'}</div>
            <h3 className="dec-pillar-title">Sp{'\u00e9'}cialisation longévit{'\u00e9'}</h3>
            <p className="dec-pillar-text">Au-del{'\u00e0'} du sympt{'\u00f4'}me du jour : on travaille sur le terrain pour que les changements durent dans le temps.</p>
          </div>
        </div>
      </section>

      {/* 4. Mini quiz */}
      <section className="dec-section">
        <h2 className="dec-section-title">Vous reconnaissez-vous ?</h2>
        <div className="dec-quiz">
          <div className="dec-quiz-q">
            <label className="dec-label">Votre objectif ?</label>
            <BtnGroup options={OBJECTIF_OPTIONS} value={objectif} onChange={setObjectif} />
          </div>
          <div className="dec-quiz-q">
            <label className="dec-label">Vous avez d{'\u00e9'}j{'\u00e0'} consult{'\u00e9'} un nutritionniste ?</label>
            <BtnGroup options={DEJA_OPTIONS} value={dejaConsulte} onChange={setDejaConsulte} />
          </div>
          <div className="dec-quiz-q">
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
          <button className="dec-cta dec-cta-full" onClick={handleQuizSubmit}>
            Contacter Anissa sur WhatsApp {'\u2192'}
          </button>
        </div>
      </section>

      {/* 5. Témoignages */}
      <section className="dec-section">
        <h2 className="dec-section-title">Ce que disent mes patientes</h2>
        <div className="dec-testimonials">
          {TESTIMONIALS.map((t, i) => (
            <figure key={i} className="dec-testimonial">
              <blockquote className="dec-testimonial-text">{'\u00ab '}{t.text}{' \u00bb'}</blockquote>
              <figcaption className="dec-testimonial-author">
                — {t.author} · {t.location}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 6. Votre espace personnel (app) */}
      <section className="dec-section">
        <h2 className="dec-section-title">Votre espace personnel</h2>
        <p className="dec-app-promise">
          Une application pens{'\u00e9'}e pour prolonger l{'\u2019'}accompagnement entre nos consultations.
        </p>
        <div className="dec-app-screens">
          {APP_SCREENS.map((s, i) => (
            <figure key={i} className="dec-app-screen">
              <img src={s.src} alt={s.alt} loading="lazy" />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <ul className="dec-app-benefits">
          <li>Vos repas du jour et votre ressenti {'\u00e0'} partager</li>
          <li>Recettes d{'\u00e9'}taill{'\u00e9'}es avec astuces nutritionnistes</li>
          <li>Liste de courses automatis{'\u00e9'}e et ajustable</li>
          <li>Anissa pr{'\u00e9'}sente : messages personnels et retours</li>
        </ul>
        <p className="dec-app-included">Inclus dans tous les accompagnements.</p>
      </section>

      {/* 7. Synergie Benoit (déplacée plus bas) */}
      <section className="dec-section">
        <h2 className="dec-section-title">Sport et nutrition, sous le m{'\u00ea'}me toit</h2>
        <div className="dec-duo">
          En synergie avec <strong>Benoit Deroubaix</strong>, coach sportif &amp; massoth{'\u00e9'}rapeute {'\u00e0'} Nyon.
          Un accompagnement sport + nutrition unique en Suisse romande, pour celles et ceux qui veulent traiter le terrain dans son ensemble.
          <a href={URL_BENFITCOACH} target="_blank" rel="noopener noreferrer" className="dec-duo-link">D{'\u00e9'}couvrir Benfitcoach {'\u2192'}</a>
        </div>
      </section>

      {/* 8. CTA final répété */}
      <section className="dec-section dec-section-final">
        <h2 className="dec-final-title">Pr{'\u00ea'}te {'\u00e0'} comprendre ce qui se passe ?</h2>
        <p className="dec-final-sub">15 minutes, en visio. Sans engagement.</p>
        <a href={URL_CALL_FOOTER} className="dec-cta-primary dec-cta-primary-large">
          R{'\u00e9'}server mon appel · 15 min offert
        </a>
      </section>

      {/* 9. Footer */}
      <footer className="dec-footer">
        <a href="mailto:anissa.nutri@gmail.com">anissa.nutri@gmail.com</a>
        <a href="tel:+41766210205">076 621 02 05</a>
        <a href={URL_SITE} target="_blank" rel="noopener noreferrer">www.anissanutrition.ch</a>
        <a href="https://maps.app.goo.gl/?q=Rue+de+Rive+28,+1260+Nyon" target="_blank" rel="noopener noreferrer">Rue de Rive 28, 1260 Nyon</a>
      </footer>
    </div>
  );
}
