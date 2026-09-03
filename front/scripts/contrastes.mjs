// Calcul des ratios de contraste WCAG 2.1 (formule officielle de relative
// luminance et de contrast ratio).
//
//   node scripts/contrastes.mjs            table lisible
//   node scripts/contrastes.mjs --md       table Markdown (pour le brand book)
//
// C'est l'outil cite dans le brand book. Les couleurs sont copiees de
// src/styles/tokens.css : le CSS fait foi, ce fichier reste synchronise.
// Sortie non nulle uniquement si un couple echoue AUSSI le seuil 3:1
// (composants d'interface / grand texte). Les couples entre 3:1 et 4,5:1
// sont signales, pas maquilles.

const JETONS = {
  primaire: "#1B3A6B",
  "primaire-clair": "#2F5590",
  "primaire-sombre": "#12294C",
  "accent-ambre": "#F2A81C",
  "accent-ambre-sombre": "#B97B06",
  "accent-corail": "#E4572E",
  "accent-corail-sombre": "#C0421D",
  "accent-corail-fond": "#FBE7E0",
  texte: "#1A1A1A",
  "texte-secondaire": "#55606B",
  fond: "#FFFFFF",
  "fond-secondaire": "#F4F6F9",
  bordure: "#D6DBE3",
  alerte: "#A0341C",
  succes: "#0B6B4F",
  "succes-fond": "#E4F0EB",
  simulation: "#7A5E12",
  "simulation-fond": "#FDF6E3",
  blanc: "#FFFFFF",
};

// Couples texte / fond reellement utilises dans l'interface.
// `grand` = vrai si la valeur est affichee en >= 24px (ou 18,66px gras) :
// le seuil AA descend alors a 3:1.
const COUPLES = [
  ["blanc", "primaire", false, "Texte du rail de navigation, libelles sur la carte solde"],
  ["blanc", "primaire-sombre", false, "Texte sur le degrade sombre de la carte"],
  ["blanc", "primaire-clair", false, "Texte sur le degrade clair de la carte"],
  ["texte", "accent-ambre", false, "Libelle du bouton d'action principal"],
  ["accent-corail-sombre", "fond", false, "Lien d'accent, indicateur actif sur fond blanc"],
  ["texte", "fond", false, "Corps de texte"],
  ["texte", "fond-secondaire", false, "Corps de texte sur le fond de page"],
  ["texte-secondaire", "fond", false, "Metadonnees, dates, aides"],
  ["primaire", "fond", false, "Titres de section, liens de navigation"],
  ["succes", "succes-fond", false, "Pastille valide / correction"],
  ["alerte", "fond", false, "Statut annule, messages d'erreur"],
  ["simulation", "simulation-fond", false, "Bandeau et mention de simulation"],
];

function lineariser(canal) {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * lineariser((n >> 16) & 255) +
    0.7152 * lineariser((n >> 8) & 255) +
    0.0722 * lineariser(n & 255)
  );
}
function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const md = process.argv.includes("--md");
const lignes = COUPLES.map(([texte, fond, grand, usage]) => {
  const r = ratio(JETONS[texte], JETONS[fond]);
  const seuil = grand ? 3 : 4.5;
  const verdict = r >= seuil ? "AA" : r >= 3 ? "AA grand texte seulement" : "ECHEC";
  return { texte, fond, hexTexte: JETONS[texte], hexFond: JETONS[fond], usage, grand, r, verdict };
});

if (md) {
  console.log("| Texte | Fond | Ratio | Seuil | Verdict | Usage |");
  console.log("|---|---|--:|--:|---|---|");
  for (const l of lignes) {
    console.log(
      `| \`${l.hexTexte}\` | \`${l.hexFond}\` | ${l.r.toFixed(2)}:1 | ${l.grand ? "3:1" : "4,5:1"} | ${l.verdict} | ${l.usage} |`,
    );
  }
} else {
  for (const l of lignes) {
    const d = l.verdict === "AA" ? "OK " : l.verdict === "ECHEC" ? "XX " : "!! ";
    console.log(`${d}${l.r.toFixed(2).padStart(6)}:1  ${l.texte} / ${l.fond}  (${l.verdict})`);
  }
}

const echecs = lignes.filter((l) => l.verdict === "ECHEC");
const sousAA = lignes.filter((l) => l.verdict === "AA grand texte seulement");
if (sousAA.length) console.error(`\nSignales (3:1 a 4,5:1) : ${sousAA.map((l) => `${l.texte}/${l.fond}`).join(", ")}`);
if (echecs.length) {
  console.error(`ECHEC (< 3:1) : ${echecs.map((l) => `${l.texte}/${l.fond}`).join(", ")}`);
  process.exitCode = 1;
}
