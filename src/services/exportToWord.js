// ─── exportToWord ──────────────────────────────────────────────────────
// V92.0 : génération .docx du plan nutrition, à ouvrir dans Word puis
// exporter en PDF natif (qualité premium garantie, accents UTF-8 OK,
// page breaks intelligents, header/footer auto).
//
// Workflow :
//   1. Anissa édite le markdown dans la modal Finaliser
//   2. Click bouton "📄 Word" → cette fonction génère un .docx
//   3. Anissa ouvre dans Word, peaufine si elle veut
//   4. Word → Enregistrer sous → PDF → impression / courrier
//
// Avantages vs jsPDF :
//   - Anissa peut modifier visuellement dans Word (pas besoin du code)
//   - Plus jamais de bugs encoding (UTF-8 natif Word depuis 30 ans)
//   - Page breaks gérés par Word (plus jamais d'orphelins de titre)
//   - Embed fonts gérés par Word
//   - PDF final = 1 clic dans Word (qualité native premium)
//
// On garde les boutons jsPDF actuels pour rétrocompat — ce service est
// un complément, pas un remplacement (du moins pour V92.0).

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  Footer,
  Header,
  PageOrientation,
  LevelFormat,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";
// V92.5 : reuse extraction logique fiche frigo (sources multiples comme FicheFrigoPreview)
import { extractFridgeDataFromSections, extractMeals, extractSupplements } from "../nutritionPdf";

// ─── Palette brand Anissa (cohérente avec PDF actuel) ────────────────
const COLORS = {
  green:    "1A2E1F",
  gold:     "C4A050",
  text:     "333330",
  textSoft: "555550",
  textMute: "8a8a7a",
};

// ─── Helpers de parsing markdown ──────────────────────────────────────

/**
 * V92.4 : parse markdown en sections {title, content} pour reuser
 * extractFridgeDataFromSections du PDF jsPDF (qui attend ce format).
 */
function parseMarkdownToFlatSections(markdown) {
  if (!markdown?.trim()) return [];
  const lines = markdown.split('\n');
  const sections = [];
  let currentTitle = '';
  let currentLines = [];
  const flush = () => {
    if (currentTitle || currentLines.length > 0) {
      sections.push({ title: currentTitle, content: currentLines.join('\n').trim() });
    }
    currentLines = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const hashMatch = line.match(/^#{2,3}\s+(.+)$/);
    const isAllCapsHeader = !hashMatch && line === line.toUpperCase() && line.length > 5 && line.length < 80;
    if (hashMatch || isAllCapsHeader) {
      flush();
      currentTitle = hashMatch ? hashMatch[1].trim() : line;
    } else {
      currentLines.push(rawLine);
    }
  }
  flush();
  return sections;
}

/**
 * Parse le markdown finalText en blocs structurés (sections + paragraphes + bullets).
 * Format simple : `## TITRE` → section, `- xxx` ou `— xxx` → bullet, sinon → paragraphe.
 */
function parseMarkdownToBlocks(markdown) {
  if (!markdown?.trim()) return [];
  const lines = markdown.split('\n');
  const blocks = [];
  let currentSection = null;

  const pushSection = () => {
    if (currentSection) blocks.push(currentSection);
    currentSection = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section header : ## ou ### ou ALL CAPS ligne courte
    const hashMatch = line.match(/^#{2,3}\s+(.+)$/);
    const isAllCapsHeader = !hashMatch && line === line.toUpperCase() && line.length > 5 && line.length < 80;

    if (hashMatch || isAllCapsHeader) {
      pushSection();
      const title = hashMatch ? hashMatch[1].trim() : line;
      currentSection = { type: 'section', title, children: [] };
      continue;
    }

    // Bullet : commence par - / — / • / *
    const bulletMatch = line.match(/^([—\-•*·]|\d+[\.\)])\s+(.+)$/);
    if (bulletMatch && currentSection) {
      currentSection.children.push({ type: 'bullet', text: bulletMatch[2].trim() });
      continue;
    }

    // Paragraphe normal
    if (!currentSection) {
      currentSection = { type: 'section', title: 'Introduction', children: [] };
    }
    currentSection.children.push({ type: 'paragraph', text: line });
  }

  pushSection();
  return blocks;
}

// ─── Builders de paragraphes ────────────────────────────────────────

function pCover(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before || 0, after: opts.after || 200 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: opts.size || 24, // half-points
        bold: opts.bold || false,
        italics: opts.italic || false,
        color: opts.color || COLORS.text,
      }),
    ],
  });
}

function pHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: "Calibri",
        size: 28,
        bold: true,
        color: COLORS.green,
      }),
    ],
    border: {
      bottom: { color: COLORS.gold, size: 8, space: 4, style: "single" },
    },
  });
}

function pBody(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 320 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        color: COLORS.text,
      }),
    ],
  });
}

function pBullet(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 300 },
    indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.2) },
    children: [
      new TextRun({
        text: "• ",
        font: "Calibri",
        size: 22,
        bold: true,
        color: COLORS.gold,
      }),
      new TextRun({
        text,
        font: "Calibri",
        size: 22,
        color: COLORS.text,
      }),
    ],
  });
}

function pSpacer(size = 200) {
  return new Paragraph({
    spacing: { before: 0, after: size },
    children: [new TextRun({ text: "" })],
  });
}

function pCoverBigTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Calibri",
        size: 80, // 40pt
        bold: true,
        color: COLORS.green,
      }),
    ],
  });
}

function pCoverEyebrow(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: "Calibri",
        size: 18, // 9pt
        bold: true,
        color: COLORS.gold,
        characterSpacing: 60,
      }),
    ],
  });
}

// ─── Source merge fiche frigo (V92.5) ─────────────────────────────
// Replique la logique de FicheFrigoPreview.jsx : merge sections > fiche_frigo_json
// > regex extraction. Source primaire = consultation.fiche_frigo_json (edite par
// Anissa dans la modal Fiche frigo). Fallback sur sections markdown puis regex.
function fromFicheJson(json, supplementsText) {
  if (!json || typeof json !== 'object') return null;
  const repas = json.repas || {};
  const supp = json.supplements || {};
  const textSupp = extractSupplements(supplementsText || '');
  const pick = (arr, fallback) => (Array.isArray(arr) && arr.length > 0 ? arr : fallback);
  return {
    breakfast: Array.isArray(repas.petit_dejeuner) ? repas.petit_dejeuner : [],
    lunch: Array.isArray(repas.dejeuner) ? repas.dejeuner : [],
    dinner: Array.isArray(repas.diner) ? repas.diner : [],
    snack: typeof repas.collation === 'string' ? repas.collation : '',
    toFavor: Array.isArray(json.a_privilegier) ? json.a_privilegier : [],
    toLimit: Array.isArray(json.a_limiter) ? json.a_limiter : [],
    hydration: typeof json.hydratation === 'string' ? json.hydratation : '',
    supplements: {
      morningFasting: pick(supp.matin_a_jeun, textSupp.morningFasting),
      breakfast: pick(supp.petit_dejeuner, textSupp.breakfast),
      lunch: pick(supp.midi, textSupp.lunch),
      dinner: pick(supp.soir, textSupp.dinner),
      bedtime: pick(supp.coucher, textSupp.bedtime),
    },
  };
}

