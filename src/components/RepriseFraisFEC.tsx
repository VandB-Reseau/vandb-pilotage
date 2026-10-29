import { useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import { lireFEC, texteDuFEC } from '../import/fec'
import { montant } from '../lib/format'
import { fraisDepuisFEC, type FinanceFEC, type FraisFEC } from '../moteur/fec'
import { LIBELLES_FINANCES } from '../moteur/saisieFrais'
import { Aide } from './Aide'

// Lot 33 : frais repris du FEC du comptable, ramenés à l'année. Rien ne part en base : les lignes cochées remplissent la
// saisie, qui s'enregistre comme d'habitude.
export function RepriseFraisFEC({ onReprendre }: { onReprendre: (f: FraisFEC, choisis: string[]) => void }) {
  const entree = useRef<HTMLInputElement>(null)
  const [f, setF] = useState<FraisFEC | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [choisis, setChoisis] = useState<string[]>([])

  const lire = async (fichier: File) => {
    setErreur(null)
    try {
      const l = lireFEC(texteDuFEC(await fichier.arrayBuffer()))
      const r = fraisDepuisFEC(l.ecritures)
      if (!l.ecritures.length || (!r.lignes.length && !Object.keys(r.finances).length)) {
        setErreur('Aucun frais trouvé dans ce fichier. Demande au cabinet l’export FEC du magasin (colonnes CompteNum, EcritureDate, Debit et Credit).')
        return
      }
      setF(r)
      setChoisis([...r.lignes.filter((x) => x.annuel > 0).map((x) => x.code), ...Object.keys(r.finances)])
    } catch {
      setErreur('Ce fichier n’a pas pu être lu. Demande au cabinet l’export FEC du magasin.')
    }
  }
  const basculer = (code: string) => setChoisis((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]))
  const coche = (code: string, libelle: string, valeur: number, comptes?: string[]) => (
    <FormControlLabel key={code} sx={{ m: 0, minHeight: 48, width: '100%', '& .MuiFormControlLabel-label': { flex: 1, display: 'flex', gap: 1 } }}
      control={<Checkbox checked={choisis.includes(code)} onChange={() => basculer(code)} disabled={valeur <= 0} sx={{ p: '12px' }} />}
      label={<>
        <Box component="span" sx={{ flex: 1 }}>{libelle}{comptes ? <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem', ml: 1 }}>{comptes.join(', ')}</Box> : null}</Box>
        <Box component="span" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{montant(valeur)}</Box>
      </>} />
  )

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Button variant="outlined" startIcon={<UploadFileOutlined />} onClick={() => entree.current?.click()} sx={{ minHeight: 48 }}>Reprendre les frais du FEC</Button>
        <Aide sujet="fraisFEC" />
        <input ref={entree} type="file" accept=".txt,.csv,.fec,text/plain" hidden aria-label="FEC pour les frais"
          onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) void lire(x) }} />
      </Box>
      {erreur && <Alert severity="warning" onClose={() => setErreur(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{erreur}</Alert>}
      {f && (
        <Card component="section" aria-label="Frais repris du FEC" sx={{ p: 2 }}>
          <Typography variant="h3" sx={{ fontSize: '1rem', mb: 0.5 }}>Frais trouvés dans le FEC</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {f.mois === 12 ? 'Fichier de 12 mois : montants de l’année.' : `Fichier de ${f.mois} mois : montants ramenés à l’année (× 12 ÷ ${f.mois}).`} Les lignes cochées remplacent celles de la saisie.
          </Typography>
          <Box sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            {f.lignes.map((l) => coche(l.code, l.libelle, l.annuel, l.comptes))}
            {(Object.entries(f.finances) as [FinanceFEC, number][]).map(([k, v]) => coche(k, LIBELLES_FINANCES[k], v))}
          </Box>
          {f.aRanger.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1.5 }}>
              À ranger à la main : {f.aRanger.map((x) => `${x.compte} ${x.libelle} (${montant(x.annuel)})`).join(' ; ')}.
            </Typography>
          )}
          <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap' }} useFlexGap>
            <Button variant="contained" disabled={!choisis.length} onClick={() => { onReprendre(f, choisis); setF(null) }} sx={{ minHeight: 48 }}>
              Reprendre les lignes cochées ({choisis.length})
            </Button>
            <Button onClick={() => setF(null)} sx={{ minHeight: 48 }}>Fermer sans reprendre</Button>
          </Stack>
        </Card>
      )}
    </>
  )
}
