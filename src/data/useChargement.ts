import { useCallback, useEffect, useState } from 'react'

// Charge une donnée ; « recharger » relance après une panne
export function useChargement<T>(charger: () => Promise<T>, cles: unknown[]) {
  const [etat, setEtat] = useState<{ donnees: T | null; erreur: boolean; chargement: boolean }>({ donnees: null, erreur: false, chargement: true })
  const [essai, setEssai] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(charger, cles)
  useEffect(() => {
    let actif = true
    setEtat((e) => ({ ...e, chargement: true, erreur: false }))
    fn().then(
      (donnees) => { if (actif) setEtat({ donnees, erreur: false, chargement: false }) },
      () => { if (actif) setEtat({ donnees: null, erreur: true, chargement: false }) },
    )
    return () => { actif = false }
  }, [fn, essai])
  return { ...etat, recharger: () => setEssai((n) => n + 1) }
}
