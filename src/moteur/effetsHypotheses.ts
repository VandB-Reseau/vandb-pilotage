// Effet de chaque hypothèse d'un univers, en euros (Joseph, 2/11/2026 : colonne « Effet » du tableau des hypothèses).
// CA de l'univers = CA attendu cette année × (1 + tickets) × (1 + panier) : l'effet des tickets se compte sur le CA attendu,
// celui du panier sur le reste, si bien que les deux s'additionnent exactement à l'écart de CA. La marge visée rapporte
// l'écart de taux de marge appliqué au CA de l'an prochain ; la démarque retire la perte prévue.
export interface EntreeEffets {
  caAvant: number            // CA attendu cette année (atterrissage)
  caApres: number            // CA de l'univers l'an prochain
  ticketsAvant?: number      // Cave et Bar : tickets attendus cette année
  ticketsApres?: number      // tickets de l'an prochain
  margeAvant: number | null  // marge théorique de cette année, en euros, sur caMargeAvant ; null si le réel n'a pas de marge
  caMargeAvant: number       // CA de cette année dont la marge est connue
  margeApres: number         // marge visée l'an prochain, avant démarque
  perte: number              // démarque prévue l'an prochain, en euros
}
export interface EffetsUnivers {
  tickets: number | null     // gain de CA dû aux tickets (null sans pilotage par les tickets)
  panier: number | null      // gain de CA dû au panier
  ca: number                 // gain de CA total
  marge: number | null       // gain de marge dû au taux de marge visé (null si la marge de cette année est inconnue)
  demarque: number           // perte de marge due à la démarque (négative ou nulle)
}

export function effetsUnivers(e: EntreeEffets): EffetsUnivers {
  const ca = e.caApres - e.caAvant
  const parTickets = e.ticketsAvant !== undefined && e.ticketsApres !== undefined && e.ticketsAvant > 0
  const tickets = parTickets ? e.caAvant * (e.ticketsApres! / e.ticketsAvant! - 1) : null
  const tauxAvant = e.margeAvant !== null && e.margeAvant > 0 && e.caMargeAvant > 0 ? e.margeAvant / e.caMargeAvant : null
  return {
    tickets,
    panier: tickets === null ? null : ca - tickets,
    ca,
    marge: tauxAvant === null ? null : e.margeApres - e.caApres * tauxAvant,
    demarque: -e.perte,
  }
}
