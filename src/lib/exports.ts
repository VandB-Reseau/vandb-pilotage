import type { LigneCompte } from '../moteur/compteResultat'
import type { LigneReseau } from '../moteur/suivi'
import type { MoisTresorerie, Tresorerie } from '../moteur/tresorerie'
import { universLibelle, type ResultatFamille } from '../moteur/types'
import { MOIS } from './format'
import { cellule, colonne, type Cellule, type Feuille } from './xlsx'

// Contenu des exports Excel : les chiffres viennent du moteur, tels qu'à l'écran. Les totaux et les parts sont
// des formules, pour que le classeur reste juste si on y retouche un montant.

const aujourdhui = () => new Date().toLocaleDateString('fr-FR')
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)

export function feuillesBudget({ magasin, annee, statut, lignes, familles, tresorerie }: {
  magasin: string
  annee: number
  statut: string
  lignes: LigneCompte[]
  familles: ResultatFamille[]
  tresorerie?: Tresorerie | null
}): Feuille[] {
  // ── Compte de résultat : titres sur 4 lignes, puis une ligne par poste
  const debut = 4
  const ligneCA = debut + Math.max(0, lignes.findIndex((l) => l.cle === 'ca'))
  const ca = lignes.find((l) => l.cle === 'ca')?.total ?? 0
  const T = colonne(13)
  const compte: Cellule[][] = [
    [{ v: `Budget ${annee} - ${magasin}`, s: 'titre' }],
    [{ v: `${statut} · exporté le ${aujourdhui()}`, s: 'discret' }],
    [],
    [{ v: 'En euros', s: 'entete' }, ...[...MOIS, 'Total', '% du CA'].map((v) => ({ v, s: 'enteteDroite' as const }))],
    ...lignes.map((l, i): Cellule[] => {
      const r = debut + i
      const montant = l.indicateur ? 'euros2' : l.fort ? 'eurosGras' : 'euros'
      const complet = l.mois.every((v) => v !== null)
      return [
        { v: l.libelle, s: l.fort ? 'gras' : l.parent ? 'retrait' : 'texte' },
        ...l.mois.map((v) => (v === null ? null : { v, s: montant } as Cellule)),
        complet && !l.indicateur ? { v: l.total, f: `SUM(${cellule(r, 1)}:${cellule(r, 12)})`, s: montant } : { v: l.total, s: montant },
        l.indicateur ? null : { v: ca ? l.total / ca : 0, f: `IF(${T}$${ligneCA + 1}=0,0,${T}${r + 1}/${T}$${ligneCA + 1})`, s: l.fort ? 'pctGras' : 'pct' },
      ]
    }),
  ]

  // ── Hypothèses par famille : la marge de l'année se recalcule si on change la marge visée ou la démarque
  const p0 = 4, p1 = p0 + familles.length - 1, pt = p1 + 1   // familles sous l'en-tête de la ligne 4, total dessous
  const plageCorps = (c: number) => `${cellule(p0, c)}:${cellule(p1, c)}`
  const dem = somme(familles.map((f) => f.objectif * (f.demarque ?? 0)))
  const tCA = somme(familles.map((f) => f.objectif)), tN = somme(familles.map((f) => f.atterrissage)), tM = somme(familles.map((f) => f.margeObjectif))
  const hypotheses: Cellule[][] = [
    [{ v: `Hypothèses du budget ${annee} - ${magasin}`, s: 'titre' }],
    [{ v: `${statut} · exporté le ${aujourdhui()}`, s: 'discret' }],
    [],
    ['Famille', 'Univers', `CA ${annee - 1} attendu`, 'Évolution', `CA ${annee}`, 'Marge visée', 'Démarque', `Marge ${annee}`].map((v, i) => ({ v, s: i < 2 ? 'entete' as const : 'enteteDroite' as const })),
    ...familles.map((f, i): Cellule[] => {
      const r = p0 + i
      return [
        f.famille, universLibelle[f.univers],
        { v: f.atterrissage, s: 'euros' }, { v: f.evolution, s: 'pct' }, { v: f.objectif, s: 'euros' },
        { v: f.margeCible, s: 'pct' }, { v: f.demarque ?? 0, s: 'pct' },
        { v: f.margeObjectif, f: `${cellule(r, 4)}*(${cellule(r, 5)}-${cellule(r, 6)})`, s: 'euros' },
      ]
    }),
  ]
  const total: Cellule[] = familles.length ? [
    { v: 'Total', s: 'gras' }, null,
    { v: tN, f: `SUM(${plageCorps(2)})`, s: 'eurosGras' },
    { v: tN ? tCA / tN - 1 : 0, f: `IF(${cellule(pt, 2)}=0,0,${cellule(pt, 4)}/${cellule(pt, 2)}-1)`, s: 'pctGras' },
    { v: tCA, f: `SUM(${plageCorps(4)})`, s: 'eurosGras' },
    { v: tCA ? (tM + dem) / tCA : 0, f: `IF(${cellule(pt, 4)}=0,0,(${cellule(pt, 7)}+SUMPRODUCT(${plageCorps(4)},${plageCorps(6)}))/${cellule(pt, 4)})`, s: 'pctGras' },
    { v: tCA ? dem / tCA : 0, f: `IF(${cellule(pt, 4)}=0,0,SUMPRODUCT(${plageCorps(4)},${plageCorps(6)})/${cellule(pt, 4)})`, s: 'pctGras' },
    { v: tM, f: `SUM(${plageCorps(7)})`, s: 'eurosGras' },
  ] : []

  return [
    { nom: 'Compte de résultat', lignes: compte, largeurs: [36, ...MOIS.map(() => 11), 13, 9], figer: { lignes: 4, colonnes: 1 } },
    { nom: 'Hypothèses', lignes: [...hypotheses, total], largeurs: [28, 12, 15, 11, 15, 12, 11, 15], figer: { lignes: 4, colonnes: 1 } },
    ...(tresorerie ? [feuilleTresorerie(tresorerie, `Trésorerie ${annee} - ${magasin}`, statut)] : []),
  ]
}

