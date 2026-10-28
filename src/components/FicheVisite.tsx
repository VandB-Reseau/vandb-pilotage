import { useEffect } from 'react'
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
import { texteAlerte } from './AlertesMagasins'
import { roleLibelle } from '../auth/roles'
import { chargerActions, chargerAlertes } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartPts, ecartTaux, milliers, MOIS_LONGS, panier as prixPanier, taux } from '../lib/format'
import type { MoisReel, UniversTickets } from '../moteur/suivi'
import { universLibelle, type Budget } from '../moteur/types'
import { ficheVisite, type SujetVisite } from '../moteur/visite'

const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR')
const aujourdhuiISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Sujet de visite : le constat et le levier à travailler avec le franchisé
export function texteSujet(s: SujetVisite): { constat: string; levier: string } {
  switch (s.type) {
    case 'ca': return { constat: `CA ${ecartTaux(s.ecart)} face au budget`, levier: 'Fréquentation et temps forts : revoir le calendrier commercial des prochains mois.' }
    case 'marge': return { constat: `Taux de marge ${ecartPts(s.ecart)} sur l’an dernier`, levier: 'Mix et démarque : mise en avant des familles les mieux margées, suivi de la casse.' }
    case 'tickets': return { constat: `Tickets ${universLibelle[s.univers]} ${ecartTaux(s.ecart)} sur l’an dernier`, levier: 'Fréquentation : animations, fidélité, vitrine et communication locale.' }
    case 'panier': return { constat: `Panier ${universLibelle[s.univers]} ${ecartTaux(s.ecart)} sur l’an dernier`, levier: 'Vente additionnelle : conseil, accords mets et boissons, formation à la vente.' }
  }
}

