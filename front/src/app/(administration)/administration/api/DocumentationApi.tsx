/**
 * La documentation de l'API — ce qui existe vraiment, et rien de plus.
 *
 * ⚠⚠ CET ÉCRAN NE FAIT AUCUN APPEL. Il n'y a rien à charger : c'est une page
 * de RÉFÉRENCE, statique, comme le contrat qu'elle documente.
 *
 * ─── Ce qu'un vrai portail développeur aurait, et que celui-ci n'a pas ───
 *
 * `GET /docs` sert une interface Swagger — MAIS UNIQUEMENT EN
 * DÉVELOPPEMENT (`openapi.rs:1`). Aucune route ne sert `openapi.json` en
 * production. Cet écran ne prétend donc pas remplacer une documentation
 * interactive : il documente à la main la SEULE route pensée pour un système
 * tiers, parce que c'est tout ce que le contrat expose.
 *
 * ─── Ce que cet écran ne montre pas, et pourquoi ───
 *
 * Aucune liste de clients applicatifs enregistrés (`api_clients`) : ni le
 * contrat ni le back n'exposent de route pour les gérer depuis ce front, et
 * en inventer une confondrait « documenter ce qui existe » avec « construire
 * une fonctionnalité qu'on ne nous a pas demandée ».
 */

import "@/styles/primitives.css";
import "@/styles/api.css";

import { ExempleAppel } from "./ExempleAppel";
import { TableauEndpoints } from "./TableauEndpoints";

export function DocumentationApi() {
  return (
    <div className="api">
      <h1 className="ecran__titre">Documentation de l&apos;API</h1>
      <p className="ecran__intro">
        Ce que le dispositif expose à un système tiers — le SIRH d&apos;un
        employeur, pour l&apos;essentiel. Rien de plus n&apos;est documenté
        ici, parce que rien de plus n&apos;existe.
      </p>

      <div className="api__avertissement" role="note">
        <p>
          <strong>Aucune documentation générée n&apos;est servie en production.</strong>{" "}
          L&apos;interface Swagger du dispositif (<code>GET /docs</code>) n&apos;existe
          qu&apos;en environnement de développement. Cette page en tient lieu,
          écrite à la main à partir de ce que le code et le schéma
          disent réellement.
        </p>
      </div>

      <TableauEndpoints />

      <ExempleAppel />
    </div>
  );
}
