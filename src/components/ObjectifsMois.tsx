import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { Aide } from './Aide'
import { ChampNombre } from './ChampNombre'
import { ChoixListe } from './ChoixListe'
import { nombre } from '../import/caisse'
import { montant, MOIS_LONGS, panier as prixPanier } from '../lib/format'
import { joursHorsDimanche, objectifsDuMois } from '../moteur/objectifs'
import type { MoisReel, UniversTickets } from '../moteur/suivi'
import { universLibelle, type Budget } from '../moteur/types'

const entier = (v: number) => Math.round(v).toLocaleString('fr-FR')

// Objectifs du mois pour l'équipe (lot 30, F2) : une page A4 à afficher en réserve, imprimée seule comme la fiche de visite
export function ObjectifsMois({ ouverte, fermer, magasin, annee, budget, n1, tvaPanier }: {
  ouverte: boolean
  fermer: () => void
  magasin: string
  annee: number
  budget: Budget
  n1: MoisReel[]
  tvaPanier: Record<UniversTickets, number>
}) {
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [jours, setJours] = useState(String(joursHorsDimanche(annee, mois)))
  useEffect(() => {
    const fin = () => document.body.classList.remove('fiche-seule')
    window.addEventListener('afterprint', fin)
    return () => { window.removeEventListener('afterprint', fin); fin() }
  }, [])
  const j = nombre(jours) ?? 0
  const o = objectifsDuMois(budget, mois, Number.isNaN(j) ? 0 : j, tvaPanier, n1[mois - 1])
  const univers = (['cave', 'bar'] as UniversTickets[]).filter((u) => o.univers[u])
  const imprimer = () => { document.body.classList.add('fiche-seule'); window.print() }
  const choisirMois = (m: number) => { setMois(m); setJours(String(joursHorsDimanche(annee, m))) }

  return (
    <Dialog open={ouverte} onClose={fermer} fullScreen={telephone} maxWidth="md" fullWidth aria-labelledby="titre-objectifs" className="fiche-visite">
      <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h2" component="h2" id="titre-objectifs">Objectifs de {MOIS_LONGS[mois - 1]} <Aide sujet="objectifsMois" /></Typography>
            <Typography sx={{ fontWeight: 700 }}>{magasin}</Typography>
          </Box>
          <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<PrintOutlined />} onClick={imprimer} sx={{ minHeight: 48 }}>Imprimer</Button>
            <Button onClick={fermer} sx={{ minHeight: 48 }}>Fermer</Button>
          </Box>
        </Box>
        <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 2 }}>
          <ChoixListe libelle="Mois" valeur={mois} options={MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: `${m} ${annee}` }))} onChange={choisirMois} largeur={180} />
          <ChampNombre libelle="Jours d’ouverture" valeur={jours} unite="jours" largeur={140} onChange={setJours} />
        </Box>

        {univers.length === 0 ? (
          <Typography sx={{ mt: 3 }}>Pas d’objectif de tickets pour ce mois : le budget {annee} n’a pas de CA Cave ou Bar construit par les tickets et le panier.</Typography>
        ) : (
          <>
            <Table aria-label={`Objectifs de ${MOIS_LONGS[mois - 1]}`} sx={{ mt: 3, '& td, & th': { px: 1.5, whiteSpace: 'nowrap', fontSize: '1rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  {univers.map((u) => <TableCell key={u} align="right" sx={{ fontWeight: 700 }}>{universLibelle[u]}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Clients par jour</TableCell>
                  {univers.map((u) => <TableCell key={u} align="right" sx={{ fontWeight: 700, fontSize: '1.5rem !important' }}>{entier(o.univers[u]!.ticketsParJour)}</TableCell>)}
                </TableRow>
                <TableRow>
                  <TableCell>Panier moyen TTC</TableCell>
                  {univers.map((u) => <TableCell key={u} align="right" sx={{ fontWeight: 700, fontSize: '1.5rem !important' }}>{prixPanier(o.univers[u]!.panier)}</TableCell>)}
                </TableRow>
                <TableRow>
                  <TableCell>L’an dernier en {MOIS_LONGS[mois - 1]}</TableCell>
                  {univers.map((u) => {
                    const x = o.univers[u]!
                    return <TableCell key={u} align="right">{x.ticketsParJourN1 === null ? '–' : `${entier(x.ticketsParJourN1)} clients · ${prixPanier(x.panierN1!)}`}</TableCell>
                  })}
                </TableRow>
                <TableRow>
                  <TableCell>CA TTC du mois</TableCell>
                  {univers.map((u) => <TableCell key={u} align="right">{montant(o.univers[u]!.caTTC)}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
            <Typography variant="h3" component="h3" sx={{ mt: 3, mb: 1 }}>Un euro de plus par client</Typography>
            <Box component="ul" aria-label="Un euro de plus par client" sx={{ m: 0, pl: 2.5 }}>
              {univers.map((u) => (
                <li key={u}><Typography>{universLibelle[u]} : <b>+{montant(o.univers[u]!.unEuroDePlus)}</b> TTC sur le mois, sans un client de plus.</Typography></li>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
