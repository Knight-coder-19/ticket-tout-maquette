/**
 * Un appel illustré — pas un exemple à copier tel quel.
 *
 * ⚠⚠ LE SCHÉMA D'AUTHENTIFICATION N'EST NOMMÉ NULLE PART DANS LE CONTRAT.
 * `extractors/api_client.rs:2` dit « read from the authorization header
 * against the hashed secret » ; `file-guide.md:263` dit « lit l'en-tête
 * d'autorisation ». Ni `Basic`, ni `Bearer`, ni un en-tête maison ne sont
 * écrits nulle part. La table `api_clients` (`0001_schema.sql:254-262`) porte
 * `client_id TEXT UNIQUE` et `secret_hash TEXT` — compatible avec `Basic`,
 * mais ce n'est pas écrit, et deviner serait mentir avec la même assurance
 * qu'un fait établi.
 *
 * Cet exemple montre donc la STRUCTURE de l'appel — un en-tête
 * d'autorisation est requis, HTTPS est obligatoire, le matricule va dans le
 * chemin — sans prétendre au format exact du secret. Le jour où le back
 * précisera le schéma, seul l'en-tête change ; le reste de cet exemple reste
 * vrai.
 */
export function ExempleAppel() {
  return (
    <section aria-labelledby="exemple-titre">
      <h2 className="reclamations__soustitre" id="exemple-titre">
        Exemple d&apos;appel
      </h2>

      <p>
        Le matricule (<code>employer_ref</code>) va dans le CHEMIN ; l&apos;employeur,
        lui, est déduit de l&apos;authentification — jamais du chemin (décision
        12). Deux employeurs ne peuvent donc pas se lire l&apos;un l&apos;autre en
        changeant le matricule dans l&apos;URL : c&apos;est le secret présenté qui
        détermine de quel employeur on parle.
      </p>

      <pre className="bloc-code">
        <code>{`curl https://cartepro.example/api/v1/integration/employees/MC-4471/balance \\
  -H "Authorization: <clé fournie par le dispositif>"

# 200 — { "employer_ref": "MC-4471", "settled": 150.00,
#         "held": 25.00, "available": 125.00,
#         "currency": "EUR", "as_of": "2026-09-25T10:00:00Z" }`}</code>
      </pre>

      <p className="api__aide">
        <code>&lt;clé fournie par le dispositif&gt;</code> tient la place du
        schéma réel : voir l&apos;avertissement ci-dessus. Le corps de la
        réponse, lui, EST celui du contrat — <code>SirhBalance</code>,
        <code>data-dictionary.md:588-596</code>.
      </p>

      <p className="api__aide">
        Sans HTTPS, ou sans en-tête d&apos;autorisation valide : <code>401</code>.
        Un matricule inconnu de l&apos;employeur authentifié : <code>404</code> —
        jamais un indice qui dirait s&apos;il existe pour un AUTRE employeur.
        Trop d&apos;appels pour ce client : <code>429</code>.
      </p>
    </section>
  );
}
