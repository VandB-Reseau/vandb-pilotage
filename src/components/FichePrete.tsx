import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import LinearProgress from '@mui/material/LinearProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { enregistrerOuverture } from '../data/pilotage'
import { controlesFiche, type EtatFiche } from '../moteur/preparation'
import type { Hypotheses } from '../moteur/types'

// Lot 41, proposition 2 : la fiche « prête à proposer ». Quatre contrôles, chacun mène à l'écran où le compléter ; la date
// d'ouverture se saisit sur place (sans budget, l'écran des ventes ne l'affiche pas encore). Rien n'est bloquant.
export function FichePrete({ magasin, etat, allerA, directeur, apresOuverture, reprise }: {
  magasin: string
  etat: EtatFiche
  reprise?: Hypotheses['reprise'] // lot 42 : équipe ou frais repris des comptes de l'année
  allerA: (partie: string) => void
  directeur: boolean
  apresOuverture: () => void
}) {
  const controles = controlesFiche(etat)
  const repris = (cle: string) => !!reprise && ((cle === 'equipe' && reprise.personnel) || (cle === 'frais' && reprise.frais))
  const faits = controles.filter((c) => c.fait).length
  const [date, setDate] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState(false)
  const lue = /^\d{4}-(0[1-9]|1[0-2])$/.test(date) ? { annee: Number(date.slice(0, 4)), mois: Number(date.slice(5, 7)) } : null
  const enregistrer = async () => {
    if (!lue) return
    setOccupe(true)
    setErreur(false)
    try {
      await enregistrerOuverture(magasin, lue)
      apresOuverture()
    } catch {
      setErreur(true)
    } finally {
      setOccupe(false)
    }
  }
  return (
    <Card component="section" aria-label="Fiche prête à proposer" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 220 }}>{faits === controles.length ? 'Fiche prête à proposer' : `Fiche prête à ${faits} sur ${controles.length}`}</Typography>
        {!(etat.equipe && etat.frais) && <Typography variant="body2" color="text.secondary">Il manque de quoi calculer l’EBE</Typography>}
      </Box>
      <LinearProgress variant="determinate" value={(faits / controles.length) * 100} aria-label={`Fiche prête à ${faits} sur ${controles.length}`}
        color={faits === controles.length ? 'success' : 'warning'} sx={{ height: 8, borderRadius: 4, mb: 1.5 }} />
      {erreur && <Alert severity="error" sx={{ mb: 1 }}>L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.</Alert>}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
        {controles.map((c) => (
          <Box component="li" key={c.cle} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minHeight: 48 }}>
            {c.fait ? <CheckCircleOutlined color="success" aria-hidden /> : <ErrorOutlineOutlined color="warning" aria-hidden />}
            <Typography sx={{ fontWeight: 700, minWidth: 160 }}>{c.libelle}</Typography>
            <Typography color={c.fait ? 'text.secondary' : 'warning.dark'} sx={{ flex: 1, minWidth: 180 }}>{!c.fait ? c.aFaire : repris(c.cle) && reprise ? `Repris des comptes ${reprise.annee} (${reprise.mois} mois), à détailler si besoin` : 'Fait'}</Typography>
            {!c.fait && c.cle === 'ouverture' && directeur && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <TextField type="month" size="small" label="Ouvert depuis" value={date} onChange={(e) => setDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Mois d’ouverture du magasin' } }} sx={{ width: 190, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
                <Button variant="outlined" startIcon={<SaveOutlined />} disabled={occupe || !lue} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
              </Box>
            )}
            {(!c.fait && c.cle !== 'ouverture') || repris(c.cle) ? (
              <Button onClick={() => allerA(c.partie)} sx={{ minHeight: 48 }} aria-label={`${c.fait ? 'Détailler' : 'Renseigner'} : ${c.libelle}`}>{c.fait ? 'Détailler' : 'Renseigner'}</Button>
            ) : null}
          </Box>
        ))}
      </Box>
    </Card>
  )
}