// Trésorerie : sorties en négatif ; total des décaissements, variation et solde de fin de mois en formules,
// à partir de la trésorerie au 1er janvier
const SORTIES: [keyof MoisTresorerie, string][] = [
  ['fournisseurs', 'Fournisseurs de marchandises'], ['frais', 'Frais, redevance et publicité'], ['personnel', 'Salaires et cotisations'],
  ['tva', 'TVA reversée'], ['emprunts', 'Emprunts (intérêts et capital)'], ['impot', 'Impôt sur les sociétés'], ['travaux', 'Travaux'],
  ['consignesVersees', 'Consignes versées aux fournisseurs'],
]
const ENTREES: [keyof MoisTresorerie, string][] = [
  ['consignesRemboursees', 'Consignes remboursées par les fournisseurs'],
]
function feuilleTresorerie(t: Tresorerie, titre: string, statut: string): Feuille {
  const rDebut = 4, rEnc = 5, rE1 = rEnc + ENTREES.length, rS0 = rE1 + 1, rS1 = rS0 + SORTIES.length - 1, rDec = rS1 + 1, rFlux = rDec + 1, rFin = rFlux + 1
  const annee = (r: number, v: number, s: 'euros' | 'eurosGras' = 'eurosGras'): Cellule => ({ v, f: `SUM(${cellule(r, 1)}:${cellule(r, 12)})`, s })
  const sommeMois = (cle: keyof MoisTresorerie, signe = 1) => signe * t.mois.reduce((a, m) => a + m[cle], 0)
  return {
    nom: 'Trésorerie',
    lignes: [
      [{ v: titre, s: 'titre' }],
      [{ v: `${statut} · exporté le ${aujourdhui()}`, s: 'discret' }],
      [],
      [{ v: 'En euros TTC', s: 'entete' }, ...[...MOIS, 'Année'].map((v) => ({ v, s: 'enteteDroite' as const }))],
      [{ v: 'Trésorerie au 1er janvier', s: 'gras' }, { v: t.debut, s: 'eurosGras' }],
      [{ v: 'Encaissements des ventes TTC', s: 'gras' }, ...t.mois.map((m) => ({ v: m.encaissements, s: 'euros' } as Cellule)), annee(rEnc, sommeMois('encaissements'))],
      ...ENTREES.map(([cle, libelle], k): Cellule[] => [
        libelle, ...t.mois.map((m) => ({ v: m[cle], s: 'euros' } as Cellule)), annee(rEnc + 1 + k, sommeMois(cle), 'euros'),
      ]),
      ...SORTIES.map(([cle, libelle], k): Cellule[] => [
        libelle, ...t.mois.map((m) => ({ v: -m[cle], s: 'euros' } as Cellule)), annee(rS0 + k, sommeMois(cle, -1), 'euros'),
      ]),
      [{ v: 'Total des décaissements', s: 'gras' },
        ...t.mois.map((m, i) => ({ v: -m.decaissements, f: `SUM(${cellule(rS0, i + 1)}:${cellule(rS1, i + 1)})`, s: 'eurosGras' } as Cellule)),
        annee(rDec, sommeMois('decaissements', -1))],
      [{ v: 'Variation du mois', s: 'gras' },
        ...t.mois.map((m, i) => ({ v: m.flux, f: `SUM(${cellule(rEnc, i + 1)}:${cellule(rE1, i + 1)})+${cellule(rDec, i + 1)}`, s: 'eurosGras' } as Cellule)),
        annee(rFlux, sommeMois('flux'))],
      [{ v: 'Trésorerie en fin de mois', s: 'gras' },
        ...t.mois.map((m, i) => ({ v: m.fin, f: `${i === 0 ? `$B$${rDebut + 1}` : cellule(rFin, i)}+${cellule(rFlux, i + 1)}`, s: 'eurosGras' } as Cellule)),
        { v: t.fin, f: cellule(rFin, 12), s: 'eurosGras' }],
    ],
    largeurs: [34, ...MOIS.map(() => 11), 13],
    figer: { lignes: 4, colonnes: 1 },
  }
}

