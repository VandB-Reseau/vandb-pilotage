import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { enregistrerFrais } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { milliers, miseEnForme, montant, taux } from '../lib/format'
import type { LigneFraisMagasin } from '../moteur/atterrissage'
import { BLOCS_FRAIS, blocDe, LIGNES_SUR_CA, lignesFrais } from '../moteur/parametres'
import {
  ajouterLigne, INTERETS, LIBELLES_FINANCES, LIGNES_COURANTES, lignesDisponibles, lireSaisieFrais, saisieDepuisLignes, totauxFrais,
  type ChampFrais, type Mode, type SaisieFrais,
} from '../moteur/saisieFrais'

const bouton48 = { sx: { width: 48, height: 48 } }
const titreRubrique = { fontWeight: 700, bgcolor: 'action.hover' }

// Montant d'une ligne de frais : par an en euros, ou en part du CA
function ChampFraisLigne({ ligne, onChange }: { ligne: ChampFrais; onChange: (l: Partial<ChampFrais>) => void }) {
  return (
    <TextField
      size="small"
      value={ligne.valeur}
      error={Number.isNaN(nombre(ligne.valeur))}
      onChange={(e) => onChange({ valeur: e.target.value })}
      onBlur={() => { const f = miseEnForme(ligne.valeur, nombre); if (f !== ligne.valeur) onChange({ valeur: f }) }}
      slotProps={{
        htmlInput: { inputMode: 'decimal', 'aria-label': ligne.libelle, style: { textAlign: 'right' } },
        input: {
          endAdornment: (
            <InputAdornment position="end" sx={{ mr: -1 }}>
              <Select variant="standard" disableUnderline value={ligne.mode} onChange={(e) => onChange({ mode: e.target.value as Mode })}
                inputProps={{ 'aria-label': `Unité : ${ligne.libelle}` }}
                sx={{ fontSize: 'inherit', '& .MuiSelect-select': { minHeight: 48, display: 'flex', alignItems: 'center', py: 0, pr: '24px !important', pl: 0.5 }, '& .MuiSelect-nativeInput': { height: 48 } }}>
                <MenuItem value="annuel" sx={{ minHeight: 48 }}>€ par an</MenuItem>
                <MenuItem value="taux" sx={{ minHeight: 48 }}>% du CA</MenuItem>
              </Select>
            </InputAdornment>
          ),
        },
      }}
      sx={{ width: 230, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
    />
  )
}

// Frais annuels d'un magasin sur la grille du réseau, dans les blocs de l'onglet FFBUD avec leurs sous-totaux ;
// publicité franchise et royalties calculées sur le CA ; amortissements, intérêts et emprunts sous l'EBE
export function FraisMagasin({ magasin, lignes, annee, peutSaisir, apresEnregistrement, tauxSurCA }: {
  magasin: string
  lignes: LigneFraisMagasin[]
  annee: number
  peutSaisir: boolean
  apresEnregistrement: () => void
  tauxSurCA: { publicite: number; redevance: number }
}) {
  const [saisie, setSaisie] = useState<SaisieFrais>(() => saisieDepuisLignes(lignes))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string; details?: string[] } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [choix, setChoix] = useState<string | null>(null)
  // Après un enregistrement (ou un changement de magasin), la saisie repart des lignes enregistrées
  const empreinte = JSON.stringify(lignes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSaisie(saisieDepuisLignes(lignes)) }, [empreinte])

  const initiale = saisieDepuisLignes(lignes)
  const modifie = JSON.stringify(saisie) !== JSON.stringify(initiale)
  useSaisieEnCours(peutSaisir && modifie)
  const t = totauxFrais(saisie)
  const disponibles = lignesDisponibles(saisie)
  const changer = (code: string, l: Partial<ChampFrais>) => setSaisie((s) => ({ ...s, lignes: s.lignes.map((x) => (x.code === code ? { ...x, ...l } : x)) }))
  const valeurFinance = (k: keyof SaisieFrais['finances']) => nombre(saisie.finances[k]) ?? 0

  const enregistrer = async () => {
    const lu = lireSaisieFrais(saisie, lignes)
    if (lu.erreurs.length) { setMessage({ gravite: 'error', texte: 'Certains montants sont à corriger :', details: lu.erreurs }); return }
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerFrais(magasin, lu.lignes, lu.retirees)
      setMessage({ gravite: 'success', texte: 'Frais enregistrés.' })
      apresEnregistrement()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  const actions = peutSaisir && modifie && (
    <Box sx={{ position: 'sticky', bottom: 0, zIndex: 2, py: 1.5, bgcolor: 'background.default', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', borderTop: 1, borderColor: 'divider' }}>
      <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer les frais</Button>
      <Button disabled={occupe} onClick={() => { setSaisie(initiale); setMessage(null) }} sx={{ minHeight: 48 }}>Annuler les modifications</Button>
      <Typography variant="body2" color="text.secondary">Modifications non enregistrées</Typography>
    </Box>
  )
  const alerte = message && (
    <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>
      {message.texte}
      {message.details?.length ? <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>{message.details.map((x) => <li key={x}>{x}</li>)}</Box> : null}
    </Alert>
  )

  if (saisie.lignes.length === 0 && !Object.values(saisie.finances).some(Boolean) && !modifie) {
    return (
      <Stack spacing={3}>
        {alerte}
        <EtatVide
          titre="Pas encore de frais"
          texte={peutSaisir ? `Loyer, énergie, honoraires, assurances… les frais ${annee} du magasin, ligne par ligne.` : 'Les frais de ce magasin ne sont pas encore renseignés.'}
          action={peutSaisir ? (
            <Button variant="contained" startIcon={<PlaylistAddOutlined />} sx={{ minHeight: 48 }}
              onClick={() => setSaisie((s) => LIGNES_COURANTES.reduce(ajouterLigne, s))}>
              Partir des lignes courantes
            </Button>
          ) : undefined}
        />
      </Stack>
    )
  }

  const surCA = tauxSurCA.publicite + tauxSurCA.redevance
  const blocs = BLOCS_FRAIS.filter((x) => x.cle === 'charges_externes' || saisie.lignes.some((l) => blocDe(l) === x.cle))
  const interets = INTERETS.reduce((a, k) => a + valeurFinance(k), 0)
  const enMontant = (annuel: number, part: number) => `${montant(annuel)}${part ? ` + ${taux(part)} du CA` : ''}`
  const celluleVide = peutSaisir && <TableCell />
  const ligneSurCA = (k: keyof typeof LIGNES_SUR_CA) => (
    <TableRow key={`sur-ca-${k}`}>
      <TableCell sx={{ pl: 3 }}>{LIGNES_SUR_CA[k].libelle}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{taux(tauxSurCA[k])} du CA</TableCell>
      {celluleVide}
    </TableRow>
  )
  const ligneSaisie = (l: ChampFrais) => (
    <TableRow key={l.code}>
      <TableCell sx={{ pl: 3 }}>{l.libelle}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        {peutSaisir
          ? <ChampFraisLigne ligne={l} onChange={(x) => changer(l.code, x)} />
          : l.mode === 'taux' ? `${l.valeur} % du CA` : montant(nombre(l.valeur) ?? 0)}
      </TableCell>
      {peutSaisir && (
        <TableCell align="right" sx={{ width: 64 }}>
          <IconButton aria-label={`Retirer ${l.libelle}`} onClick={() => setSaisie((s) => ({ ...s, lignes: s.lignes.filter((x) => x.code !== l.code) }))} {...bouton48}>
            <DeleteOutlined />
          </IconButton>
        </TableCell>
      )}
    </TableRow>
  )
  const ligneFinance = (k: keyof SaisieFrais['finances']) => (
    <TableRow key={k}>
      <TableCell sx={{ pl: 3 }}>{LIBELLES_FINANCES[k]}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
        {peutSaisir
          ? <ChampNombre libelle={LIBELLES_FINANCES[k]} valeur={saisie.finances[k]} largeur={230} unite="€ par an" onChange={(v) => setSaisie((s) => ({ ...s, finances: { ...s.finances, [k]: v } }))} />
          : montant(valeurFinance(k))}
      </TableCell>
      {celluleVide}
    </TableRow>
  )
  const titre = (libelle: string, valeur?: string, cle = libelle) => (
    <TableRow key={cle}>
      <TableCell sx={titreRubrique}>{libelle}</TableCell>
      <TableCell align="right" sx={{ ...titreRubrique, whiteSpace: 'nowrap' }}>{valeur}</TableCell>
      {peutSaisir && <TableCell sx={titreRubrique} />}
    </TableRow>
  )
  const sousTotal = (libelle: string, valeur: string) => (
    <TableRow key={`total-${libelle}`}>
      <TableCell sx={{ fontWeight: 700 }}>{libelle}</TableCell>
      <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{valeur}</TableCell>
      {celluleVide}
    </TableRow>
  )
  return (
    <Stack spacing={3}>
      {alerte}
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Frais en chiffres">
        <Indicateur libelle={`Frais ${annee}`} valeur={milliers(t.annuel)} detail={`et ${taux(t.taux + surCA)} du CA`} />
        <Indicateur libelle="Emprunts" valeur={milliers(interets + valeurFinance('remboursementCapital'))} detail={`Intérêts et charges assimilées : ${milliers(interets)}`} />
        <Indicateur libelle="Amortissements" valeur={milliers(valeurFinance('amortissements'))} />
      </Stack>

      <Card component="section" aria-label="Frais par bloc">
        <TableContainer sx={{ maxHeight: 'none' }}>
          <Table className="colonne-fixe" aria-label={`Frais ${annee} par bloc`}>
            <TableBody>
              {blocs.map((x) => {
                const tot = t.parBloc[x.cle]
                const part = tot.taux + (x.cle === 'charges_externes' ? surCA : 0)
                const dans = saisie.lignes.filter((l) => blocDe(l) === x.cle)
                const corps = dans.flatMap((l) => [ligneSaisie(l)])
                if (x.cle === 'charges_externes') {
                  // Lignes calculées à leur place dans l'ordre de l'onglet FFBUD
                  for (const k of ['publicite', 'redevance'] as const) {
                    const rang = lignesFrais.findIndex((g) => g.code === LIGNES_SUR_CA[k].apres)
                    const i = dans.findIndex((l) => lignesFrais.findIndex((g) => g.code === l.code) > rang)
                    const pos = i < 0 ? corps.length : corps.findIndex((r) => r.key === dans[i].code)
                    corps.splice(pos, 0, ligneSurCA(k))
                  }
                }
                return [titre(x.libelle, undefined, x.cle), ...corps, sousTotal(x.total, enMontant(tot.annuel, part))]
              })}
              {titre('Sous l’excédent brut d’exploitation', undefined, 'hors-ebe')}
              {ligneFinance('amortissements')}
              {INTERETS.map(ligneFinance)}
              {sousTotal('Intérêts et charges assimilées', montant(interets))}
              {ligneFinance('remboursementCapital')}
              {sousTotal('Total des frais prévisionnels', enMontant(t.annuel + valeurFinance('amortissements') + interets, t.taux + surCA))}
            </TableBody>
          </Table>
        </TableContainer>
        {peutSaisir && disponibles.length > 0 && (
          <Box sx={{ p: 2 }}>
            <Autocomplete
              options={disponibles}
              value={null}
              inputValue={choix ?? ''}
              onInputChange={(_, v) => setChoix(v)}
              groupBy={(l) => BLOCS_FRAIS.find((x) => x.cle === l.bloc)!.libelle}
              getOptionLabel={(l) => l.libelle}
              onChange={(_, l) => { if (l) { setSaisie((s) => ajouterLigne(s, l.code)); setChoix('') } }}
              openText="Ouvrir la liste" closeText="Fermer la liste" clearText="Effacer" noOptionsText="Aucune ligne"
              slotProps={{ popupIndicator: bouton48, clearIndicator: bouton48, listbox: { sx: { '& li': { minHeight: 48 } } } }}
              sx={{ maxWidth: 420 }}
              renderInput={(p) => <TextField {...p} label="Ajouter une ligne" sx={{ '& .MuiInputBase-root': { py: 0 }, '& input': { height: 48, boxSizing: 'border-box' } }} />}
            />
          </Box>
        )}
      </Card>
      {actions}
    </Stack>
  )
}
