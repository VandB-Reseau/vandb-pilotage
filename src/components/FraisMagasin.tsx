import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
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
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined'
import { BarreEnregistrement } from './BarreEnregistrement'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { RepriseFraisFEC } from './RepriseFraisFEC'
import { enregistrerFrais } from '../data/pilotage'
import { styleTableau } from '../theme/tableau'
import { nombre } from '../import/caisse'
import { nombreChangements } from '../lib/aFaire'
import { milliers, miseEnForme, montant, taux } from '../lib/format'
import { ebeApres, fraisDeLAnnee } from '../moteur/effets'
import type { LigneFraisMagasin } from '../moteur/atterrissage'
import type { PretsAnnee } from '../moteur/financement'
import { BLOCS_FRAIS, blocDe, LIGNES_SUR_CA, lignesCourantes, lignesFrais, rubriqueLibelle, THEMES_FRAIS, type LigneGrille } from '../moteur/parametres'
import {
  ajouterLigne, INTERETS, LIBELLES_FINANCES, lignesDisponibles, lireSaisieFrais, saisieAvecFEC, saisieDepuisLignes, totauxFrais,
  type ChampFrais, type Mode, type SaisieFrais,
} from '../moteur/saisieFrais'

const visuellementCache = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

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
export function FraisMagasin({ magasin, lignes, annee, peutSaisir, apresEnregistrement, tauxSurCA, budget, grille = lignesFrais, prets }: {
  magasin: string
  lignes: LigneFraisMagasin[]
  annee: number
  peutSaisir: boolean
  apresEnregistrement: () => void
  tauxSurCA: { publicite: number; redevance: number }
  budget?: { annee: number; ca: number; ebe: number }  // budget du magasin, pour l'effet de la saisie sur l'EBE (lot 28)
  grille?: LigneGrille[]  // grille des frais de l'année (lot 40)
  prets?: PretsAnnee | null  // prêts saisis (03/11/2026) : intérêts d'emprunts et capital de l'année en sont tirés
}) {
  const [saisie, setSaisie] = useState<SaisieFrais>(() => saisieDepuisLignes(lignes, grille))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string; details?: string[] } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [replies, setReplies] = useState<Set<string>>(new Set())
  const basculer = (cle: string) => setReplies((o) => { const n = new Set(o); if (n.has(cle)) n.delete(cle); else n.add(cle); return n })
  // Après un enregistrement (ou un changement de magasin), la saisie repart des lignes enregistrées
  const empreinte = JSON.stringify(lignes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSaisie(saisieDepuisLignes(lignes, grille)) }, [empreinte])

  const initiale = saisieDepuisLignes(lignes, grille)
  const modifie = JSON.stringify(saisie) !== JSON.stringify(initiale)
  useSaisieEnCours(peutSaisir && modifie)
  const t = totauxFrais(saisie, grille)
  const disponibles = lignesDisponibles(saisie, grille)
  const changer = (code: string, l: Partial<ChampFrais>) => setSaisie((s) => ({ ...s, lignes: s.lignes.map((x) => (x.code === code ? { ...x, ...l } : x)) }))
  // Avec des prêts saisis, les intérêts d'emprunts et le capital viennent de leur échéancier, en lecture seule
  const depuisPrets = (k: keyof SaisieFrais['finances']) => !!prets && (k === 'interets' || k === 'remboursementCapital')
  const valeurFinance = (k: keyof SaisieFrais['finances']) => !prets ? nombre(saisie.finances[k]) ?? 0
    : k === 'interets' ? prets.enCours.interets + prets.nouveaux.interets
    : k === 'remboursementCapital' ? prets.enCours.capital + prets.nouveaux.capital
    : nombre(saisie.finances[k]) ?? 0

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
  const t0 = totauxFrais(initiale, grille)
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
        {peutSaisir && <RepriseFraisFEC onReprendre={(f, c) => setSaisie((s) => saisieAvecFEC(s, f, c, grille))} grille={grille} />}
        <EtatVide
          titre="Pas encore de frais"
          texte={peutSaisir ? `Loyer, énergie, honoraires, assurances… les frais ${annee} du magasin, ligne par ligne.` : 'Les frais de ce magasin ne sont pas encore renseignés.'}
          action={peutSaisir ? (
            <Button variant="contained" startIcon={<PlaylistAddOutlined />} sx={{ minHeight: 48 }}
              onClick={() => setSaisie((s) => lignesCourantes(grille).reduce((x, code) => ajouterLigne(x, code, grille), s))}>
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
  const colonnes = peutSaisir ? 3 : 2
  const ligneTexte = (cle: string, libelle: string, valeur: string) => (
    <TableRow key={cle}>
      <TableCell sx={{ pl: '40px !important' }}>{libelle}</TableCell>
      <TableCell align="right" sx={{ color: 'text.secondary' }}>{valeur}</TableCell>
      {peutSaisir && <TableCell />}
    </TableRow>
  )
  const ligneSaisie = (l: ChampFrais) => (
    <TableRow key={l.code}>
      <TableCell sx={{ pl: '40px !important' }}>{l.libelle}</TableCell>
      <TableCell align="right" sx={{ py: '2px !important' }}>
        {peutSaisir ? <ChampFraisLigne ligne={l} onChange={(x) => changer(l.code, x)} /> : enTexteLigne(l)}
      </TableCell>
      {peutSaisir && (
        <TableCell align="right" sx={{ width: 48, py: '0 !important' }}>
          <IconButton aria-label={`Retirer ${l.libelle}`} onClick={() => setSaisie((s) => ({ ...s, lignes: s.lignes.filter((x) => x.code !== l.code) }))}
            sx={{ width: { xs: 48, md: 36 }, height: { xs: 48, md: 36 } }}>
            <DeleteOutlined fontSize="small" />
          </IconButton>
        </TableCell>
      )}
    </TableRow>
  )
  const ligneFinance = (k: keyof SaisieFrais['finances']) => depuisPrets(k) ? (
    <TableRow key={k}>
      <TableCell sx={{ pl: '40px !important', whiteSpace: 'normal' }}>
        <Box component="span" sx={{ display: 'block' }}>{LIBELLES_FINANCES[k]}</Box>
        <Box component="span" sx={{ display: 'block', fontSize: '0.8125rem', color: 'text.secondary' }}>Calculé depuis les prêts du magasin</Box>
      </TableCell>
      <TableCell align="right" sx={{ color: 'text.secondary' }}>{montant(valeurFinance(k))}</TableCell>
      {peutSaisir && <TableCell />}
    </TableRow>
  ) : peutSaisir ? (
    <TableRow key={k}>
      <TableCell sx={{ pl: '40px !important' }}>{LIBELLES_FINANCES[k]}</TableCell>
      <TableCell align="right" sx={{ py: '2px !important' }}>
        <ChampNombre libelle={LIBELLES_FINANCES[k]} valeur={saisie.finances[k]} largeur={190} unite="€ par an" onChange={(v) => setSaisie((s) => ({ ...s, finances: { ...s.finances, [k]: v } }))} />
      </TableCell>
      <TableCell />
    </TableRow>
  ) : ligneTexte(k, LIBELLES_FINANCES[k], montant(valeurFinance(k)))
  // Lot 35 (Joseph, 02/11/2026 : encarts « moches ») : un seul tableau, un groupe repliable par thème avec son sous-total
  // et son « + », dans l'ordre des thèmes ; le même classement que le compte de résultat
  const groupe = (cle: string, libelle: string, total: string, lignesGroupe: React.ReactNode[], ajout?: React.ReactNode) => {
    const replie = replies.has(cle)
    return (
      <TableBody key={cle} aria-label={libelle}>
        {/* Thème encore vide : en retrait, seulement là pour son « + » */}
        <TableRow sx={lignesGroupe.length ? { bgcolor: 'background.default' } : undefined}>
          <TableCell sx={lignesGroupe.length ? { fontWeight: 700 } : { color: 'text.secondary' }}>
            <ButtonBase onClick={() => basculer(cle)} aria-expanded={!replie} aria-label={`${libelle} : ${replie ? 'détailler' : 'replier'}`}
              sx={{ font: 'inherit', gap: 0.5, ml: -0.75, px: 0.5, borderRadius: 1, minHeight: { xs: 48, md: 32 }, '&:hover': { bgcolor: 'action.hover' } }}>
              <ChevronRightOutlined sx={{ fontSize: 18, transform: replie ? 'none' : 'rotate(90deg)', color: 'text.secondary' }} />
              {libelle}
            </ButtonBase>
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 700 }}>{total}</TableCell>
          {peutSaisir && <TableCell align="right" sx={{ width: 48, py: '0 !important' }}>{ajout}</TableCell>}
        </TableRow>
        {!replie && lignesGroupe}
      </TableBody>
    )
  }
  const themes = THEMES_FRAIS.map((r) => ({ r, dans: saisie.lignes.filter((l) => l.rubrique === r), libres: disponibles.filter((l) => l.rubrique === r) }))
    .filter((x) => x.dans.length || (peutSaisir && x.libres.length))
  const totalTheme = (dans: ChampFrais[]) => {
    const x = totauxFrais({ ...saisie, lignes: dans }, grille)
    return dans.length ? enMontant(x.annuel, x.taux) : ''
  }
  const ligneTotal = (libelle: string, valeur: string, fort = false) => (
    <TableRow key={libelle}>
      <TableCell sx={{ fontWeight: fort ? 700 : 400 }}>{libelle}</TableCell>
      <TableCell align="right" sx={{ fontWeight: fort ? 700 : 400 }}>{valeur}</TableCell>
      {peutSaisir && <TableCell />}
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

      <Card component="section" aria-label="Frais par thème">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Frais {annee}</Typography>
          <Button size="small" onClick={() => setReplies(replies.size ? new Set() : new Set([...themes.map((x) => x.r), 'reseau', 'hors-ebe']))} sx={{ minHeight: { xs: 48, md: 36 } }}>
            {replies.size ? 'Tout détailler' : 'Tout replier'}
          </Button>
        </Box>
        <TableContainer>
          <Table size="small" aria-label={`Frais ${annee} par thème`} sx={{ ...styleTableau, '& td, & th': { ...styleTableau['& td, & th'], fontSize: '0.875rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Ligne</TableCell>
                <TableCell align="right">Montant {annee}</TableCell>
                {peutSaisir && <TableCell align="right"><Box component="span" sx={visuellementCache}>Actions</Box></TableCell>}
              </TableRow>
            </TableHead>
            {themes.map(({ r, dans, libres }) => groupe(r, rubriqueLibelle[r], totalTheme(dans), dans.map(ligneSaisie),
              libres.length > 0 && <AjoutTheme theme={rubriqueLibelle[r]} lignes={libres} onAjouter={(code) => { setReplies((x) => { const n = new Set(x); n.delete(r); return n }); setSaisie((s) => ajouterLigne(s, code, grille)) }} />))}
            {groupe('reseau', 'Redevances du réseau', `${taux(surCA)} du CA`, (['publicite', 'redevance'] as const).map((k) => ligneTexte(k, LIGNES_SUR_CA[k].libelle, `${taux(tauxSurCA[k])} du CA`)))}
            {groupe('hors-ebe', 'Sous l’excédent brut d’exploitation', montant(valeurFinance('amortissements') + interets),
              [ligneFinance('amortissements'), ...INTERETS.map(ligneFinance), ligneFinance('remboursementCapital')])}
            <TableBody aria-label="Totaux">
              <TableRow><TableCell colSpan={colonnes} sx={{ pt: '12px !important', fontWeight: 700 }}>Totaux</TableCell></TableRow>
              {BLOCS_FRAIS.filter((x) => x.cle === 'charges_externes' || saisie.lignes.some((l) => blocDe(l, grille) === x.cle)).map((x) =>
                ligneTotal(x.total, enMontant(t.parBloc[x.cle].annuel, t.parBloc[x.cle].taux + (x.cle === 'charges_externes' ? surCA : 0))))}
              {ligneTotal('Intérêts et charges assimilées', montant(interets))}
              {ligneTotal('Total des frais prévisionnels', enMontant(t.annuel + valeurFinance('amortissements') + interets, t.taux + surCA), true)}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      {peutSaisir && <RepriseFraisFEC onReprendre={(f, c) => setSaisie((s) => saisieAvecFEC(s, f, c, grille))} grille={grille} />}
      {actions}
    </Stack>
  )
}