function buildFridgeData(consultation, sections, client) {
  const ficheJson = consultation?.ficheFrigoJson || consultation?.fiche_frigo_json || null;
  const fromJson = fromFicheJson(ficheJson, consultation?.supplements);
  const fromSections = extractFridgeDataFromSections(sections || []);
  const regexMeals = extractMeals(consultation?.nutritionPlan || consultation?.nutrition_plan || '');
  const regexSupp = extractSupplements(consultation?.supplements || '');
  const form = client?.form || {};

  const pickArr = (...sources) => {
    for (const s of sources) if (Array.isArray(s) && s.length > 0) return s;
    return [];
  };
  const pickStr = (...sources) => {
    for (const s of sources) if (typeof s === 'string' && s.trim()) return s;
    return '';
  };

  const s = fromSections || {};
  const j = fromJson || {};
  const jSupp = j.supplements || {};

  // Forbidden = aliments allergies + alimentsEvites du form (comme FicheFrigoPreview)
  const extractFormList = (field) =>
    (form[field] || '').split(/[,;/]+/).map(x => x.trim()).filter(x => x.length > 1);
  const forbidden = [...new Set([...extractFormList('allergies'), ...extractFormList('alimentsEvites')])];

  return {
    breakfast: pickArr(s.breakfast, j.breakfast, regexMeals.breakfast),
    lunch: pickArr(s.lunch, j.lunch, regexMeals.lunch),
    dinner: pickArr(s.dinner, j.dinner, regexMeals.dinner),
    snack: pickStr(s.snack, j.snack, regexMeals.snack),
    toFavor: pickArr(s.toFavor, j.toFavor, regexMeals.toFavor),
    toLimit: pickArr(s.toLimit, j.toLimit, regexMeals.toLimit),
    forbidden,
    hydration: pickStr(s.hydration, j.hydration, regexMeals.hydration, form.hydratation),
    supplements: {
      morningFasting: pickArr(jSupp.morningFasting, regexSupp.morningFasting),
      breakfast: pickArr(jSupp.breakfast, regexSupp.breakfast),
      lunch: pickArr(jSupp.lunch, regexSupp.lunch),
      dinner: pickArr(jSupp.dinner, regexSupp.dinner),
      bedtime: pickArr(jSupp.bedtime, regexSupp.bedtime),
    },
  };
}

// ─── Builders Fiche Frigo enrichie (V92.4 → V92.5 fix) ─────────────────────

/** Cell d'en-tete de colonne repas (vert sapin sur fond clair) */
function frigoMealHeaderCell(label, widthPct) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: COLORS.green, fill: COLORS.green },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: label.toUpperCase(),
            font: "Calibri",
            size: 18,
            bold: true,
            color: "FAF9F6",
          }),
        ],
      }),
    ],
  });
}

/** Cell de contenu repas (liste d'items, bg blanc cassé) */
function frigoMealBodyCell(items, widthPct) {
  const children = items?.length
    ? items.map((item) =>
        new Paragraph({
          spacing: { before: 30, after: 30 },
          children: [
            new TextRun({ text: "• ", font: "Calibri", size: 18, color: COLORS.gold }),
            new TextRun({ text: item, font: "Calibri", size: 18, color: COLORS.text }),
          ],
        })
      )
    : [
        new Paragraph({
          children: [new TextRun({ text: "—", font: "Calibri", size: 16, color: COLORS.textMute })],
        }),
      ];

  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: "FAF9F6", fill: "FAF9F6" },
    margins: { top: 140, bottom: 140, left: 140, right: 140 },
    children,
  });
}

/** Bloc "À PRIVILÉGIER" / "À LIMITER" — couleur de fond + items en pills */
function frigoListBlock(label, items, accentColor, bgColor) {
  if (!items?.length) return [];
  return [
    new Paragraph({
      spacing: { before: 220, after: 80 },
      children: [
        new TextRun({
          text: label.toUpperCase(),
          font: "Calibri",
          size: 18,
          bold: true,
          color: accentColor,
          characterSpacing: 60,
        }),
      ],
    }),
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
      spacing: { before: 0, after: 0, line: 320 },
      children: [
        new TextRun({
          text: "  " + items.join(" · ") + "  ",
          font: "Calibri",
          size: 20,
          color: COLORS.text,
        }),
      ],
    }),
  ];
}

