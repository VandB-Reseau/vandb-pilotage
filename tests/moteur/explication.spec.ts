import { expect, test } from '@playwright/test'
import { calculerBudget } from '../../src/moteur/budget'
import { expliquerCA, expliquerEBE, expliquerMarge, type Explication } from '../../src/moteur/explication'
import { parametresParDefaut } from '../../src/moteur/parametres'
import type { Hypotheses, TempsFort } from '../../src/moteur/types'
import { magasinFictif } from '../donnees-fictives'

// « D'où vient ce chiffre ? » (lot 25) sur le magasin fictif : chaque étape se vérifie à la main (calcul en commentaire).
// Magasin fictif : Cave 200 000 attendus en 2026, Bar 300 000, Extérieur 100 000 ; saisonnalité 7,5 % de janvier à août.
const proche = (v: number | undefined, attendu: number) => expect(v).toBeCloseTo(attendu, 6)
const resume = (e: Explication) => e.groupes.map((g) => ({ titre: g.titre, etapes: g.etapes.map((x) => [x.libelle, Math.round(x.resultat * 100) / 100]) }))

test('CA, marge et EBE du magasin fictif : évolution des familles, marge visée, charges jusqu’à l’EBE', () => {
  const b = calculerBudget(magasinFictif, parametresParDefaut)
  // Cave 200 000 × 1,05 ; Bar 300 000 × 1,10 ; Extérieur sans évolution
  expect(resume(expliquerCA(b, 2027))).toEqual([
    { titre: 'Cave', etapes: [['CA 2026 attendu', 200_000], ['Évolution des familles', 210_000]] },
    { titre: 'Bar', etapes: [['CA 2026 attendu', 300_000], ['Évolution des familles', 330_000]] },
    { titre: 'Extérieur', etapes: [['CA 2026 attendu', 100_000]] },
  ])
  proche(expliquerCA(b, 2027).groupes[0].etapes[1].taux, 0.05)
  proche(expliquerCA(b, 2027).total, 640_000)
  // 210 000 × 38 % ; 330 000 × 75 % ; 100 000 × 40 %
  const marge = expliquerMarge(b)
  expect(resume(marge)).toEqual([
    { titre: 'Cave', etapes: [['Chiffre d’affaires HT', 210_000], ['Marge visée des familles', 79_800]] },
    { titre: 'Bar', etapes: [['Chiffre d’affaires HT', 330_000], ['Marge visée des familles', 247_500]] },
    { titre: 'Extérieur', etapes: [['Chiffre d’affaires HT', 100_000], ['Marge visée des familles', 40_000]] },
  ])
  proche(marge.groupes[0].etapes[1].part, 0.38)
  proche(marge.total, 367_300)
  // 367 300 − redevance 12 800 − publicité 6 400 − autres charges externes 74 320 (93 520 − 19 200) − impôts 3 000 − personnel 216 000
  expect(resume(expliquerEBE(b))).toEqual([
    { titre: 'EBE', etapes: [['Marge commerciale', 367_300], ['Redevance', 354_500], ['Publicité', 348_100], ['Autres charges externes', 273_780], ['Impôts et taxes', 270_780], ['Personnel', 54_780]] },
  ])
  proche(expliquerEBE(b).groupes[0].etapes[3].montant, -74_320)
  proche(expliquerEBE(b).total, 54_780)
})

test('CA construit par les tickets : rythme de sortie, tickets, panier, temps forts et ajustements datés', () => {
  const oktoberfest: TempsFort = { nom: 'Oktoberfest', type: 'exterieur', mois: 6, univers: 'exterieur', caAnPasse: 20_000 * 0.6, ca: 15_000, extrasPersonnel: 0, autresCharges: 0, moisAchats: 6 }
  const h: Hypotheses = {
    ...magasinFictif, caParTickets: true,
    familles: magasinFictif.familles.map((f) => ({ ...f, evolution: 0 })),
    flux: { cave: { realise: 6_000, evolution: 0.03, panierCibleTTC: 24, evolutionPanier: 0.02 } },
    sortie: { cave: { ca: 66_000, poids: 0.3, de: 5, a: 8 } }, rythme: { cave: 'auto' },
    tempsForts: [oktoberfest],
    ajustementsCA: [{ libelle: 'Concurrent', univers: 'bar', de: 10, a: 12, taux: -0.1 }],
  }
  const b = calculerBudget(h, parametresParDefaut)
  const e = expliquerCA(b, 2027)
  // Cave : 66 000 / 30 % = 220 000 (+ 10 %), × 1,03 = 226 600, × 1,02 = 231 132
  // Bar : 300 000, − 10 % de 30 000 par mois d'octobre à décembre = − 9 000
  // Extérieur : (60 000 − 12 000) / 60 % = 80 000, soit 20 000 retirés, puis 15 000 en juin
  expect(resume(e)).toEqual([
    { titre: 'Cave', etapes: [['CA 2026 attendu', 200_000], ['Rythme des derniers mois', 220_000], ['Évolution des tickets', 226_600], ['Évolution du panier moyen', 231_132]] },
    { titre: 'Bar', etapes: [['CA 2026 attendu', 300_000], ['Ajustements datés', 291_000]] },
    { titre: 'Extérieur', etapes: [['CA 2026 attendu', 100_000], ['Temps forts 2026 retirés', 80_000], ['Temps forts 2027', 95_000]] },
  ])
  proche(e.groupes[0].etapes[1].taux, 0.1)
  proche(e.groupes[2].etapes[1].montant, -20_000)
  // Le dernier résultat de chaque univers retombe sur le CA du budget
  proche(e.total, 231_132 + 291_000 + 95_000)
  proche(b.ca, e.total)
})

test('travaux et démarque : part de l’année ouverte, démarque retirée de la marge visée', () => {
  const h: Hypotheses = {
    ...magasinFictif,
    familles: magasinFictif.familles.map((f, i) => (i === 0 ? { ...f, demarque: 0.02 } : f)),
    travaux: { activite: [0, ...Array(11).fill(1)], gain: 0, investissement: 0, dureeAmortissement: 0 },
  }
  const b = calculerBudget(h, parametresParDefaut)
  // Janvier fermé : 92,5 % de l'année ouverte. Cave 200 000 × 1,05 = 210 000, × 92,5 % = 194 250
  const cave = expliquerCA(b, 2027).groupes[0]
  expect(cave.etapes.map((x) => x.libelle)).toEqual(['CA 2026 attendu', 'Évolution des familles', 'Travaux : part de l’année ouverte'])
  proche(cave.etapes[1].taux, 0.05)
  proche(cave.etapes[2].taux, -0.075)
  proche(cave.etapes[2].resultat, 194_250)
  // Marge Cave : 194 250 × 38 % = 73 815, démarque 2 % = − 3 885, reste 69 930
  const m = expliquerMarge(b).groupes[0].etapes
  proche(m[2].montant, -3_885)
  proche(m[2].part, 0.02)
  proche(m[2].resultat, 69_930)
})
