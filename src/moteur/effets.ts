// Effet d'une saisie sur le budget avant de l'enregistrer (lot 28, barre d'enregistrement de l'Équipe et des Frais) :
// frais et masse salariale sont au-dessus de l'EBE, qui baisse de ce qu'ils augmentent. Les autres lignes ne bougent pas.

// Frais de l'année : montants annuels et part du CA
export const fraisDeLAnnee = (t: { annuel: number; taux: number }, ca: number) => t.annuel + t.taux * ca
export const ebeApres = (ebe: number, chargeAvant: number, chargeApres: number) => ebe - (chargeApres - chargeAvant)
