import { useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import { ChampNombre } from './ChampNombre'
import { Indicateur } from './Indicateur'
import { nombre } from '../import/caisse'
import { ecartTaux, milliers, taux } from '../lib/format'
import { caPourRemuneration, economieFranchise } from '../moteur/economie'
import type { Budget, Hypotheses, ParametresReseau } from '../moteur/types'

// Économie du franchisé (lot 29) : point mort, marge de sécurité, gérant, reste disponible ; CA pour une rémunération visée
export function EconomieFranchise({ budget, hypotheses, parametres, annee }: {
  budget: Budget
  hypotheses: Hypotheses
  parametres: ParametresReseau
  annee: number
}) {
  const [cible, setCible] = useState('')
  const e = economieFranchise(budget, hypotheses, parametres)
  const lue = nombre(cible)
  const caCible = lue !== null && !Number.isNaN(lue) && lue > 0 ? caPourRemuneration(e, lue) : null
  return (
    <Card component="section" aria-label="Économie du franchisé" sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h2" sx={{ mb: 2 }}>Économie du franchisé {annee} <Aide sujet="economie" /></Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Indicateur libelle="Point mort" aide="pointMort" valeur={e.pointMort === null ? 'Non atteint' : milliers(e.pointMort)}
          detail={e.pointMort === null ? 'La marge ne couvre pas les coûts variables' : `soit ${milliers(e.pointMort / 12)} par mois`} />
        <Indicateur libelle="Marge de sécurité" aide="margeSecurite" valeur={e.margeSecurite === null ? '–' : taux(e.margeSecurite)}
          ecart={e.margeSecurite !== null && e.margeSecurite < 0 ? { texte: 'sous le point mort', hausse: false, favorable: false } : undefined}
          detail={`sur un CA de ${milliers(e.ca)}`} />
        <Indicateur libelle="Gérant" aide="gerant" valeur={milliers(e.gerant)} detail="rémunération de l’année, charges comprises" />
        <Indicateur libelle="Reste disponible" aide="resteDisponible" valeur={milliers(e.resteDisponible)} detail="après le remboursement des emprunts" />
      </Box>
      <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography aria-hidden>Rémunération du gérant visée</Typography>
        <ChampNombre libelle="Rémunération du gérant visée" valeur={cible} largeur={160} unite="€ par an" onChange={setCible} />
        {caCible !== null && (
          <Typography aria-live="polite" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            CA à atteindre : <b>{milliers(caCible.ca)}</b> ({ecartTaux(caCible.ecart)} sur le budget)
          </Typography>
        )}
      </Box>
    </Card>
  )
}
