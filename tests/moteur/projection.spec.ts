import { expect, test } from '@playwright/test'
import { baseDepuisReel } from '../../src/moteur/atterrissage'
import { calculerBudget } from '../../src/moteur/budget'
import { ajustementsCopies, appliquerCibles, niveauxReseau, type Cibles } from '../../src/moteur/cibles'
import { parametresParDefaut } from '../../src/moteur/parametres'
import { calageMillesimes, trancheMillesime } from '../../src/moteur/projection'
import type { LigneReel } from '../../src/moteur/reel'
import type { MoisReel } from '../../src/moteur/suivi'
import { paiementsAchats, tresorerieBudget, tresorerieParDefaut } from '../../src/moteur/tresorerie'
import type { Hypotheses, TempsFort } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// Projection du CA (lot 24) sur le magasin fictif : chaque résultat se vérifie à la main (calcul en commentaire).
// Magasin fictif : 8 mois réalisés, 60 % de l'année ; Cave 120 000 réalisés (200 000 attendus, 10 000 tickets, panier 24 €),
// Bar 180 000 (300 000), Extérieur 60 000 (100 000). Saisonnalité : 7,5 % par mois de janvier à août, 10 % ensuite.
const proche = (v: number, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const sansEvolution: Hypotheses = {
  ...magasinFictif, caParTickets: true,
  familles: magasinFictif.familles.map((f) => ({ ...f, evolution: 0 })),
  flux: { cave: { realise: 6_000, evolution: 0, panierCibleTTC: 24, evolutionPanier: 0 } },
}
const oktoberfest: TempsFort = { nom: 'Oktoberfest', type: 'exterieur', mois: 6, univers: 'exterieur', caAnPasse: 12_000, ca: 15_000, extrasPersonnel: 800, autresCharges: 2_200, moisAchats: 5 }

test('temps forts : le CA de l’an passé sort de la base, celui du budget entre dans son mois avec ses charges', () => {
  const sans = calculerBudget(sansEvolution, parametresParDefaut)
  const b = calculerBudget({ ...sansEvolution, tempsForts: [oktoberfest] }, parametresParDefaut)
  // Extérieur : (60 000 réalisés − 12 000 de l'Oktoberfest) / 60 % = 80 000, plus 15 000 en juin
  const ext = b.familles.find((f) => f.univers === 'exterieur')!
  proche(ext.atterrissage, 100_000)          // l'atterrissage affiché reste celui du réel
  proche(ext.objectif, 95_000)
  proche(b.ca, 200_000 + 300_000 + 95_000)
  // Juin Extérieur : 80 000 × 7,5 % + 15 000
  proche(b.mois[5].univers!.exterieur.ca, 21_000)
  proche(b.mois[5].ca, sans.mois[5].ca - 1_500 + 15_000)
  // Achats de l'Oktoberfest : 15 000 × (1 − 40 %), payés en mai
  proche(b.mois[5].univers!.exterieur.achatsTempsForts, 9_000)
  expect(b.paiementsTempsForts).toEqual([{ mois: 4, vente: 5, univers: 'exterieur', montant: expect.closeTo(9_000, 6) }])
  // Extras enregistrés avant le 29/10/2026 ignorés (ils se saisissent dans l'équipe) ; autres charges dans les charges
  // externes (avec la redevance et la publicité du CA en plus)
  proche(b.mois[5].personnel, sans.mois[5].personnel)
  proche(b.mois[5].chargesExternes - sans.mois[5].chargesExternes, 2_200 + 13_500 * 0.03 + 13_500 * 0.013)
  expect(b.tempsForts).toEqual({ retire: 12_000, ajoute: 15_000, charges: 2_200, ajustements: 0 })
  // Sans temps fort, le calcul est celui d'avant : mêmes mois
  proche(sans.mois[0].ca, 600_000 * 0.075)
})

test('temps fort dans un univers sans famille : une famille « Temps forts » à la marge moyenne du magasin', () => {
  const h = { ...sansEvolution, familles: sansEvolution.familles.filter((f) => f.univers !== 'exterieur'), tempsForts: [oktoberfest] }
  const b = calculerBudget(h, parametresParDefaut)
  const tf = b.familles.find((f) => f.famille === 'Temps forts')!
  // Marge moyenne : (200 000 × 38 % + 300 000 × 75 %) / 500 000 = 60,2 %
  proche(tf.margeCible, 0.602)
  proche(tf.objectif, 15_000)
  proche(b.ca, 515_000)
})

test('rythme de sortie : retenu sous 15 % d’écart, à confirmer au-delà, écarté sur demande, absent pour l’atterrissage', () => {
  // Cave : 66 000 de mai à août, 30 % de l'année → 220 000 au rythme actuel, + 10 % sur l'atterrissage (200 000)
  const h = { ...sansEvolution, flux: { cave: { ...sansEvolution.flux!.cave!, evolution: 0.03, evolutionPanier: 0.02 } }, sortie: { cave: { ca: 66_000, poids: 0.3, de: 5, a: 8 } } }
  const auto = calculerBudget({ ...h, rythme: { cave: 'auto' } }, parametresParDefaut)
  expect(auto.sortie?.cave).toEqual({ atterri: expect.closeTo(200_000, 6), annuel: expect.closeTo(220_000, 6), acquis: expect.closeTo(0.1, 9), de: 5, a: 8, statut: 'applique' })
  // 220 000 × 1,03 × 1,02 ; tickets 10 000 × 1,1 × 1,03
  proche(auto.flux.cave!.ca, 231_132)
  proche(auto.flux.cave!.objectif, 11_330)
  // Écarté : l'atterrissage reste la base, 200 000 × 1,03 × 1,02
  proche(calculerBudget({ ...h, rythme: { cave: 'ignore' } }, parametresParDefaut).flux.cave!.ca, 210_120)
  // Atterrissage de l'année en cours (pas de choix posé) : le rythme ne s'applique pas
  const atterrissage = calculerBudget(h, parametresParDefaut)
  expect(atterrissage.sortie).toEqual({})
  proche(atterrissage.flux.cave!.ca, 210_120)
  // 75 000 / 30 % = 250 000, + 25 % : à confirmer (base 200 000), puis confirmé par le Directeur
  const fort = { ...h, sortie: { cave: { ca: 75_000, poids: 0.3, de: 5, a: 8 } } }
  const aConfirmer = calculerBudget({ ...fort, rythme: { cave: 'auto' } }, parametresParDefaut)
  expect(aConfirmer.sortie?.cave?.statut).toBe('a_confirmer')
  proche(aConfirmer.flux.cave!.ca, 210_120)
  proche(calculerBudget({ ...fort, rythme: { cave: 'applique' } }, parametresParDefaut).flux.cave!.ca, 250_000 * 1.03 * 1.02)
})

test('rythme de sortie : un temps fort de la fenêtre sort du rythme comme de l’atterrissage', () => {
  const soiree: TempsFort = { nom: 'Soirée whisky', type: 'soiree', mois: 6, univers: 'cave', caAnPasse: 6_000, ca: 0, extrasPersonnel: 0, autresCharges: 0, moisAchats: 5 }
  const b = calculerBudget({ ...sansEvolution, tempsForts: [soiree], sortie: { cave: { ca: 66_000, poids: 0.3, de: 5, a: 8 } }, rythme: { cave: 'auto' } }, parametresParDefaut)
  // Atterrissage hors soirée : (120 000 − 6 000) / 60 % = 190 000 ; rythme (66 000 − 6 000) / 30 % = 200 000, + 5,26 %
  proche(b.sortie!.cave!.atterri, 190_000)
  proche(b.sortie!.cave!.annuel, 200_000)
  proche(b.sortie!.cave!.acquis, 200_000 / 190_000 - 1)
  proche(b.flux.cave!.ca, 200_000)
})

test('ajustements datés : client gagné en euros par mois, concurrent en part du CA de l’univers', () => {
  const b = calculerBudget({
    ...sansEvolution,
    ajustementsCA: [
      { libelle: 'Nouvelle association', univers: 'exterieur', de: 5, a: 9, montant: 1_500 },
      { libelle: 'Concurrent', univers: 'bar', de: 10, a: 12, taux: -0.1 },
    ],
  }, parametresParDefaut)
  // Extérieur : 1 500 × 5 mois ; Bar : 300 000 × 10 % par mois d'octobre à décembre × − 10 % = − 3 000 par mois
  proche(b.familles.find((f) => f.univers === 'exterieur')!.objectif, 107_500)
  proche(b.familles.find((f) => f.univers === 'bar')!.objectif, 291_000)
  proche(b.mois[9].univers!.bar.ca, 27_000)
  proche(b.mois[4].univers!.exterieur.ca, 100_000 * 0.075 + 1_500)
  proche(b.tempsForts!.ajustements, -1_500)
})

test('trésorerie : Extérieur payé avant la vente, temps forts au mois saisi, opérations du réseau avancées', () => {
  const b = calculerBudget(sansEvolution, parametresParDefaut)
  // Janvier : achats Cave et Bar de décembre (200 000 × 62 % + 300 000 × 25 %) × 10 %, Extérieur de février 100 000 × 60 % × 7,5 %
  const p = paiementsAchats(b, tresorerieParDefaut)
  proche(p[0], 19_900 + 4_500)
  proche(somme(p), somme(b.mois.map((m) => m.achats)))
  // Foire aux vins : la moitié des achats Cave et Bar de septembre (19 900) payée en juillet plutôt qu'en octobre
  const op = paiementsAchats(b, { ...tresorerieParDefaut, operations: [{ nom: 'Foire aux vins', mois: 9, moisPaiement: 7, part: 0.5 }] })
  proche(op[6] - p[6], 9_950)
  proche(op[9] - p[9], -9_950)
  // Oktoberfest : 9 000 d'achats payés en mai, sortis du flux habituel de l'Extérieur
  const tf = calculerBudget({ ...sansEvolution, tempsForts: [oktoberfest] }, parametresParDefaut)
  const pt = paiementsAchats(tf, tresorerieParDefaut)
  proche(pt[4], tf.mois[5].univers!.exterieur.achats - 9_000 + tf.mois[3].univers!.cave.achats + tf.mois[3].univers!.bar.achats + 9_000)
  // Sur l'année, la trésorerie varie toujours de la trésorerie dégagée
  const t = tresorerieBudget(tf, { ...sansEvolution, tempsForts: [oktoberfest] }, parametresParDefaut, tresorerieParDefaut, 10_000)
  proche(t.fin - 10_000, tf.tresorerieDegagee)
  // Autres charges de l'Oktoberfest payées en juin avec leur TVA ; l'énergie suit le CA de juin, la redevance et la
  // publicité celui de mai (payées le mois suivant)
  const sansTf = tresorerieBudget(b, sansEvolution, parametresParDefaut, tresorerieParDefaut)
  proche(t.mois[5].frais - sansTf.mois[5].frais, 2_200 * 1.2 + (tf.mois[5].ca - b.mois[5].ca) * 0.013 * 1.2 + (tf.mois[4].ca - b.mois[4].ca) * 0.03 * 1.2)
})

test('ancienneté à mi-année : tranche du magasin pour l’année du budget', () => {
  expect(trancheMillesime({ annee: 2025, mois: 2 }, 2027)).toBe('3')
  expect(trancheMillesime({ annee: 2025, mois: 11 }, 2027)).toBe('2')
  expect(trancheMillesime({ annee: 2026, mois: 1 }, 2027)).toBe('2')
  expect(trancheMillesime({ annee: 2027, mois: 3 }, 2027)).toBe('1')
  expect(trancheMillesime({ annee: 2027, mois: 9 }, 2027)).toBe('1')
  expect(trancheMillesime({ annee: 2020, mois: 5 }, 2027)).toBe('4')
  expect(trancheMillesime(null, 2027)).toBeNull()
})

test('valeurs par défaut : ancienneté au-dessus du réseau, hausse tarifaire en dessous, groupe et magasin au-dessus', () => {
  const reseau: Cibles = { hausseTarifaire: 0.02, evolutionFlux: { cave: 0.01 }, millesimes: { 2: { evolutionFlux: { cave: 0.06 }, evolutionPanier: { cave: 0.01 } } } }
  const resoudre = (tranche: '2' | '4' | null, groupe: Cibles | null = null) => {
    const { provenance } = appliquerCibles(sansEvolution, [...niveauxReseau(reseau, tranche), { niveau: 'groupe', cibles: groupe }, { niveau: 'magasin', cibles: {} }])
    return Object.fromEntries(provenance.filter((x) => x.cle.endsWith('/cave') && /^(flux|panier)/.test(x.cle)).map((x) => [x.cle, [x.valeur, x.source]]))
  }
  // Année 2 : tickets + 6 %, panier 2 % de hausse tarifaire + 1 %
  expect(resoudre('2')).toEqual({ 'flux/cave': [0.06, 'millesime'], 'panier/cave': [0.03, 'millesime'] })
  // Année 4 sans valeur propre : tickets du réseau, panier = hausse tarifaire
  expect(resoudre('4')).toEqual({ 'flux/cave': [0.01, 'reseau'], 'panier/cave': [0.02, 'tarif'] })
  expect(resoudre('2', { evolutionFlux: { cave: 0 } })).toEqual({ 'flux/cave': [0, 'groupe'], 'panier/cave': [0.03, 'millesime'] })
})

test('appliquerCibles : rythme proposé dès qu’il est mesuré, temps forts et ajustements propres au magasin', () => {
  const base = { ...sansEvolution, sortie: { cave: { ca: 66_000, poids: 0.3, de: 5, a: 8 } } }
  const magasin: Cibles = { rythme: { cave: 'ignore' }, tempsForts: [oktoberfest], ajustementsCA: [{ libelle: 'Club', univers: 'exterieur', de: 1, a: 12, montant: -500 }] }
  expect(appliquerCibles(base, [{ niveau: 'magasin', cibles: {} }]).hypotheses.rythme).toEqual({ cave: 'auto' })
  const { hypotheses } = appliquerCibles(base, [{ niveau: 'magasin', cibles: magasin }])
  expect(hypotheses.rythme).toEqual({ cave: 'ignore' })
  expect(hypotheses.tempsForts).toEqual([oktoberfest])
  expect(hypotheses.ajustementsCA).toHaveLength(1)
  expect(appliquerCibles(sansEvolution, []).hypotheses.rythme).toBeUndefined()
  // Copie vers un autre magasin : ce qui est propre au magasin ne part pas
  expect(ajustementsCopies({ ...magasin, inflationFrais: 0.02 }, { tempsForts: [] })).toEqual({ inflationFrais: 0.02, tempsForts: [] })
})

test('atterrissage : rythme de sortie sur les 4 derniers mois, saisonnalité du magasin ou du réseau, rien juste après l’ouverture', () => {
  // Cave : 10 000 par mois de janvier à avril, 12 000 de mai à août ; N-1 : 10 000 chaque mois (saisonnalité plate)
  const n: LigneReel[] = Array.from({ length: 8 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Bière', caHT: i < 4 ? 10_000 : 12_000, caTTC: null, margeHT: null }))
  const n1: LigneReel[] = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, univers: 'cave' as const, famille: 'Bière', caHT: 10_000, caTTC: null, margeHT: null }))
  const reel = { n: { lignes: n, tickets: [] }, n1: { lignes: n1, tickets: [] } }
  // 48 000 sur 4 mois de 12 : 144 000 au rythme actuel, pour 88 000 / (8 / 12) = 132 000 attendus
  const r = baseDepuisReel(reel, 2026)!
  expect(r.base.sortie).toEqual({ cave: { ca: 48_000, poids: expect.closeTo(1 / 3, 9), de: 5, a: 8 } })
  // Ouvert en avril : les 2 mois de lancement tombent dans la fenêtre
  expect(baseDepuisReel(reel, 2026, [], undefined, { ouverture: { annee: 2026, mois: 4 } })!.base.sortie).toBeUndefined()
  // Ouvert en juin 2025 : moins de deux ans, saisonnalité du réseau (ici 5 % puis 12,5 % : poids de mai à août 30 %)
  const reseau = [...Array(8).fill(0.05), ...Array(4).fill(0.15)]
  expect(baseDepuisReel(reel, 2026, [], undefined, { ouverture: { annee: 2025, mois: 6 }, saisonnaliteReseau: reseau })!.base.sortie?.cave?.poids).toBeCloseTo(0.2, 9)
  expect(baseDepuisReel(reel, 2026, [], undefined, { ouverture: { annee: 2025, mois: 6 } })!.base.sortie).toBeUndefined()
})

