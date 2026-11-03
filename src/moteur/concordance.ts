// Préparation de la fusion avec l'app réseau (migration 0028, Joseph 03/11/2026) : la caisse devient la seule source du CA,
// les chiffres saisis à la main dans l'app réseau seront retirés après la bascule. Avant de les retirer, on compare,
// magasin par magasin et mois par mois, le CA HT de la caisse (pilotage) et celui de l'app réseau (cave + bar + extérieur).
// Un mois connu de l'app réseau mais absent de la caisse serait perdu au retrait : c'est le premier point à régler.

export interface LigneConcordance {
  magasin: string
  mois: string            // AAAA-MM
  caCaisse: number | null
  ticketsCaisse: number | null
  caReseau: number | null
  ticketsReseau: number | null
}

export type StatutConcordance = 'manque' | 'ecart' | 'concorde' | 'caisse_seule'

export interface ConcordanceMagasin {
  magasin: string
  moisCommuns: number          // mois chiffrés des deux côtés
  moisReseauSeul: string[]     // mois de l'app réseau absents de la caisse (perdus si on retire l'app réseau)
  moisCaisseSeule: number      // mois de la caisse absents de l'app réseau (rien à perdre)
  caCaisse: number             // somme sur les mois communs
  caReseau: number             // somme sur les mois communs
  ecart: number | null         // (caisse − app réseau) ÷ app réseau, sur les mois communs
  pireMois: { mois: string; ecart: number } | null  // mois commun au plus grand écart, en valeur absolue
  statut: StatutConcordance
}

export interface SyntheseConcordance {
  magasins: ConcordanceMagasin[]  // les plus urgents d'abord : manques, puis écarts (du plus grand), puis le reste
  manques: number                 // magasins avec au moins un mois de l'app réseau absent de la caisse
  ecarts: number                  // magasins dont un mois commun s'écarte de plus que le seuil
  concordants: number
}

// Seuil d'écart toléré sur un mois (2 % : arrondis, remises, retours caisse). Hypothèse à confirmer par Joseph.
export const SEUIL_ECART = 0.02

const chiffre = (v: number | null) => v !== null && Number.isFinite(v) && v !== 0
const ecartDe = (caisse: number, reseau: number) => (reseau === 0 ? null : (caisse - reseau) / reseau)

export function syntheseConcordance(lignes: LigneConcordance[], seuil = SEUIL_ECART): SyntheseConcordance {
  const parMagasin = new Map<string, LigneConcordance[]>()
  for (const l of lignes) parMagasin.set(l.magasin, [...(parMagasin.get(l.magasin) ?? []), l])
  const magasins: ConcordanceMagasin[] = []
  for (const [magasin, ls] of parMagasin) {
    let moisCommuns = 0, moisCaisseSeule = 0, caCaisse = 0, caReseau = 0
    const moisReseauSeul: string[] = []
    let pireMois: ConcordanceMagasin['pireMois'] = null
    for (const l of [...ls].sort((a, b) => a.mois.localeCompare(b.mois))) {
      const c = chiffre(l.caCaisse), r = chiffre(l.caReseau)
      if (c && r) {
        moisCommuns++
        caCaisse += l.caCaisse!; caReseau += l.caReseau!
        const e = ecartDe(l.caCaisse!, l.caReseau!)
        if (e !== null && (!pireMois || Math.abs(e) > Math.abs(pireMois.ecart))) pireMois = { mois: l.mois, ecart: e }
      } else if (r) moisReseauSeul.push(l.mois)
      else if (c) moisCaisseSeule++
    }
    const statut: StatutConcordance = moisReseauSeul.length ? 'manque'
      : pireMois && Math.abs(pireMois.ecart) > seuil ? 'ecart'
      : moisCommuns ? 'concorde' : 'caisse_seule'
    magasins.push({ magasin, moisCommuns, moisReseauSeul, moisCaisseSeule, caCaisse, caReseau, ecart: moisCommuns ? ecartDe(caCaisse, caReseau) : null, pireMois, statut })
  }
  const rang: Record<StatutConcordance, number> = { manque: 0, ecart: 1, concorde: 2, caisse_seule: 3 }
  magasins.sort((a, b) => rang[a.statut] - rang[b.statut]
    || Math.abs(b.pireMois?.ecart ?? 0) - Math.abs(a.pireMois?.ecart ?? 0)
    || a.magasin.localeCompare(b.magasin, 'fr'))
  return {
    magasins,
    manques: magasins.filter((m) => m.statut === 'manque').length,
    ecarts: magasins.filter((m) => m.statut === 'ecart').length,
    concordants: magasins.filter((m) => m.statut === 'concorde' || m.statut === 'caisse_seule').length,
  }
}