// Fiche de visite du Coach (lot 28) : une page A4 à imprimer avant la visite. À l'impression, seule la fiche sort.
export function FicheVisite({ ouverte, fermer, magasin, annee, n, n1, budget, tvaPanier }: {
  ouverte: boolean
  fermer: () => void
  magasin: string
  annee: number
  n: MoisReel[]
  n1: MoisReel[]
  budget: Budget | null
  tvaPanier: Record<UniversTickets, number>
}) {
  const theme = useTheme()
  const telephone = useMediaQuery(theme.breakpoints.down('md'))
  const { donnees } = useChargement(() => Promise.all([chargerAlertes().catch(() => []), chargerActions().catch(() => [])]), [])
  useEffect(() => {
    const fin = () => document.body.classList.remove('fiche-seule')
    window.addEventListener('afterprint', fin)
    return () => { window.removeEventListener('afterprint', fin); fin() }
  }, [])
  const f = ficheVisite({ n, n1, budget }, tvaPanier)
  const alertes = donnees?.[0].filter((a) => a.magasin === magasin) ?? []
  const actions = (donnees?.[1] ?? []).filter((a) => a.magasin === magasin && a.statut === 'a_faire')
    .sort((a, b) => (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999'))
  const aujourdhui = aujourdhuiISO()
  const fin = f.mois ? MOIS_LONGS[f.mois - 1] : ''
  const imprimer = () => { document.body.classList.add('fiche-seule'); window.print() }

  const ligne = (libelle: string, valeur: string, budgetTexte: string, n1Texte: string, rouge = false) => (
    <TableRow key={libelle}>
      <TableCell>{libelle}</TableCell>
      <TableCell align="right" sx={{ fontWeight: 700 }}>{valeur}</TableCell>
      <TableCell align="right">{budgetTexte}</TableCell>
      <TableCell align="right" sx={rouge ? { color: 'error.main', fontWeight: 600 } : undefined}>{n1Texte}</TableCell>
    </TableRow>
  )
  const titre = (t: string) => <Typography variant="h3" component="h3" sx={{ mt: 2.5, mb: 1 }}>{t}</Typography>

  return (
    <Dialog open={ouverte} onClose={fermer} fullScreen={telephone} maxWidth="md" fullWidth aria-labelledby="titre-fiche-visite" className="fiche-visite">
      <DialogContent sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h2" component="h2" id="titre-fiche-visite">Fiche de visite <Aide sujet="ficheVisite" /></Typography>
            <Typography sx={{ fontWeight: 700 }}>{magasin}</Typography>
            <Typography variant="body2" color="text.secondary">Préparée le {jour(aujourdhui)}{f.mois ? ` · chiffres à fin ${fin} ${annee}` : ''}</Typography>
          </Box>
          <Box className="pas-a-l-impression" sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<PrintOutlined />} onClick={imprimer} sx={{ minHeight: 48 }}>Imprimer</Button>
            <Button onClick={fermer} sx={{ minHeight: 48 }}>Fermer</Button>
          </Box>
        </Box>

        {f.mois === 0 ? (
          <Typography sx={{ mt: 2 }}>Pas encore de réel {annee} : la fiche se remplit avec le premier mois importé ou saisi.</Typography>
        ) : (
          <>
            {titre(`Depuis le 1er janvier, à fin ${fin}`)}
            <Table size="small" aria-label="Chiffres à date" sx={{ '& td, & th': { px: 1, whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell align="right">{annee}</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Sur {annee - 1}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ligne('CA HT', milliers(f.ca),
                  f.caBudget && f.ecartBudget !== null ? `${milliers(f.caBudget)} (${ecartTaux(f.ecartBudget)})` : '–',
                  f.evolution === null ? '–' : ecartTaux(f.evolution), (f.evolution ?? 0) < 0)}
                {ligne('Taux de marge', f.tauxMarge === null ? '–' : taux(f.tauxMarge), '–',
                  f.ecartMarge === null ? '–' : ecartPts(f.ecartMarge), (f.ecartMarge ?? 0) < 0)}
                {(['cave', 'bar'] as UniversTickets[]).flatMap((u) => {
                  const v = f.univers[u]
                  if (!v) return []
                  return [
                    ligne(`Tickets ${universLibelle[u]}`, v.tickets.toLocaleString('fr-FR'), '–', ecartTaux(v.evolutionTickets), v.evolutionTickets < 0),
                    ligne(`Panier ${universLibelle[u]} TTC`, prixPanier(v.panier), '–', ecartTaux(v.evolutionPanier), v.evolutionPanier < 0),
                  ]
                })}
              </TableBody>
            </Table>

            {titre('Trois sujets à aborder')}
            {f.sujets.length === 0 ? (
              <Typography>Rien ne recule face au budget ni à l’an dernier : la visite peut porter sur les projets du magasin.</Typography>
            ) : (
              <Box component="ol" aria-label="Sujets à aborder" sx={{ m: 0, pl: 2.5 }}>
                {f.sujets.map((s) => {
                  const t = texteSujet(s)
                  return (
                    <li key={`${s.type}-${'univers' in s ? s.univers : ''}`}>
                      <Typography><b>{t.constat}</b> : {milliers(s.enJeu)} de marge en jeu depuis janvier.</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t.levier}</Typography>
                    </li>
                  )
                })}
              </Box>
            )}
          </>
        )}

        {titre('Alertes')}
        {alertes.length === 0 ? <Typography>Aucune alerte.</Typography> : (
          <Box component="ul" aria-label="Alertes du magasin" sx={{ m: 0, pl: 2.5 }}>
            {alertes.map((a) => <li key={texteAlerte(a)}><Typography>{texteAlerte(a)}</Typography></li>)}
          </Box>
        )}

        {titre('Plan d’action en cours')}
        {actions.length === 0 ? <Typography>Aucune action en cours.</Typography> : (
          <Box component="ul" aria-label="Actions en cours du magasin" sx={{ m: 0, pl: 2.5 }}>
            {actions.map((a) => {
              const retard = a.echeance !== null && a.echeance < aujourdhui
              return (
                <li key={a.id}>
                  <Typography>
                    {a.intitule} · {roleLibelle[a.responsable]}
                    {a.echeance && <Box component="span" sx={retard ? { color: 'error.main', fontWeight: 700 } : undefined}> · {retard ? 'en retard, prévue le' : 'pour le'} {jour(a.echeance)}</Box>}
                  </Typography>
                </li>
              )
            })}
          </Box>
        )}

        {titre('Notes de la visite')}
        <Box aria-label="Zone de notes" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, minHeight: 160 }} />
        {titre('Engagements pris, qui, pour quand')}
        <Box aria-label="Zone des engagements" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, minHeight: 120 }} />
      </DialogContent>
    </Dialog>
  )
}