/**
 * Construit la page Fiche Frigo enrichie : header + table 3 colonnes
 * repas + blocs À PRIVILÉGIER / À LIMITER + hydratation.
 * Retourne null si pas assez de data pour faire un rendu utile.
 */
function buildFridgePage(fridgeData, prenom) {
  if (!fridgeData) return null;
  const hasMeals = fridgeData.breakfast?.length || fridgeData.lunch?.length || fridgeData.dinner?.length;
  const hasTags = fridgeData.toFavor?.length || fridgeData.toLimit?.length || fridgeData.forbidden?.length;
  const supp = fridgeData.supplements || {};
  const hasSupp = supp.morningFasting?.length || supp.breakfast?.length || supp.lunch?.length || supp.dinner?.length || supp.bedtime?.length;
  if (!hasMeals && !hasTags && !hasSupp) return null;

  const children = [];

  // Page break + titre
  children.push(
    new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: "FICHE FRIGO",
          font: "Calibri",
          size: 36,
          bold: true,
          color: COLORS.green,
          characterSpacing: 80,
        }),
      ],
      border: {
        bottom: { color: COLORS.gold, size: 12, space: 6, style: "single" },
      },
    })
  );
  children.push(
    new Paragraph({
      spacing: { before: 60, after: 240 },
      children: [
        new TextRun({
          text: `Repères du quotidien pour ${prenom}.`,
          font: "Calibri",
          size: 18,
          italics: true,
          color: COLORS.textSoft,
        }),
      ],
    })
  );

  // Table 3 colonnes repas
  if (hasMeals) {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: "FAF9F6" },
        insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "FAF9F6" },
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            frigoMealHeaderCell("Petit-déjeuner", 33),
            frigoMealHeaderCell("Déjeuner", 34),
            frigoMealHeaderCell("Dîner", 33),
          ],
        }),
        new TableRow({
          children: [
            frigoMealBodyCell(fridgeData.breakfast || [], 33),
            frigoMealBodyCell(fridgeData.lunch || [], 34),
            frigoMealBodyCell(fridgeData.dinner || [], 33),
          ],
        }),
      ],
    });
    children.push(table);
  }

  // Collation + hydratation (compact)
  if (fridgeData.snack || fridgeData.hydration) {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({
            text: "ESSENTIELS DU JOUR",
            font: "Calibri",
            size: 18,
            bold: true,
            color: COLORS.gold,
            characterSpacing: 80,
          }),
        ],
      })
    );
    if (fridgeData.snack) {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "Collation : ", font: "Calibri", size: 20, bold: true, color: COLORS.green }),
            new TextRun({ text: fridgeData.snack, font: "Calibri", size: 20, color: COLORS.text }),
          ],
        })
      );
    }
    if (fridgeData.hydration) {
      children.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "Hydratation : ", font: "Calibri", size: 20, bold: true, color: COLORS.green }),
            new TextRun({ text: fridgeData.hydration, font: "Calibri", size: 20, color: COLORS.text }),
          ],
        })
      );
    }
  }

  // À privilégier (vert) / À limiter (ambre) / Interdit (rouge)
  children.push(...frigoListBlock("À privilégier", fridgeData.toFavor, "2E4E38", "EAEFE9"));
  children.push(...frigoListBlock("À limiter", fridgeData.toLimit, "B85C00", "FBEFD9"));
  children.push(...frigoListBlock("Interdit", fridgeData.forbidden, "A12D2D", "F7DCDC"));

  // V92.5 : MES COMPLEMENTS — table 5 colonnes (matin à jeun / petit-déj / midi / soir / coucher)
  if (hasSupp) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 100 },
        children: [
          new TextRun({
            text: "MES COMPLÉMENTS",
            font: "Calibri",
            size: 18,
            bold: true,
            color: COLORS.gold,
            characterSpacing: 80,
          }),
        ],
      })
    );

    const moments = [
      { label: "Matin à jeun", items: supp.morningFasting || [] },
      { label: "Petit-déjeuner", items: supp.breakfast || [] },
      { label: "Midi", items: supp.lunch || [] },
      { label: "Soir", items: supp.dinner || [] },
      { label: "Coucher", items: supp.bedtime || [] },
    ];

    const headerCells = moments.map((m) => frigoMealHeaderCell(m.label, 20));
    const bodyCells = moments.map((m) => frigoMealBodyCell(m.items, 20));

    const suppTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: "FAF9F6" },
        insideVertical: { style: BorderStyle.SINGLE, size: 6, color: "FAF9F6" },
      },
      rows: [
        new TableRow({ tableHeader: true, children: headerCells }),
        new TableRow({ children: bodyCells }),
      ],
    });
    children.push(suppTable);
  }

  return children;
}

