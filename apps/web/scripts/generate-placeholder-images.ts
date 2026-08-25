import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Blocks,
  Building2,
  Droplets,
  Layers,
  Paintbrush,
  PlugZap,
  TreeDeciduous,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Generates one branded, on-theme square placeholder image per official category, replacing the
 * unrelated random stock photos (picsum.photos) previously used in db/seed.ts. Run once with
 * `pnpm tsx scripts/generate-placeholder-images.ts` whenever the category list or palette changes
 * — outputs land in public/placeholders/<slug>.svg and are referenced directly by seed.ts.
 */
const CANVAS = 800;
const BG = "#efefec";
const RED = "#c6371e";
const ORANGE = "#e8791f";
const LABEL_COLOR = "#2a2721";

const CATEGORIES: { name: string; slug: string; icon: LucideIcon }[] = [
  { name: "Argamassa", slug: "argamassa", icon: Layers },
  { name: "Estrutura", slug: "estrutura", icon: Building2 },
  { name: "Acabamento", slug: "acabamento", icon: Paintbrush },
  { name: "Instalações", slug: "instalacoes", icon: PlugZap },
  { name: "Ferramentas", slug: "ferramentas", icon: Wrench },
  { name: "Hidráulica", slug: "hidraulica", icon: Droplets },
  { name: "Elétrica", slug: "eletrica", icon: Zap },
  { name: "Madeira", slug: "madeira", icon: TreeDeciduous },
  { name: "Alvenaria", slug: "alvenaria", icon: Blocks },
];

function extractIconInner(icon: LucideIcon): string {
  const markup = renderToStaticMarkup(createElement(icon, { size: 24, strokeWidth: 1.75 }));
  const match = markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!match) throw new Error("Could not extract icon markup");
  return match[1];
}

function buildSvg(name: string, slug: string, icon: LucideIcon, accent: string): string {
  const iconInner = extractIconInner(icon);
  const iconDisplaySize = 340;
  const scale = iconDisplaySize / 24;
  const cx = CANVAS / 2;
  const cy = CANVAS / 2 - 40;
  const circleR = 220;
  const tx = cx - (24 * scale) / 2;
  const ty = cy - (24 * scale) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="${BG}" />
  <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="${accent}" />
  <g transform="translate(${tx}, ${ty}) scale(${scale})" stroke="#f6f1e7" fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${iconInner}
  </g>
  <text x="${CANVAS / 2}" y="${CANVAS - 90}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="${LABEL_COLOR}">${name}</text>
  <text x="${CANVAS / 2}" y="${CANVAS - 48}" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${LABEL_COLOR}" opacity="0.55">Foto ilustrativa</text>
</svg>`;
}

const outDir = join(__dirname, "..", "public", "placeholders");
CATEGORIES.forEach((category, i) => {
  const accent = i % 2 === 0 ? RED : ORANGE;
  const svg = buildSvg(category.name, category.slug, category.icon, accent);
  writeFileSync(join(outDir, `${category.slug}.svg`), svg, "utf8");
  console.log(`✓ ${category.slug}.svg`);
});
