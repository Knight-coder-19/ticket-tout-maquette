import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Ton = "neutre" | "succes" | "alerte" | "attente";

const classeParTon: Record<Ton, string | undefined> = {
  neutre: styles.pastilleNeutre,
  succes: styles.pastilleSucces,
  alerte: styles.pastilleAlerte,
  attente: styles.pastilleAttente,
};

export function Pastille({ ton = "neutre", children }: { ton?: Ton; children: ReactNode }) {
  return <span className={`${styles.pastille} ${classeParTon[ton]}`}>{children}</span>;
}