// ─── V92.6 : Export standalone Fiche Frigo ────────────────────────
// Génère un .docx contenant uniquement la Fiche Frigo, à imprimer + plastifier
// + coller sur le frigo de la cliente. Indépendant du plan alimentaire principal.
// Utilise les données déjà éditées dans la modal FicheFrigoPreview (getEditedData)
// pour respecter les modifs d'Anissa.
export async function exportFridgeToWord(client, consultation, fridgeData) {
  const prenom = (client?.prenom || 'Cliente').trim();
  const fridgePageChildren = buildFridgePage(fridgeData, prenom);
  if (!fridgePageChildren) {
    throw new Error('Fiche Frigo vide — rien à exporter.');
  }

  // Premier paragraphe sans pageBreakBefore (sinon page blanche au début)
  const first = fridgePageChildren[0];
  if (first && first.options) first.options.pageBreakBefore = false;

  const doc = new Document({
    creator: "Anissa Deroubaix Nutrition",
    title: `Fiche Frigo — ${prenom}`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.6),
            bottom: convertInchesToTwip(0.6),
            left: convertInchesToTwip(0.6),
            right: convertInchesToTwip(0.6),
          },
          size: { orientation: PageOrientation.PORTRAIT },
        },
      },
      children: fridgePageChildren,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeDate = formatFrDate(consultation?.date).replace(/[\/\\:*?"<>|.]/g, '-');
  saveAs(blob, `Fiche-Frigo-${prenom}-${safeDate}.docx`);
}

// ─── Document builder principal ────────────────────────────────────

/**
 * @param {object} client - { prenom, nom?, form?: { ... } }
 * @param {object} consultation - { date, objective?, ... }
 * @param {string} finalText - markdown du plan édité
 */
export async function exportPlanToWord(client, consultation, finalText) {
  const prenom = (client?.prenom || 'Cliente').trim();
  const date = formatFrDate(consultation?.date);
  const objectif = (consultation?.objective || client?.form?.objectifPrincipalNutrition || '').trim();

  const blocks = parseMarkdownToBlocks(finalText || '');

  // V92.5 : extraction Fiche Frigo enrichie via buildFridgeData (merge sources :
  // sections markdown > consultation.fiche_frigo_json > regex fallback).
  // Reproduit fidelement la logique de FicheFrigoPreview.jsx pour avoir la
  // MEME donnee structuree que la modal "Fiche Frigo" du SaaS et le PDF jsPDF.
  // Inclut aussi forbidden (form.allergies + alimentsEvites) + supplements 5 moments.
  const flatSections = parseMarkdownToFlatSections(finalText || '');
  let fridgeData = null;
  try {
    fridgeData = buildFridgeData(consultation, flatSections, client);
  } catch {
    fridgeData = null;
  }

  // ─── COVER PAGE ─────────────────────────────────────────────────
  const coverChildren = [
    // espace haut
    pSpacer(2400),
    pCoverEyebrow("Plan nutritionnel"),
    pCoverBigTitle("Personnalisé"),
    pSpacer(200),
    pCover(prenom, { size: 48, bold: true, color: COLORS.green }),
    pSpacer(120),
  ];

  if (objectif) {
    coverChildren.push(pCoverEyebrow("Objectif"));
    coverChildren.push(
      pCover(objectif, {
        size: 22,
        italic: true,
        color: COLORS.textSoft,
      })
    );
  }

  coverChildren.push(pSpacer(800));
  coverChildren.push(pCover(date, { size: 20, color: COLORS.textMute }));
  coverChildren.push(pSpacer(2400));
  coverChildren.push(
    pCover("Anissa Deroubaix Nutrition", {
      size: 22,
      bold: true,
      color: COLORS.green,
    })
  );
  coverChildren.push(
    pCover("Nutritionniste spécialisée en longévité et génétique", {
      size: 18,
      italic: true,
      color: COLORS.textSoft,
    })
  );
  coverChildren.push(
    pCover("AB Coaching Sarl · Rue de Rive 28 · 1260 Nyon", {
      size: 16,
      color: COLORS.textMute,
    })
  );
  // Page break après cover
  coverChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "", break: 1 })],
      pageBreakBefore: false,
    })
  );

  // ─── CONTENU PRINCIPAL ────────────────────────────────────────
  const contentChildren = [];
  for (const block of blocks) {
    if (block.type === 'section') {
      // V92.4 : si on va rendre une page Fiche Frigo enrichie, on saute la
      // section basique pour éviter doublon visuel.
      if (fridgeData && /fiche\s*frigo|frigo/i.test(block.title)) continue;

      contentChildren.push(pHeading(block.title));
      for (const child of block.children) {
        if (child.type === 'bullet') {
          contentChildren.push(pBullet(child.text));
        } else if (child.type === 'paragraph') {
          contentChildren.push(pBody(child.text));
        }
      }
      contentChildren.push(pSpacer(120));
    }
  }

  // V92.6 : Fiche Frigo retirée du plan principal — désormais exportée en
  // .docx séparé via exportFridgeToWord (modal Fiche Frigo) pour pouvoir être
  // imprimée + plastifiée + collée sur le frigo, indépendamment du plan.

  // ─── HEADER / FOOTER (pages 2+) ───────────────────────────────
  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `${prenom} · Plan nutrition personnalisé · ${date}`,
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
        ],
      }),
    ],
  });

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Anissa Deroubaix Nutrition · ",
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
          new TextRun({
            text: "/",
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
          new TextRun({
            text: " · Confidentiel",
            font: "Calibri",
            size: 16,
            color: COLORS.textMute,
          }),
        ],
      }),
    ],
  });

  // ─── DOCUMENT ASSEMBLY ────────────────────────────────────────
  // Section 1 : cover (sans header/footer)
  // Section 2 : contenu (avec header + footer)
  const doc = new Document({
    creator: "Anissa Deroubaix Nutrition",
    title: `Plan nutrition - ${prenom}`,
    description: `Plan nutritionnel personnalisé pour ${prenom}`,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            size: { orientation: PageOrientation.PORTRAIT },
          },
          titlePage: false,
        },
        children: coverChildren,
      },
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        headers: { default: docHeader },
        footers: { default: docFooter },
        children: contentChildren,
      },
    ],
  });

  // Génère le blob et déclenche le download
  const blob = await Packer.toBlob(doc);
  // Sanitize date pour filename (Windows interdit /, \, :, *, ?, ", <, >, |)
  const safeDate = date.replace(/[\/\\:*?"<>|.]/g, '-');
  const filename = `plan-nutrition-${slugify(prenom)}-${safeDate}.docx`;
  saveAs(blob, filename);

  return { ok: true, filename };
}

// ─── Helpers ────────────────────────────────────────────────────

function formatFrDate(dateInput) {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString("fr-FR");
    return d.toLocaleDateString("fr-FR");
  } catch {
    return new Date().toLocaleDateString("fr-FR");
  }
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
