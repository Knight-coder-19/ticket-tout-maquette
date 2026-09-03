/**
 * La surface machine-à-machine du dispositif — un tableau de référence.
 *
 * ✅ La route existe (`data-dictionary.md:588-596`, `routes/integration.rs:1-3`).
 * C'est la SEULE de tout le contrat pensée pour un système tiers plutôt que
 * pour ce front : les employeurs y branchent leur SIRH pour lire le solde
 * d'un salarié sans repasser par une session humaine.
 *
 * Un tableau à une ligne n'est pas un artifice : il dit honnêtement qu'il
 * n'y a qu'UN SEUL point d'entrée public, là où un vrai portail développeur
 * en compterait des dizaines. Un tableau vide aurait laissé croire à une
 * omission ; une seule ligne dit qu'on a cherché et trouvé exactement cela.
 */
export function TableauEndpoints() {
  return (
    <div className="tableau-defilant" tabIndex={0} role="region" aria-label="Points d'entrée disponibles">
      <table className="registre">
        <caption>
          Le seul point d&apos;entrée ouvert à un système tiers. Toutes les
          autres routes du dispositif servent ce front, pas une intégration
          externe.
        </caption>
        <thead>
          <tr>
            <th scope="col">Méthode</th>
            <th scope="col">Chemin</th>
            <th scope="col">Authentification</th>
            <th scope="col">Limite d&apos;appels</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="statut statut--agree">GET</span>
            </td>
            <td>
              <code>/api/v1/integration/employees/{"{employer_ref}"}/balance</code>
            </td>
            <td>Client applicatif (voir ci-dessous)</td>
            <td>Par client applicatif</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
