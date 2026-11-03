import { expect, test } from '@playwright/test'
import { syntheseConcordance, type LigneConcordance } from '../../src/moteur/concordance'

// Préparation de la fusion (0028) : CA de la caisse face au CA saisi dans l'app réseau. Magasins fictifs, résultats vérifiés à la main.
const l = (magasin: string, mois: string, caCaisse: number | null, caReseau: number | null): LigneConcordance =>
  ({ magasin, mois, caCaisse, ticketsCaisse: null, caReseau, ticketsReseau: null })

test('mois communs : écart sur la somme et pire mois', () => {
  // Magasin A : janvier 10 000 / 10 000 ; février 10 300 / 10 000 (+3 %) ; somme 20 300 / 20 000 = +1,5 %
  const s = syntheseConcordance([l('A', '2026-01', 10000, 10000), l('A', '2026-02', 10300, 10000)])
  expect(s.magasins[0]).toMatchObject({ magasin: 'A', moisCommuns: 2, moisReseauSeul: [], moisCaisseSeule: 0, caCaisse: 20300, caReseau: 20000, statut: 'ecart' })
  expect(s.magasins[0].ecart).toBeCloseTo(0.015, 10)
  expect(s.magasins[0].pireMois).toEqual({ mois: '2026-02', ecart: expect.closeTo(0.03, 10) })
  expect(s).toMatchObject({ manques: 0, ecarts: 1, concordants: 0 })
})

test('sous le seuil de 2 % : le magasin concorde', () => {
  // 9 900 / 10 000 = −1 %
  const s = syntheseConcordance([l('B', '2026-03', 9900, 10000)])
  expect(s.magasins[0].statut).toBe('concorde')
  expect(s.concordants).toBe(1)
})

test('un mois de l’app réseau absent de la caisse passe avant tout le reste', () => {
  const s = syntheseConcordance([
    l('C', '2026-01', 5000, 5000),
    l('D', '2026-01', 12000, 10000),                  // +20 %
    l('E', '2026-01', null, 8000), l('E', '2026-02', 0, 7000), l('E', '2026-03', 9000, 9000),
    l('F', '2026-01', 4000, null),                    // caisse seule : rien à perdre
  ])
  expect(s.magasins.map((m) => [m.magasin, m.statut])).toEqual([['E', 'manque'], ['D', 'ecart'], ['C', 'concorde'], ['F', 'caisse_seule']])
  expect(s.magasins[0].moisReseauSeul).toEqual(['2026-01', '2026-02'])
  expect(s.magasins[3]).toMatchObject({ moisCaisseSeule: 1, ecart: null, pireMois: null })
  expect(s).toMatchObject({ manques: 1, ecarts: 1, concordants: 2 })
})

test('les écarts se rangent du plus grand au plus petit, en valeur absolue', () => {
  const s = syntheseConcordance([l('G', '2026-05', 9000, 10000), l('H', '2026-05', 10500, 10000)]) // −10 % et +5 %
  expect(s.magasins.map((m) => m.magasin)).toEqual(['G', 'H'])
})
