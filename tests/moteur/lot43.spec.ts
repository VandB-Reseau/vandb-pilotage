import { expect, test } from '@playwright/test'
import { attente, avancementParRR, etapeCampagne, joursDepuis, magasinsCampagne, marquesEtapes, type Campagne } from '../../src/moteur/campagne'
import { aTraiter, filtrerMagasins } from '../../src/lib/aFaire'

// Lot 43 : suivi de la campagne des budgets selon le rôle, état des étapes dans le menu. Magasins fictifs, chaque
// résultat se vérifie à la main.
const c: Campagne = { proposition: '2026-11-15', retour: '2026-12-05', validation: '2026-12-19' }

test('étapes de la campagne et temps d’attente', () => {
  expect([null, 'propose', 'en_discussion', 'valide'].map((s) => etapeCampagne(s as never))).toEqual(['a_proposer', 'chez_franchise', 'retour', 'valide'])
  // Du 1er au 20 novembre : 19 jours ; l'heure ne compte pas
  expect(joursDepuis('2026-11-01T23:30:00Z', '2026-11-20')).toBe(19)
  expect(joursDepuis(null, '2026-11-20')).toBeNull()
  // Chez le franchisé : depuis la dernière modification ; en retour : depuis l'envoi au siège
  expect(attente({ statut: 'propose', majLe: '2026-11-10T08:00:00Z' }, '2026-11-20')).toBe(10)
  expect(attente({ statut: 'en_discussion', majLe: '2026-11-18T08:00:00Z', envoyeLe: '2026-11-17T08:00:00Z' }, '2026-11-20')).toBe(3)
  expect(attente({ statut: 'en_discussion', majLe: '2026-11-18T08:00:00Z', envoyeLe: null }, '2026-11-20')).toBe(2)
  expect(attente({ statut: 'valide', majLe: '2026-11-18T08:00:00Z' }, '2026-11-20')).toBeNull()
  expect(attente({ statut: null, majLe: null }, '2026-11-20')).toBeNull()
})

test('Directeur : une ligne par Responsable Régional, dépliée sur ses Coachs', () => {
  const l = avancementParRR([
    { statut: null, rrs: ['RR Nord'], coach: 'Coach A' },          // à proposer, en retard le 20 novembre
    { statut: 'propose', rrs: ['RR Nord'], coach: 'Coach A' },
    { statut: 'valide', rrs: ['RR Nord'], coach: 'Coach B' },
    { statut: 'en_discussion', rrs: ['RR Sud'], coach: null },
  ], c, '2026-11-20')
  expect(l.map((x) => [x.nom, x.magasins, x.aProposer, x.proposes, x.enDiscussion, x.valides, x.enRetard])).toEqual([
    ['RR Nord', 3, 1, 1, 0, 1, 1], ['RR Sud', 1, 0, 0, 1, 0, 0],
  ])
  expect(l[0].coachs.map((x) => [x.nom, x.magasins, x.enRetard])).toEqual([['Coach A', 2, 1], ['Coach B', 1, 0]])
  // Le magasin sans Coach reste compté, sous « sans nom »
  expect(l[1].coachs.map((x) => [x.nom, x.magasins])).toEqual([['', 1]])
})

test('Coach : ses magasins, en retard d’abord, puis l’attente la plus longue', () => {
  const l = magasinsCampagne([
    { magasin: 'Brionne', statut: 'propose', majLe: '2026-11-14T09:00:00Z' },           // 6 jours
    { magasin: 'Arlanc', statut: 'valide', majLe: '2026-11-19T09:00:00Z' },
    { magasin: 'Corvol', statut: null, majLe: null },                                    // en retard depuis le 15
    { magasin: 'Dornes', statut: 'propose', majLe: '2026-11-01T09:00:00Z' },             // 19 jours
    { magasin: 'Égly', statut: 'en_discussion', majLe: null, envoyeLe: '2026-11-17T09:00:00Z' },   // 3 jours
  ], c, '2026-11-20')
  expect(l.map((x) => [x.magasin, x.etape, x.attente, x.enRetard])).toEqual([
    ['Corvol', 'a_proposer', null, true],
    ['Dornes', 'chez_franchise', 19, false],
    ['Brionne', 'chez_franchise', 6, false],
    ['Égly', 'retour', 3, false],
    ['Arlanc', 'valide', null, false],
  ])
})

test('liste filtrée par étape, par retard et par responsable ; « À traiter » sans les étapes du budget', () => {
  const m = (magasin: string, statut: 'propose' | 'valide' | null, responsables: string[], enRetard = false) =>
    ({ magasin, statut, groupeId: null, aEquipe: true, aFrais: magasin !== 'B', responsables, enRetard })
  const l = [m('A', null, ['RR Nord', 'Coach A'], true), m('B', 'propose', ['RR Nord', 'Coach B']), m('C', 'valide', ['RR Sud'])]
  expect(filtrerMagasins(l, 'en_retard', '', null).map((x) => x.magasin)).toEqual(['A'])
  expect(filtrerMagasins(l, 'tous', '', null, 'RR Nord').map((x) => x.magasin)).toEqual(['A', 'B'])
  expect(filtrerMagasins(l, 'propose', '', null, 'RR Nord').map((x) => x.magasin)).toEqual(['B'])
  expect(filtrerMagasins(l, 'tous', '', null, 'Coach A').map((x) => x.magasin)).toEqual(['A'])
  expect(aTraiter(l, [], [], '2026-11-20')).toEqual([{ cle: 'frais', filtre: 'frais', nombre: 1, magasins: ['B'] }])
})

test('état des étapes dans le menu, selon qui regarde (trois étapes, 03/11/2026)', () => {
  const base = { statut: 'propose' as const, propose: true, modifie: false, changements: 0 }
  expect(marquesEtapes({ ...base, statut: null, propose: false, role: 'directeur' })).toEqual({ budget: 'À proposer', visualiser: '', echanges: '' })
  expect(marquesEtapes({ ...base, statut: null, propose: false, role: 'franchise' })).toEqual({ budget: 'En attente du siège', visualiser: '', echanges: '' })
  expect(marquesEtapes({ ...base, role: 'franchise' })).toEqual({ budget: 'À relire', visualiser: '', echanges: 'À envoyer' })
  expect(marquesEtapes({ ...base, changements: 3, role: 'franchise' }).budget).toBe('3 changements à envoyer')
  expect(marquesEtapes({ ...base, modifie: true, role: 'franchise' }).budget).toBe('Non enregistré')
  expect(marquesEtapes({ ...base, role: 'coach' })).toEqual({ budget: '', visualiser: '', echanges: 'Chez le franchisé' })
  expect(marquesEtapes({ ...base, statut: 'en_discussion', role: 'rr' }).echanges).toBe('À valider')
  expect(marquesEtapes({ ...base, statut: 'en_discussion', role: 'franchise' }).echanges).toBe('Envoyé au siège')
  expect(marquesEtapes({ ...base, statut: 'valide', role: 'coach' })).toEqual({ budget: 'Validé', visualiser: '', echanges: 'Validé' })
})
