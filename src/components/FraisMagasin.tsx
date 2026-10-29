import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined'
import { BarreEnregistrement } from './BarreEnregistrement'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { RepriseFraisFEC } from './RepriseFraisFEC'
import { enregistrerFrais } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { nombreChangements } from '../lib/aFaire'
import { milliers, miseEnForme, montant, taux } from '../lib/format'
import { ebeApres, fraisDeLAnnee } from '../moteur/effets'
import type { LigneFraisMagasin } from '../moteur/atterrissage'
import { BLOCS_FRAIS, blocDe, LIGNES_SUR_CA, rubriqueLibelle, THEMES_FRAIS } from '../moteur/parametres'
import {
  ajouterLigne, INTERETS, LIBELLES_FINANCES, LIGNES_COURANTES, lignesDisponibles, lireSaisieFrais, saisieAvecFEC, saisieDepuisLignes, totauxFrais,
  type ChampFrais, type Mode, type SaisieFrais,
} from '../moteur/saisieFrais'


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
      sx={{ width: 190, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }}
    />
  )
}

// « + » d'un thème : les lignes de la grille du thème pas encore utilisées
function AjoutTheme({ theme, lignes, onAjouter }: { theme: string; lignes: { code: string; libelle: string }[]; onAjouter: (code: string) => void }) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton aria-label={`Ajouter une ligne : ${theme}`} onClick={(e) => setAncre(e.currentTarget)} sx={{ width: { xs: 48, md: 36 }, height: { xs: 48, md: 36 }, mr: -0.5 }}>
        <AddOutlined fontSize="small" />
      </IconButton>
      <Menu anchorEl={ancre} open={!!ancre} onClose={() => setAncre(null)}>
        {lignes.map((l) => <MenuItem key={l.code} onClick={() => { onAjouter(l.code); setAncre(null) }} sx={{ minHeight: 48 }}>{l.libelle}</MenuItem>)}
      </Menu>
    </>
  )
}

