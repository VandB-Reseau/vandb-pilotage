import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { lirePrevisionnel, ModeleInconnu } from '../../src/import/previsionnel'
import { FichierIllisible, lireClasseur } from '../../src/import/xlsx'
import { calculerBudget } from '../../src/moteur/budget'
import { parametresParDefaut } from '../../src/moteur/parametres'

// Prévisionnel fictif au format du modèle réseau (tests/fichiers), chiffres ronds inventés : dépôt public.
const ouvrir = async (nom: string) => {
  const b = readFileSync(new URL(`../fichiers/${nom}`, import.meta.url))
  return lireClasseur(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

test('le prévisionnel Excel d’un magasin donne sa base : réalisé, salaires, frais, emprunts', async () => {
  const { base, alertes } = lirePrevisionnel(await ouvrir('previsionnel-fictif.xlsx'), 2027)
  expect(base.moisRealises).toBe(8)
  // Familles sans CA écartées (Vin) ; marge réseau reprise quand la marge du magasin manque (Autre)
  expect(base.familles.map((f) => [f.univers, f.famille, f.caRealise, f.margeRealisee])).toEqual([
    ['cave', 'Bière', 120_000, 0.36], ['cave', 'Autre', 2_000, 0.3], ['bar', 'Fût', 180_000, 0.74], ['exterieur', 'Factures', 60_000, 0.4],
  ])
  expect(alertes).toEqual(['Marge réalisée absente pour Autre : marge réseau reprise.'])
  expect(base.partRealisee).toEqual({ exterieur: 0.5 })
  expect(base.flux).toEqual({ cave: { realise: 6_000, evolution: 0.03, panierCibleTTC: 24 } })
  // Salaires du compte de résultat mensuel : 11 000 + 500 + 500 ; gérance 4 000, cotisations 2 000 / 4 000
  expect(base.personnel.salairesMensuels).toEqual(Array(12).fill(12_000))
  expect(base.personnel.remunerationGerance).toBe(4_000)
  expect(base.personnel.tauxCotisationsGerance).toBe(0.5)
  expect(base.personnel.heuresMensuelles[0]).toBe(880)
  // Publicité franchise de l'Excel ignorée : l'app la recalcule sur le CA
  expect(base.frais.map((l) => [l.code, l.rubrique, l.annuel ?? l.tauxCA])).toEqual([
    ['energie', 'energies', 0.013], ['loyer', 'immobilier', 60_000], ['honoraires_comptables', 'honoraires', 6_000],
    ['apprentissage', 'impots_taxes', 500], ['cfe', 'impots_taxes', 3_000],
  ])
  expect([base.amortissements, base.interets, base.remboursementCapital, base.deficitReportable]).toEqual([24_000, 1_200, 30_000, 0])
})

test('la base importée se calcule : sans objectif, le budget reconduit l’atterrissage', async () => {
  const { base } = lirePrevisionnel(await ouvrir('previsionnel-fictif.xlsx'), 2027)
  const b = calculerBudget(base, parametresParDefaut)
  // 8 mois réalisés sur une référence 8 × 60 000 / 800 000 = 60 % ; l'extérieur a sa propre part, 50 %
  // (120 000 + 2 000 + 180 000) / 0,6 + 60 000 / 0,5 = 503 333,33 + 120 000
  expect(b.ca).toBeCloseTo(623_333.333, 2)
})

test('un classeur d’un autre modèle ou un fichier qui n’est pas un Excel sont refusés clairement', async () => {
  await expect(async () => lirePrevisionnel(await ouvrir('classeur-sans-rapport.xlsx'), 2027)).rejects.toBeInstanceOf(ModeleInconnu)
  await expect(lireClasseur(new TextEncoder().encode('pas un classeur').buffer)).rejects.toBeInstanceOf(FichierIllisible)
})