test('calage sur le réseau : tickets au-delà du rythme de sortie et panier à mois égaux, médiane par ancienneté', () => {
  const mois = (tickets: number, ttc: number): MoisReel => ({ caHT: ttc / 1.2, margeHT: 0, caAvecMarge: 0, caTTC: ttc, tickets, univers: { cave: { caTTC: ttc, tickets }, bar: { caTTC: 0, tickets: 0 } } })
  const vide = (): MoisReel => ({ caHT: 0, margeHT: 0, caAvecMarge: 0, caTTC: 0, tickets: 0 })
  // N-1 : 1 000 tickets par mois à 24 € ; N, de janvier à août : 1 100 (ou 1 200) tickets à 25,20 €
  const magasin = (ouverture: { annee: number; mois: number }, tickets: number) => ({
    ouverture, n1: Array.from({ length: 12 }, () => mois(1_000, 24_000)),
    n: [...Array.from({ length: 8 }, () => mois(tickets, tickets * 25.2)), ...Array.from({ length: 4 }, vide)],
  })
  const egal = Array(12).fill(1 / 12)
  const magasins = [magasin({ annee: 2024, mois: 1 }, 1_100), magasin({ annee: 2024, mois: 1 }, 1_200), magasin({ annee: 2025, mois: 9 }, 2_000)]
  const c = calageMillesimes(magasins, 2026, egal, 2)
  // Sortie N-1 : 4 000 tickets sur 4 mois = 12 000 par an, 8 000 sur 8 mois ; 8 800 → + 10 %, 9 600 → + 20 %. Ouvert en
  // septembre 2025 : exclu (lancement dans la fenêtre de sortie)
  expect(c['3'].cave.tickets.magasins).toBe(2)
  proche(c['3'].cave.tickets.mediane!, 0.15)
  // Panier 25,20 € face à 24 € : + 5 %
  proche(c['3'].cave.panier.mediane!, 0.05)
  expect(c['2'].cave.tickets).toEqual({ mediane: null, magasins: 0 })
  // Moins de 8 magasins : rien de publié
  expect(calageMillesimes(magasins, 2026, egal)['3'].cave.tickets).toEqual({ mediane: null, magasins: 2 })
})