export type LigneExportReseau = LigneReseau & { coach: string; rrs: string[]; groupe: string }

export function feuilleReseau({ annee, selection, lignes, total, avec }: {
  annee: number
  selection: string
  lignes: LigneExportReseau[]
  total: ReturnType<typeof import('../moteur/suivi').totalReseau>
  avec: { coach: boolean; rr: boolean; groupe: boolean }
}): Feuille {
  const reperes: { titre: string; largeur: number; valeur: (l: LigneExportReseau) => Cellule }[] = [
    { titre: 'Magasin', largeur: 30, valeur: (l) => l.magasin },
    ...(avec.coach ? [{ titre: 'Coach', largeur: 20, valeur: (l: LigneExportReseau) => l.coach }] : []),
    ...(avec.rr ? [{ titre: 'Responsable Régional', largeur: 22, valeur: (l: LigneExportReseau) => l.rrs.join(', ') }] : []),
    ...(avec.groupe ? [{ titre: 'Groupe', largeur: 20, valeur: (l: LigneExportReseau) => l.groupe }] : []),
  ]
  const n = (v: number | null, s: 'euros' | 'euros2' | 'pct'): Cellule => (v === null ? null : { v, s })
  const chiffres: { titre: string; largeur: number; valeur: (l: LigneExportReseau) => Cellule }[] = [
    { titre: 'Réel à fin', largeur: 10, valeur: (l) => (l.moisRealises ? MOIS[l.moisRealises - 1] : 'Aucun') },
    { titre: 'CA HT', largeur: 14, valeur: (l) => n(l.ca, 'euros') },
    { titre: 'Évolution sur l’an dernier', largeur: 13, valeur: (l) => n(l.evolution, 'pct') },
    { titre: 'Écart au budget', largeur: 11, valeur: (l) => n(l.ecartBudget, 'pct') },
    { titre: 'Taux de marge', largeur: 10, valeur: (l) => n(l.tauxMarge, 'pct') },
    { titre: 'Panier moyen TTC', largeur: 11, valeur: (l) => n(l.panierTTC, 'euros2') },
    { titre: 'Masse salariale / marge', largeur: 12, valeur: (l) => n(l.personnelSurMarge, 'pct') },
    { titre: 'EBE / CA', largeur: 10, valeur: (l) => n(l.ebeSurCA, 'pct') },
  ]
  const colonnes = [...reperes, ...chiffres]
  const debut = 5   // ligne du premier magasin (index), sous l'en-tête et le total
  const cCA = reperes.length + 1
  const gras = (c: Cellule): Cellule => (c && typeof c === 'object' ? { ...c, s: c.s === 'euros' ? 'eurosGras' : c.s === 'euros2' ? 'euros2Gras' : c.s === 'pct' ? 'pctGras' : 'gras' } : c === null ? null : { v: c, s: 'gras' })
  const ligneTotal: Cellule[] = [
    { v: selection === 'Tout le réseau' ? 'Total du réseau' : 'Total de la sélection', s: 'gras' },
    ...reperes.slice(1).map(() => null),
    { v: `${total.magasins} magasin${total.magasins > 1 ? 's' : ''}`, s: 'gras' },
    lignes.length ? { v: total.ca, f: `SUM(${cellule(debut, cCA)}:${cellule(debut + lignes.length - 1, cCA)})`, s: 'eurosGras' } : { v: total.ca, s: 'eurosGras' },
    gras(n(total.evolution, 'pct')), gras(n(total.ecartBudget, 'pct')), gras(n(total.tauxMarge, 'pct')),
    gras(n(total.panierTTC, 'euros2')), gras(n(total.personnelSurMarge, 'pct')), gras(n(total.ebeSurCA, 'pct')),
  ]
  return {
    nom: `Réseau ${annee}`,
    lignes: [
      [{ v: `Réseau - réel ${annee} par magasin`, s: 'titre' }],
      [{ v: `${selection} · exporté le ${aujourdhui()}`, s: 'discret' }],
      [],
      colonnes.map((c, i) => ({ v: c.titre, s: i < reperes.length ? 'entete' as const : 'enteteDroite' as const })),
      ligneTotal,
      ...lignes.map((l) => colonnes.map((c) => c.valeur(l))),
    ],
    largeurs: colonnes.map((c) => c.largeur),
    figer: { lignes: 4, colonnes: 1 },
  }
}
