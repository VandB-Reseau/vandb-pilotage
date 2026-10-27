import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from '../components/ChampNombre'
import { ChampTaux } from '../components/ChampTaux'
import { Panne } from '../components/Panne'
import { anneeBudget, chargerParametres, enregistrerParametres, type ParametresCharges } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { CATEGORIES, categorieLibelle } from '../moteur/equipe'
import { useChargement } from '../data/useChargement'
import { montant, taux } from '../lib/format'

export function Parametres() {
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerParametres(annee), [annee])
  const p = donnees?.parametres
  const [charges, setCharges] = useState<ParametresCharges | null>(null)
  const [smic, setSmic] = useState('')
  const [puissance, setPuissance] = useState('')
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (!p) return
    setCharges(p.charges)
    setSmic(String(p.charges.reduction.smicAnnuel).replace('.', ','))
    setPuissance(String(p.charges.reduction.puissance).replace('.', ','))
  }, [p])
  const taux_ = (k: keyof ParametresCharges['taux'], v: number | undefined) => setCharges((c) => (c ? { ...c, taux: { ...c.taux, [k]: v ?? 0 } } : c))
  const reduction = (k: keyof ParametresCharges['reduction'], v: number | undefined) => setCharges((c) => (c ? { ...c, reduction: { ...c.reduction, [k]: v ?? 0 } } : c))
  const smicLu = nombre(smic), puissanceLue = nombre(puissance)
  const valides = smicLu !== null && !Number.isNaN(smicLu) && smicLu > 0 && puissanceLue !== null && !Number.isNaN(puissanceLue) && puissanceLue > 0
  const enregistrer = async () => {
    if (!p || !charges || !valides) return
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerParametres(annee, { ...p, charges: { ...charges, reduction: { ...charges.reduction, smicAnnuel: smicLu!, puissance: puissanceLue! } } })
      setMessage({ gravite: 'success', texte: `Charges sociales ${annee} enregistrées.` })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const lignes = p ? [
    { libelle: 'Redevance franchise', valeur: `${taux(p.tauxRedevance)} du CA HT` },
    { libelle: 'Publicité franchise', valeur: `${taux(p.tauxPublicite)} du CA HT` },
    { libelle: 'Impôt sur les sociétés, taux réduit', valeur: `${taux(p.impot.tauxReduit)} jusqu’à ${montant(p.impot.plafondTauxReduit)} de bénéfice` },
    { libelle: 'Impôt sur les sociétés, taux normal', valeur: taux(p.impot.tauxNormal) },
    { libelle: 'TVA moyenne du panier Cave', valeur: taux(p.tvaPanier.cave) },
    { libelle: 'TVA moyenne du panier Bar', valeur: taux(p.tvaPanier.bar) },
  ] : []

  return (
    <Box>
      <Typography variant="h1">Paramètres réseau</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Année {annee}{donnees && !donnees.enregistres ? ' · valeurs par défaut, pas encore enregistrées' : ''}
      </Typography>
      {erreur && <Panne quoi="Les paramètres" recharger={recharger} />}
      {chargement && <Skeleton variant="rounded" height={240} />}
      {p && (
        <Stack spacing={3}>
        <Card>
          <Table aria-label={`Paramètres réseau ${annee}`}>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.libelle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{l.valeur}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {charges && (
          <Card component="section" aria-label="Charges sociales">
            <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h2">Charges sociales {annee}</Typography>
              <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !valides} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
            </Box>
            {message && <Box sx={{ px: 2 }}><Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>}
            <Table aria-label={`Charges sociales ${annee}`}>
              <TableBody>
                {CATEGORIES.map((c) => (
                  <TableRow key={c}>
                    <TableCell>Charges patronales : {categorieLibelle[c]}</TableCell>
                    <TableCell align="right"><ChampTaux libelle={`Charges patronales : ${categorieLibelle[c]}`} valeur={charges.taux[c]} onChange={(v) => taux_(c, v)} /></TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Réduction générale : SMIC annuel brut (35 heures)</TableCell>
                  <TableCell align="right"><ChampNombre libelle="SMIC annuel brut" valeur={smic} onChange={setSmic} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : taux minimal</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Réduction générale : taux minimal" valeur={charges.reduction.tmin} onChange={(v) => reduction('tmin', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : taux dégressif</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Réduction générale : taux dégressif" valeur={charges.reduction.tdelta} onChange={(v) => reduction('tdelta', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : puissance</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Réduction générale : puissance" valeur={puissance} unite="" largeur={120} onChange={setPuissance} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Part des charges hors réduction (formation, taxe d’apprentissage)</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Part des charges hors réduction" valeur={charges.reduction.horsReduction} onChange={(v) => reduction('horsReduction', v)} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        )}
        </Stack>
      )}
    </Box>
  )
}
