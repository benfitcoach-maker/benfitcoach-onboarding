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
  convertInchesToTwip,
} from "docx";
import { saveAs } from "file-saver";

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
