/**
 * Capture les écrans du SaaS pour audit visuel.
 *
 * Login Anissa → screenshot du dashboard + sections principales.
 * Sortie : audit/saas/{nom-section}.png à la racine du projet.
 *
 * Usage :
 *   node scripts/capture-saas-audit.js
 *   node scripts/capture-saas-audit.js --local
 */

const { chromium } = require("playwright-core");
const path = require("path");
const fs = require("fs");

const USE_LOCAL = process.argv.includes("--local");
const BASE_URL = USE_LOCAL ? "http://localhost:5173" : "https://app.anissanutrition.ch";
const OUTPUT_DIR = path.join(__dirname, "..", "audit", "saas");
const PASSWORD = "Luxembourg2010#";

async function shoot(page, name) {
  const out = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`  ✓ ${name}.png`);
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: path.join(
      process.env.LOCALAPPDATA,
      "ms-playwright",
      "chromium_headless_shell-1217",
      "chrome-headless-shell-win64",
      "chrome-headless-shell.exe"
    ),
  });

  // Desktop viewport (le SaaS est desktop-only par memoire)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log(`\n🌐 ${BASE_URL}`);
  console.log(`📁 ${OUTPUT_DIR}\n`);

  // ─── 1. LOGIN ──────────────────────────────────────────────────────
  console.log("→ login screen");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shoot(page, "01-login-select");

  console.log("→ click Anissa");
  // Trouver le bouton avec le span "Anissa"
  await page.locator('button:has-text("Anissa")').first().click();
  await page.waitForTimeout(800);
  await shoot(page, "02-login-password");

  console.log("→ submit password");
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  // Attendre la redirection vers dashboard
  await page.waitForTimeout(3000);
  // Si toujours pas connecté, log
  const stillLogin = await page.locator('input[type="password"]').count();
  if (stillLogin > 0) {
    console.error("✗ Login failed — still on password screen");
    await shoot(page, "ERROR-login-failed");
    await browser.close();
    process.exit(1);
  }
  console.log("✓ Connecté");

  // ─── 2. DASHBOARD ──────────────────────────────────────────────────
  console.log("\n→ dashboard");
  await page.waitForTimeout(1500);
  await shoot(page, "03-dashboard-anissa");

  // Si on cherche le 1er client (probablement Mélissa) on clique dessus
  console.log("→ recherche Mélissa");
  // Tenter de chercher via la barre de recherche
  const searchInput = page.locator('input[type="search"], input[placeholder*="echer"], input[placeholder*="cher"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill("melissa");
    await page.waitForTimeout(800);
    await shoot(page, "04-dashboard-search-melissa");
  }

  // Cliquer sur le 1er résultat (carte client melissa)
  const melissaCard = page.locator('text=/^melissa$/i').first();
  if (await melissaCard.count() > 0) {
    await melissaCard.click();
    await page.waitForTimeout(2500);
    await shoot(page, "05-fiche-client-resume");
  } else {
    console.log("  ⚠ Mélissa non trouvée par recherche, on tente sur tout le dashboard");
  }

  // ─── 3. FICHE CLIENTE — onglets verticaux ───────────────────────────
  // Les onglets sont : Resume client / Plan nutrition / Notes internes
  console.log("\n→ fiche cliente onglets");

  for (const tab of ["Plan nutrition", "Notes internes", "Resume client"]) {
    const btn = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1500);
      await shoot(page, `06-onglet-${tab.toLowerCase().replace(/\s+/g, "-")}`);
    }
  }

  // ─── 4. EDITEUR — sub-tabs ──────────────────────────────────────────
  console.log("\n→ editeur sub-tabs");

  // S'assurer qu'on est sur Plan nutrition pour voir l'editeur
  const planTab = page.locator('button:has-text("Plan nutrition"), [role="tab"]:has-text("Plan nutrition")').first();
  if (await planTab.count() > 0) {
    await planTab.click();
    await page.waitForTimeout(1500);
  }

  for (const tab of ["Plan complet", "Fiche frigo", "Plan S1-S4", "Supplements", "App cliente"]) {
    const btn = page.locator(`button:has-text("${tab}")`).first();
    if (await btn.count() > 0) {
      try {
        await btn.click();
        await page.waitForTimeout(1500);
        await shoot(page, `07-editeur-${tab.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`);
      } catch (e) {
        console.log(`  ⚠ skip ${tab}: ${e.message}`);
      }
    }
  }

  // ─── 5. APP CLIENTE — sub-sub-tabs ──────────────────────────────────
  console.log("\n→ app cliente sub-tabs");
  // On devrait être sur App cliente déjà
  const appTab = page.locator('button:has-text("App cliente")').first();
  if (await appTab.count() > 0) {
    await appTab.click();
    await page.waitForTimeout(1500);
  }

  for (const tab of ["Vue d'ensemble", "Lettre", "Recettes", "Messages", "Ressources", "Signaux"]) {
    const btn = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
    if (await btn.count() > 0) {
      try {
        await btn.click();
        await page.waitForTimeout(1500);
        await shoot(page, `08-appcliente-${tab.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`);
      } catch (e) {
        console.log(`  ⚠ skip app cliente ${tab}: ${e.message}`);
      }
    }
  }

  // ─── 6. NAV principale — Agenda / Chiffres / Compléments ────────────
  console.log("\n→ nav top");

  for (const nav of ["Agenda", "Chiffres", "Complements"]) {
    const btn = page.locator(`a:has-text("${nav}"), button:has-text("${nav}"), nav >> text=${nav}`).first();
    if (await btn.count() > 0) {
      try {
        await btn.click();
        await page.waitForTimeout(2000);
        await shoot(page, `09-nav-${nav.toLowerCase()}`);
      } catch (e) {
        console.log(`  ⚠ skip nav ${nav}: ${e.message}`);
      }
    }
  }

  // ─── 7. DASHBOARD final (revenu) ────────────────────────────────────
  console.log("\n→ retour dashboard");
  const dashBtn = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard")').first();
  if (await dashBtn.count() > 0) {
    await dashBtn.click();
    await page.waitForTimeout(1500);
    await shoot(page, "10-dashboard-final");
  }

  await browser.close();
  console.log(`\n✓ Captures terminées → ${OUTPUT_DIR}\n`);
}

run().catch(async (err) => {
  console.error("\n✗ Erreur :", err.message);
  console.error(err.stack);
  process.exit(1);
});
