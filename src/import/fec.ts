import type { EcritureFEC } from '../moteur/fec'
import { FichierInattendu, nombre } from './caisse'

// FEC : fichier texte, une écriture par ligne, champs séparés par une tabulation ou une barre verticale (article A47 A-1
// du livre des procédures fiscales). Colonnes utiles : CompteNum, CompteLib, EcritureDate (AAAAMMJJ), Debit et Credit,
// ou Montant et Sens (D ou C). Le fichier ne quitte pas le navigateur : seuls les montants du quadrimestre sont repris.

export interface LectureFEC { ecritures: EcritureFEC[]; erreurs: string[]; nbLignes: number }

// UTF-8 si possible, sinon l'encodage Windows de la plupart des logiciels comptables
export function texteDuFEC(contenu: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(contenu) } catch { return new TextDecoder('windows-1252').decode(contenu) }
}

// « 20260415 », « 2026-04-15 », « 15/04/2026 » → « 2026-04-15 »
function dateFEC(s: string): string | null {
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/) ?? s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function lireFEC(texte: string): LectureFEC {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const premiere = lignes[0] ?? ''
  const sep = premiere.includes('\t') ? '\t' : premiere.includes('|') ? '|' : ';'
  const entete = premiere.split(sep).map((c) => c.trim().toLowerCase())
  const col = (nom: string) => entete.indexOf(nom)
  const avecSens = col('debit') < 0 && col('montant') >= 0 && col('sens') >= 0
  const attendues = ['comptenum', 'ecrituredate', ...(avecSens ? ['montant', 'sens'] : ['debit', 'credit'])]
  const manquantes = attendues.filter((a) => col(a) < 0)
  if (manquantes.length) throw new FichierInattendu(manquantes)

  const erreurs: string[] = []
  const ecritures: EcritureFEC[] = []
  lignes.slice(1).forEach((l, i) => {
    const v = l.split(sep).map((x) => x.trim())
    const n = i + 2
    const compte = v[col('comptenum')] ?? ''
    const date = dateFEC(v[col('ecrituredate')] ?? '')
    if (!compte) { erreurs.push(`Ligne ${n} : numéro de compte vide.`); return }
    if (!date) { erreurs.push(`Ligne ${n} : date « ${v[col('ecrituredate')] ?? ''} » illisible.`); return }
    let solde: number
    if (avecSens) {
      const montant = nombre(v[col('montant')]) ?? 0
      const sens = (v[col('sens')] ?? '').toUpperCase()
      if (Number.isNaN(montant) || !['D', 'C', '+1', '-1'].includes(sens)) { erreurs.push(`Ligne ${n} : montant ou sens illisible.`); return }
      solde = sens === 'C' || sens === '-1' ? -montant : montant
    } else {
      const debit = nombre(v[col('debit')]) ?? 0, credit = nombre(v[col('credit')]) ?? 0
      if (Number.isNaN(debit) || Number.isNaN(credit)) { erreurs.push(`Ligne ${n} : montant illisible.`); return }
      solde = debit - credit
    }
    ecritures.push({ compte, libelle: col('comptelib') >= 0 ? v[col('comptelib')] ?? '' : '', date, solde })
  })
  return { ecritures, erreurs, nbLignes: lignes.length - 1 }
}