// Frais annuels d'un magasin sur la grille du réseau, dans les blocs de l'onglet FFBUD avec leurs sous-totaux ;
// publicité franchise et royalties calculées sur le CA ; amortissements, intérêts et emprunts sous l'EBE
export function FraisMagasin({ magasin, lignes, annee, peutSaisir, apresEnregistrement, tauxSurCA, budget }: {
  magasin: string
  lignes: LigneFraisMagasin[]
  annee: number
  peutSaisir: boolean
  apresEnregistrement: () => void
  tauxSurCA: { publicite: number; redevance: number }
  budget?: { annee: number; ca: number; ebe: number }  // budget du magasin, pour l'effet de la saisie sur l'EBE (lot 28)
}) {
  const [saisie, setSaisie] = useState<SaisieFrais>(() => saisieDepuisLignes(lignes))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string; details?: string[] } | null>(null)
  const [occupe, setOccupe] = useState(false)
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

  // Barre d'enregistrement du budget (lot 28) : frais au-dessus de l'EBE, l'EBE du budget bouge d'autant
  const t0 = totauxFrais(initiale)
  const avant = budget ? fraisDeLAnnee(t0, budget.ca) : 0, apres = budget ? fraisDeLAnnee(t, budget.ca) : 0
  const actions = peutSaisir && modifie && (
    <BarreEnregistrement
      changements={nombreChangements(initiale, saisie)} occupe={occupe} libelle="Enregistrer les frais"
      onAnnuler={() => { setSaisie(initiale); setMessage(null) }} onEnregistrer={() => void enregistrer()}
      effets={budget ? [
        { libelle: `Frais ${budget.annee}`, avant: milliers(avant), apres: milliers(apres) },
        { libelle: `EBE ${budget.annee}`, avant: milliers(budget.ebe), apres: milliers(ebeApres(budget.ebe, avant, apres)) },
      ] : [{ libelle: `Frais ${annee}`, avant: milliers(t0.annuel), apres: milliers(t.annuel) }]}
    />
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
        {peutSaisir && <RepriseFraisFEC onReprendre={(f, c) => setSaisie((s) => saisieAvecFEC(s, f, c))} />}
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
  const interets = INTERETS.reduce((a, k) => a + valeurFinance(k), 0)
  const enMontant = (annuel: number, part: number) => `${montant(annuel)}${part ? ` + ${taux(part)} du CA` : ''}`
  const enTexteLigne = (l: ChampFrais) => (l.mode === 'taux' ? `${l.valeur} % du CA` : montant(nombre(l.valeur) ?? 0))
  const cellule = { py: 0.5, px: 1.5, borderBottom: 0 }
  const ligneTexte = (cle: string, libelle: string, valeur: string) => (
    <TableRow key={cle}>
      <TableCell sx={cellule}>{libelle}</TableCell>
      <TableCell align="right" sx={{ ...cellule, whiteSpace: 'nowrap', color: 'text.secondary' }}>{valeur}</TableCell>
      {peutSaisir && <TableCell sx={{ ...cellule, width: 48 }} />}
    </TableRow>
  )
  const ligneSaisie = (l: ChampFrais) => (
    <TableRow key={l.code}>
      <TableCell sx={cellule}>{l.libelle}</TableCell>
      <TableCell align="right" sx={{ ...cellule, whiteSpace: 'nowrap' }}>
        {peutSaisir ? <ChampFraisLigne ligne={l} onChange={(x) => changer(l.code, x)} /> : enTexteLigne(l)}
      </TableCell>
      {peutSaisir && (
        <TableCell align="right" sx={{ ...cellule, width: 48, pl: 0 }}>
          <IconButton aria-label={`Retirer ${l.libelle}`} onClick={() => setSaisie((s) => ({ ...s, lignes: s.lignes.filter((x) => x.code !== l.code) }))}
            sx={{ width: { xs: 48, md: 36 }, height: { xs: 48, md: 36 } }}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </TableCell>
      )}
    </TableRow>
  )
  const ligneFinance = (k: keyof SaisieFrais['finances']) => peutSaisir ? (
    <TableRow key={k}>
      <TableCell sx={cellule}>{LIBELLES_FINANCES[k]}</TableCell>
      <TableCell align="right" sx={{ ...cellule, whiteSpace: 'nowrap' }}>
        <ChampNombre libelle={LIBELLES_FINANCES[k]} valeur={saisie.finances[k]} largeur={190} unite="€ par an" onChange={(v) => setSaisie((s) => ({ ...s, finances: { ...s.finances, [k]: v } }))} />
      </TableCell>
      <TableCell sx={{ ...cellule, width: 48 }} />
    </TableRow>
  ) : ligneTexte(k, LIBELLES_FINANCES[k], montant(valeurFinance(k)))
  // Un encart par thème de frais (29/10/2026, Joseph) : plusieurs côte à côte, total du thème en tête
  // Encarts en colonnes (sans trou entre eux, 29/10/2026) ; « + » dans chaque thème pour y ajouter une ligne de la grille
  const encart = (cle: string, libelle: string, total: string, lignesEncart: React.ReactNode[], ajout?: React.ReactNode) => (
    <Card key={cle} component="section" aria-label={libelle} sx={{ breakInside: 'avoid', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 0.75, pb: lignesEncart.length ? 0.25 : 0.75, minHeight: 48 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.9375rem', flex: 1 }}>{libelle}</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{total}</Typography>
        {ajout}
      </Box>
      {lignesEncart.length > 0 && <Table size="small" aria-label={`Frais : ${libelle}`} sx={{ mb: 0.75 }}><TableBody>{lignesEncart}</TableBody></Table>}
    </Card>
  )
  const themes = THEMES_FRAIS.map((r) => ({ r, dans: saisie.lignes.filter((l) => l.rubrique === r), libres: disponibles.filter((l) => l.rubrique === r) }))
    .filter((x) => x.dans.length || (peutSaisir && x.libres.length))
  const totalTheme = (dans: ChampFrais[]) => {
    const x = totauxFrais({ ...saisie, lignes: dans })
    return enMontant(x.annuel, x.taux)
  }
  const ligneTotal = (libelle: string, valeur: string, fort = false) => (
    <TableRow key={libelle}>
      <TableCell sx={{ ...cellule, fontWeight: fort ? 700 : 400 }}>{libelle}</TableCell>
      <TableCell align="right" sx={{ ...cellule, fontWeight: fort ? 700 : 400, whiteSpace: 'nowrap' }}>{valeur}</TableCell>
    </TableRow>
  )
  return (
    <Stack spacing={3}>
      {alerte}
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Frais en chiffres">
        <Indicateur libelle={`Frais ${annee}`} aide="fraisAnnee" valeur={milliers(t.annuel)} detail={`et ${taux(t.taux + surCA)} du CA`} />
        <Indicateur libelle="Emprunts" aide="empruntsTreso" valeur={milliers(interets + valeurFinance('remboursementCapital'))} detail={`Intérêts et charges assimilées : ${milliers(interets)}`} />
        <Indicateur libelle="Amortissements" aide="amortissements" valeur={milliers(valeurFinance('amortissements'))} />
      </Stack>

      <Box component="section" aria-label="Frais par thème" sx={{ columnCount: { xs: 1, md: 2, xl: 3 }, columnGap: 2, mb: -2 }}>
        {themes.map(({ r, dans, libres }) => encart(r, rubriqueLibelle[r], dans.length ? totalTheme(dans) : '', dans.map(ligneSaisie),
          peutSaisir && libres.length > 0 && <AjoutTheme theme={rubriqueLibelle[r]} lignes={libres} onAjouter={(code) => setSaisie((s) => ajouterLigne(s, code))} />))}
        {encart('reseau', 'Redevances du réseau', `${taux(surCA)} du CA`, (['publicite', 'redevance'] as const).map((k) => ligneTexte(k, LIGNES_SUR_CA[k].libelle, `${taux(tauxSurCA[k])} du CA`)))}
        {encart('hors-ebe', 'Sous l’excédent brut d’exploitation', montant(valeurFinance('amortissements') + interets),
          [ligneFinance('amortissements'), ...INTERETS.map(ligneFinance), ligneFinance('remboursementCapital')])}
        <Card component="section" aria-label="Totaux" sx={{ breakInside: 'avoid', mb: 2 }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.9375rem', px: 1.5, pt: 1.25, pb: 0.5 }}>Totaux</Typography>
          <Table size="small" aria-label={`Frais ${annee} par bloc`} sx={{ mb: 0.75 }}>
            <TableBody>
              {BLOCS_FRAIS.filter((x) => x.cle === 'charges_externes' || saisie.lignes.some((l) => blocDe(l) === x.cle)).map((x) =>
                ligneTotal(x.total, enMontant(t.parBloc[x.cle].annuel, t.parBloc[x.cle].taux + (x.cle === 'charges_externes' ? surCA : 0))))}
              {ligneTotal('Intérêts et charges assimilées', montant(interets))}
              {ligneTotal('Total des frais prévisionnels', enMontant(t.annuel + valeurFinance('amortissements') + interets, t.taux + surCA), true)}
            </TableBody>
          </Table>
        </Card>
      </Box>
      {peutSaisir && <RepriseFraisFEC onReprendre={(f, c) => setSaisie((s) => saisieAvecFEC(s, f, c))} />}
      {actions}
    </Stack>
  )
}
