import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import { EtatVide } from './EtatVide'
import { Panne } from './Panne'
import { anneeSuivi } from '../data/annees'
import { chargerPreparationFusion, rattacherMagasin, type MagasinOrphelin } from '../data/fusion'
import { useChargement } from '../data/useChargement'
import { syntheseConcordance, type StatutConcordance } from '../moteur/concordance'
import { montant, MOIS_LONGS, tauxCourt } from '../lib/format'

const nomMois = (m: string) => `${MOIS_LONGS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const STATUTS: Record<StatutConcordance, { libelle: string; couleur: 'error' | 'warning' | 'success' | 'default' }> = {
  manque: { libelle: 'Mois absents de la caisse', couleur: 'error' },
  ecart: { libelle: 'Écart', couleur: 'warning' },
  concorde: { libelle: 'Concorde', couleur: 'success' },
  caisse_seule: { libelle: 'Caisse seule', couleur: 'default' },
}

// Directeur : avant la fusion avec l'app réseau, CA de la caisse face aux chiffres saisis dans l'app réseau, et
// rattachement des données d'un magasin renommé dans l'app réseau (migration 0028)
export function PreparationFusion() {
  const suivi = anneeSuivi()
  const [annee, setAnnee] = useState(suivi)
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerPreparationFusion(annee), [annee])
  const synthese = useMemo(() => (donnees ? syntheseConcordance(donnees.concordance) : null), [donnees])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  async function rattacher(o: MagasinOrphelin) {
    if (!o.nouveauNom) return
    setOccupe(true); setMessage(null)
    try {
      const r = await rattacherMagasin(o.magasin, o.nouveauNom)
      setMessage({ gravite: 'success', texte: `Données de « ${o.magasin} » rattachées à ${o.nouveauNom} : ${r.deplacees} ligne${r.deplacees > 1 ? 's' : ''}.`
        + (r.restees ? ` ${r.restees} ligne${r.restees > 1 ? 's' : ''} déjà présente${r.restees > 1 ? 's' : ''} sous ${o.nouveauNom} ${r.restees > 1 ? 'sont restées' : 'est restée'} sous l’ancien nom, pour ne rien écraser.` : '') })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'Le rattachement n’a pas abouti. Rien n’a été modifié ; réessaie dans un instant.' })
    } finally {
      setOccupe(false)
    }
  }

  const absente = donnees === null && !erreur && !chargement
  return (
    <Card component="section" aria-label="Avant la fusion avec l’app réseau" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, mb: 1.5 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>Avant la fusion avec l’app réseau <Aide sujet="fusion" /></Typography>
        {!absente && (
          <ToggleButtonGroup exclusive size="small" value={annee} onChange={(_, v: number | null) => v && setAnnee(v)} aria-label="Année comparée">
            {[suivi - 1, suivi].map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: { xs: 48, md: 36 }, px: 2 }}>{a}</ToggleButton>)}
          </ToggleButtonGroup>
        )}
      </Stack>

      {absente ? (
        <Alert severity="info">Ce contrôle sera disponible quand la mise à jour 0028 de la base aura été passée.</Alert>
      ) : erreur ? (
        <Panne quoi="Les chiffres à comparer" recharger={recharger} />
      ) : chargement || !donnees || !synthese ? (
        <Skeleton variant="rounded" height={160} />
      ) : (
        <Stack spacing={2}>
          {message && <Alert severity={message.gravite} onClose={() => setMessage(null)}>{message.texte}</Alert>}

          {donnees.orphelins.length > 0 && (
            <Box component="section" aria-label="Magasins renommés">
              <Typography variant="h3" sx={{ mb: 1 }}>Noms de magasin inconnus de l’app réseau</Typography>
              <Stack spacing={1}>
                {donnees.orphelins.map((o) => (
                  <Stack key={o.magasin} direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      <strong>{o.magasin}</strong> : {o.lignes} ligne{o.lignes > 1 ? 's' : ''} dans le pilotage.
                      {o.nouveauNom ? ` Renommé ${o.nouveauNom} dans l’app réseau.` : ' Nom à vérifier dans la fiche magasin de l’app réseau.'}
                    </Typography>
                    {o.nouveauNom && (
                      <Button variant="contained" disabled={occupe} onClick={() => rattacher(o)} sx={{ minHeight: 48 }}>
                        Rattacher à {o.nouveauNom}
                      </Button>
                    )}
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {synthese.magasins.length === 0 ? (
            <EtatVide titre={`Rien à comparer en ${annee}`} texte="Ni la caisse ni l’app réseau n’ont de chiffres pour cette année. Choisis l’autre année ou importe le réel de la caisse." />
          ) : (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} aria-label="Bilan de la comparaison">
                <Chip color={synthese.manques ? 'error' : 'default'} label={`${synthese.manques} magasin${synthese.manques > 1 ? 's' : ''} avec des mois absents de la caisse`} />
                <Chip color={synthese.ecarts ? 'warning' : 'default'} label={`${synthese.ecarts} avec un écart de plus de 2 %`} />
                <Chip color="success" variant="outlined" label={`${synthese.concordants} concordant${synthese.concordants > 1 ? 's' : ''}`} />
              </Stack>
              <TableContainer>
                <Table size="small" aria-label={`CA de la caisse et de l’app réseau en ${annee}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Magasin</TableCell>
                      <TableCell>État</TableCell>
                      <TableCell align="right">Mois comparés</TableCell>
                      <TableCell align="right">CA caisse</TableCell>
                      <TableCell align="right">CA app réseau</TableCell>
                      <TableCell align="right">Écart</TableCell>
                      <TableCell>Plus gros écart</TableCell>
                      <TableCell>Absents de la caisse</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {synthese.magasins.map((m) => (
                      <TableRow key={m.magasin}>
                        <TableCell sx={{ fontWeight: 600 }}>{m.magasin}</TableCell>
                        <TableCell><Chip size="small" color={STATUTS[m.statut].couleur} label={STATUTS[m.statut].libelle} /></TableCell>
                        <TableCell align="right">{m.moisCommuns}</TableCell>
                        <TableCell align="right">{m.moisCommuns ? montant(m.caCaisse) : '—'}</TableCell>
                        <TableCell align="right">{m.moisCommuns ? montant(m.caReseau) : '—'}</TableCell>
                        <TableCell align="right">{m.ecart === null ? '—' : tauxCourt(m.ecart)}</TableCell>
                        <TableCell>{m.pireMois ? `${nomMois(m.pireMois.mois)} (${tauxCourt(m.pireMois.ecart)})` : '—'}</TableCell>
                        <TableCell>{m.moisReseauSeul.length ? m.moisReseauSeul.map(nomMois).join(', ') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      )}
    </Card>
  )
}
