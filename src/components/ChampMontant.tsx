import { useEffect, useState } from 'react'
import { nombre } from '../import/caisse'
import { enChiffres } from '../lib/format'
import { ChampNombre } from './ChampNombre'

// Montant gardé en texte pendant la frappe ; le nombre part dès qu'il est lisible (vide = 0)
export function ChampMontant({ libelle, valeur, onChange, unite = '€', largeur = 130, desactive }: {
  libelle: string
  valeur: number
  onChange: (v: number) => void
  unite?: string
  largeur?: number
  desactive?: boolean
}) {
  const [texte, setTexte] = useState(valeur ? enChiffres(valeur) : '')
  // Valeur changée ailleurs : le champ suit
  useEffect(() => { setTexte((t) => ((nombre(t) ?? 0) === valeur ? t : valeur ? enChiffres(valeur) : '')) }, [valeur])
  return (
    <ChampNombre libelle={libelle} valeur={texte} unite={unite} largeur={largeur} desactive={desactive}
      onChange={(v) => { setTexte(v); const n = nombre(v); if (!Number.isNaN(n)) onChange(n ?? 0) }} />
  )
}
