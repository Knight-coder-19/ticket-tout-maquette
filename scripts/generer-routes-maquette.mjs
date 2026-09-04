// Génère src/mocks/serveur-local.routes.ts : la table des routes /api servies
// dans le navigateur pour la maquette statique (aucun backend, aucun route
// handler Next). Les modules handlers sont déplacés sous src/mocks/api/.
import { readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FRONT = process.argv[2]; // chemin absolu de front/
const SRC = join(FRONT, "src/mocks/api");

const routes = [];
function walk(dir, rel = "") {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) walk(p, `${rel}/${nom}`);
    else if (nom === "route.ts") {
      const src = readFileSync(p, "utf8");
      const verbes = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      routes.push({ rel, verbes });
    }
  }
}
walk(SRC);
routes.sort((a, b) => b.rel.length - a.rel.length); // les plus spécifiques d'abord

const lignes = [];
lignes.push("// FICHIER GÉNÉRÉ — ne pas éditer à la main. Voir scratchpad/gen-routes.mjs.");
lignes.push('// Table des routes /api servies côté navigateur pour la maquette statique.');
lignes.push("/* eslint-disable */");
lignes.push("");
lignes.push("type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;");
lignes.push("export interface RouteLocale {");
lignes.push("  motif: RegExp;");
lignes.push("  params: string[];");
lignes.push("  handlers: Partial<Record<string, Handler>>;");
lignes.push("}");
lignes.push("");

routes.forEach((r, i) => {
  const mod = `./api${r.rel}/route`;
  lignes.push(`import * as r${i} from ${JSON.stringify(mod)};`);
});
lignes.push("");
lignes.push("export const routesLocales: RouteLocale[] = [");
routes.forEach((r, i) => {
  const params = [];
  const motif =
    "^/api" +
    r.rel
      .split("/")
      .filter(Boolean)
      .map((seg) => {
        const m = seg.match(/^\[(\.\.\.)?(.+)\]$/);
        if (m) {
          params.push(m[2]);
          return "/" + (m[1] ? "(.+)" : "([^/]+)");
        }
        return "/" + seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("") +
    "/?$";
  const handlers = r.verbes.map((v) => `${v}: (r${i} as any).${v}`).join(", ");
  lignes.push(`  { motif: new RegExp(${JSON.stringify(motif)}), params: ${JSON.stringify(params)}, handlers: { ${handlers} } },`);
});
lignes.push("];");
lignes.push("");

writeFileSync(join(FRONT, "src/mocks/serveur-local.routes.ts"), lignes.join("\n"));
console.log("routes:", routes.length);
for (const r of routes) console.log(" ", r.verbes.join(","), r.rel);
