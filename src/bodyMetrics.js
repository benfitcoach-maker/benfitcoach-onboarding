// ──────────────────────────────────────────────────────────────
// Benfitcoach - Body metrics calculations
// BMI, US Navy body fat %, lean mass, Katch-McArdle BMR
// ──────────────────────────────────────────────────────────────

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── BMI ───

export function computeBMI(weightKg, heightCm) {
  const w = toNumber(weightKg);
  const h = toNumber(heightCm);
  if (!w || !h) return null;
  const m = h / 100;
  return w / (m * m);
}

export function bmiInterpretation(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return { label: 'Sous-poids', labelKey: 'bmi.underweight', color: '#e89545' };
  if (bmi < 25) return { label: 'Normal', labelKey: 'bmi.normal', color: '#2a9d5c' };
  if (bmi < 30) return { label: 'Surpoids', labelKey: 'bmi.overweight', color: '#e89545' };
  return { label: 'Obésité', labelKey: 'bmi.obesity', color: '#d84a4a' };
}

// ─── Body fat (US Navy method) ───
// Homme : 495 / (1.0324 - 0.19077 * log10(taille - cou) + 0.15456 * log10(tailleCm)) - 450
// Femme : 495 / (1.29579 - 0.35004 * log10(taille + hanche - cou) + 0.22100 * log10(tailleCm)) - 450

export function computeBodyFatUSNavy({ genre, heightCm, waistCm, hipCm, neckCm }) {
  const h = toNumber(heightCm);
  const w = toNumber(waistCm);
  const n = toNumber(neckCm);
  if (!h || !w || !n) return null;

  const log10 = Math.log10;

  if (genre === 'Homme') {
    const diff = w - n;
    if (diff <= 0) return null;
    const bf = 495 / (1.0324 - 0.19077 * log10(diff) + 0.15456 * log10(h)) - 450;
    return Number.isFinite(bf) && bf > 0 ? bf : null;
  }

  if (genre === 'Femme') {
    const hip = toNumber(hipCm);
    if (!hip) return null;
    const sum = w + hip - n;
    if (sum <= 0) return null;
    const bf = 495 / (1.29579 - 0.35004 * log10(sum) + 0.22100 * log10(h)) - 450;
    return Number.isFinite(bf) && bf > 0 ? bf : null;
  }

  return null;
}

export function bodyFatInterpretation(bf, genre) {
  if (bf == null) return null;
  if (genre === 'Homme') {
    if (bf < 14) return { label: 'Athlétique', labelKey: 'bf.athletic', color: '#2a9d5c' };
    if (bf < 18) return { label: 'Fitness', labelKey: 'bf.fitness', color: '#2a9d5c' };
    if (bf < 25) return { label: 'Moyen', labelKey: 'bf.average', color: '#e89545' };
    return { label: 'Élevé', labelKey: 'bf.high', color: '#d84a4a' };
  }
  if (genre === 'Femme') {
    if (bf < 21) return { label: 'Athlétique', labelKey: 'bf.athletic', color: '#2a9d5c' };
    if (bf < 25) return { label: 'Fitness', labelKey: 'bf.fitness', color: '#2a9d5c' };
    if (bf < 32) return { label: 'Moyen', labelKey: 'bf.average', color: '#e89545' };
    return { label: 'Élevé', labelKey: 'bf.high', color: '#d84a4a' };
  }
  return null;
}

// ─── Lean mass & BMR ───

export function computeLeanMass(weightKg, bodyFatPct) {
  const w = toNumber(weightKg);
  if (!w || bodyFatPct == null) return null;
  return w * (1 - bodyFatPct / 100);
}

// Katch-McArdle : BMR = 370 + (21.6 * lean mass kg)
export function computeBMR(leanMassKg) {
  if (leanMassKg == null || leanMassKg <= 0) return null;
  return 370 + 21.6 * leanMassKg;
}

// ─── All-in-one ───

export function computeMetrics(form) {
  const weight = toNumber(form.poids);
  const height = toNumber(form.taille);
  const waist = toNumber(form.tourTaille);
  const hip = toNumber(form.tourHanche);
  const neck = toNumber(form.tourCou);
  const genre = form.genre;

  const bmi = computeBMI(weight, height);
  const bodyFat = computeBodyFatUSNavy({
    genre,
    heightCm: height,
    waistCm: waist,
    hipCm: hip,
    neckCm: neck,
  });
  const leanMass = computeLeanMass(weight, bodyFat);
  const bmr = computeBMR(leanMass);

  return {
    bmi,
    bmiInfo: bmiInterpretation(bmi),
    bodyFat,
    bodyFatInfo: bodyFatInterpretation(bodyFat, genre),
    leanMass,
    bmr,
    // Missing-input hints (for UI messaging)
    hasWeight: weight != null,
    hasHeight: height != null,
    hasWaist: waist != null,
    hasHip: hip != null,
    hasNeck: neck != null,
    needsHipForFemale: genre === 'Femme',
  };
}

export function round1(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

export function round0(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v);
}
