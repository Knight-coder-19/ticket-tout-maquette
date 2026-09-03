"use client";

import { useCallback, useState } from "react";

type EtatPagination = {
  page: number;
  nombrePages: number;
  precedente: () => void;
  suivante: () => void;
  allerA: (page: number) => void;
};

/** Pagination cote client : page courante bornee par un total connu. */
export function usePagination(total: number, taillePage: number): EtatPagination {
  const nombrePages = Math.max(1, Math.ceil(total / taillePage));
  const [pageBrute, setPageBrute] = useState(1);
  const page = Math.min(nombrePages, Math.max(1, pageBrute));

  const allerA = useCallback((p: number) => {
    setPageBrute(Math.max(1, p));
  }, []);

  const precedente = useCallback(() => {
    setPageBrute((p) => Math.max(1, p - 1));
  }, []);

  const suivante = useCallback(() => {
    setPageBrute((p) => p + 1);
  }, []);

  return { page, nombrePages, precedente, suivante, allerA };
}
