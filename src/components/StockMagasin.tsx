import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { GraphiqueMois } from './GraphiqueMois'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { atterrissageDe, chargerBudgets, chargerParametres, chargerReel, chargerSecours, chargerStocks, enregistrerStock, hypothesesDe, parametresDuBudget } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { nombre } from '../import/caisse'
import { enChiffres, ecartMontant, milliers, montant, MOIS, MOIS_LONGS } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { coutVentesDe, stockComplete, stockParDefaut, suiviStock, type EtatStock, type StockSaisi } from '../moteur/stock'
import { Aide } from './Aide'
import { brand } from '../theme/theme'
import { styleTableau } from '../theme/tableau'

const ETAT: Record<EtatStock, { libelle: string; couleur: string; puce: 'error' | 'success' | 'warning' }> = {
  bas: { libelle: 'Sous la cible', couleur: 'var(--mui-palette-error-main)', puce: 'error' },
  ok: { libelle: 'Dans la cible', couleur: brand.vert, puce: 'success' },
  haut: { libelle: 'Au-dessus', couleur: brand.or, puce: 'warning' },
}
const unMois = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const enMois = (v: number) => `${unMois.format(v)} mois`
const reglageMois = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

// Valeur du stock en fin de mois face à sa cible (Joseph, 03/11/2026) : barres du stock saisi, fourchette visée et ligne
// de la cible (rendu A), tableau mois par mois dessous. La cible vient du moteur (src/moteur/stock.ts) : achats des ventes
// à venir de l'année (réalisé puis projeté) prolongée par le budget de l'année suivante s'il existe.
export function StockMagasin({ magasin, annee, peutSaisir }: { magasin: string; annee: number; peutSaisir: boolean }) {
  const theme = useTheme()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([
      chargerParametres(annee), chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee).catch(() => undefined),
      chargerStocks(magasin, annee), chargerBudgets(annee + 1).catch(() => null), chargerParametres(annee + 1).catch(() => null),
      chargerStocks(magasin, annee - 1).catch(() => null),
    ]).then(([p, reel, reelN1, secours, stocks, budgetsSuivants, pSuivants, stocksN1]) => ({ parametres: p.parametres, reel, reelN1, secours, stocks, budgetsSuivants, pSuivants, decembre: stocksN1?.[11] ?? null })),
    [magasin, annee])
  const [mois, setMois] = useState<number | null>(null)
  const [champs, setChamps] = useState({ cave: '', bar: '' })
  const [initial, setInitial] = useState('')
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const panneau = useRef<HTMLElement>(null)
  useEffect(() => { if (mois !== null) panneau.current?.scrollIntoView?.({ block: 'start' }) }, [mois])
  useSaisieEnCours(mois !== null && JSON.stringify(champs) !== initial)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi={`Le stock ${annee}`} recharger={recharger} />

  // Réglage le plus récent : celui de l'année suivante (campagne des budgets) s'il est enregistré, sinon celui de l'année
  const parametresStock = (donnees.pSuivants?.enregistres ? donnees.pSuivants.parametres : donnees.parametres).tresorerie.stock ?? stockParDefaut
  const atterri = donnees.reel.lignes.length ? atterrissageDe({ n: donnees.reel, n1: donnees.reelN1 }, annee, undefined, undefined, donnees.parametres, donnees.secours) : null
  const ligneSuivante = donnees.budgetsSuivants?.magasins.find((l) => l.magasin === magasin)
  const hSuivante = ligneSuivante?.statut && donnees.budgetsSuivants ? hypothesesDe(ligneSuivante, donnees.budgetsSuivants) : null
  const budgetSuivant = hSuivante && donnees.pSuivants ? calculerBudget(hSuivante.hypotheses, parametresDuBudget(ligneSuivante, donnees.pSuivants.parametres)) : null
  const saisies = donnees.stocks

  const ouvrir = (m: number) => {
    const s = saisies[m - 1]
    const depart = { cave: s?.cave != null ? enChiffres(s.cave) : '', bar: s?.bar != null ? enChiffres(s.bar) : '' }
    setMois(m)
    setChamps(depart)
    setInitial(JSON.stringify(depart))
    setErreurSaisie(null)
  }
  const dernierSaisi = saisies.reduce((d, s, i) => (s ? i + 1 : d), 0)
  const boutonSaisie = peutSaisir && (
    <Button variant={dernierSaisi ? 'outlined' : 'contained'} startIcon={<Inventory2Outlined />} sx={{ minHeight: 48 }} onClick={() => ouvrir(Math.min(12, dernierSaisi + 1))}>
      Saisir le stock d’un mois
    </Button>
  )
  const enregistrer = async () => {
    if (mois === null) return
    const lire = (t: string) => (t.trim() === '' ? null : nombre(t))
    const s: StockSaisi = { cave: lire(champs.cave), bar: lire(champs.bar) }
    if ((champs.cave.trim() && s.cave === null) || (champs.bar.trim() && s.bar === null) || (s.cave ?? 0) < 0 || (s.bar ?? 0) < 0) {
      setErreurSaisie('Saisis des montants en euros, sans signe moins (par exemple 85 000).')
      return
    }
    setOccupe(true)
    try {
      await enregistrerStock(magasin, annee, mois, s)
      setMessage(s.cave === null && s.bar === null ? `Stock de fin ${MOIS_LONGS[mois - 1]} ${annee} effacé.` : `Stock de fin ${MOIS_LONGS[mois - 1]} ${annee} enregistré.`)
      setMois(null)
      recharger()
    } catch {
      setErreurSaisie('L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.')
    } finally {
      setOccupe(false)
    }
  }

  const panneauSaisie = mois !== null && (
    <Card component="section" ref={panneau} aria-labelledby="titre-saisie-stock" sx={{ p: { xs: 2, md: 3 }, scrollMarginTop: 96 }}>
      <Typography variant="h2" id="titre-saisie-stock" sx={{ mb: 1 }}>Stock de fin de mois · {magasin}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Valeur au prix d’achat HT au dernier jour du mois.</Typography>
      <TextField select label="Mois" value={mois} onChange={(e) => ouvrir(Number(e.target.value))} sx={{ minWidth: 200, mb: 2, '& .MuiSelect-select': { minHeight: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }, '& .MuiSelect-nativeInput': { height: 48 } }}>
        {MOIS_LONGS.map((m, i) => <MenuItem key={m} value={i + 1} sx={{ minHeight: 48 }}>Fin {m} {annee}</MenuItem>)}
      </TextField>
      {erreurSaisie && <Alert severity="error" sx={{ mb: 2 }}>{erreurSaisie}</Alert>}
      <Stack direction="row" useFlexGap spacing={3} sx={{ flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ minWidth: 48 }}>Cave</Typography>
          <ChampNombre libelle="Stock de la Cave" valeur={champs.cave} onChange={(v) => setChamps((c) => ({ ...c, cave: v }))} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ minWidth: 48 }}>Bar</Typography>
          <ChampNombre libelle="Stock du Bar" valeur={champs.bar} onChange={(v) => setChamps((c) => ({ ...c, bar: v }))} />
        </Box>
      </Stack>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Button onClick={() => setMois(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
        <Button variant="contained" onClick={() => void enregistrer()} disabled={occupe} sx={{ minHeight: 48 }}>Enregistrer le stock</Button>
      </Box>
    </Card>
  )

  if (!atterri || atterri.budget.ca <= 0) {
    return (
      <Stack spacing={3}>
        {panneauSaisie}
        <EtatVide
          titre={`Pas encore de ventes ${annee}`}
          texte={`La cible du stock se calcule sur les ventes des mois à venir. Elle apparaît dès que le réel ${annee} du magasin est arrivé.`}
          action={boutonSaisie || undefined}
        />
      </Stack>
    )
  }

  const cout = coutVentesDe(atterri.budget, budgetSuivant)
  const s = suiviStock(cout, saisies, parametresStock)
  // Mois non saisis retrouvés entre deux saisies (03/11/2026), en italique précédés de « ≈ »
  const complet = stockComplete(cout, saisies, donnees.decembre)
  const aDesEstimes = complet.some((m) => m.estime)
  const caseStock = (saisi: number | null, valeur: number | null, cle: number) => (
    <TableCell key={cle} align="right" data-source={saisi === null && valeur !== null ? 'estime' : undefined}
      sx={saisi === null && valeur !== null ? { fontStyle: 'italic', color: 'text.secondary', position: 'relative' } : undefined}>
      {valeur === null ? '' : saisi === null ? <><Box component="span" sx={{ fontStyle: 'normal' }}>≈ </Box>{enChiffres(Math.round(valeur))}<Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> estimé</Box></> : enChiffres(Math.round(valeur))}
    </TableCell>
  )
  const d = s.dernier
  const reglage = `Cave ${reglageMois.format(parametresStock.mois.cave)} mois, Bar ${reglageMois.format(parametresStock.mois.bar)} mois d’achats à venir`
  // Sans stock saisi : la cible du dernier mois de ventes connu
  const moisRepere = Math.max(1, Math.min(12, atterri.moisRealises))

  return (
    <Stack spacing={3}>
      {message && <Alert severity="success" onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message}</Alert>}
      {panneauSaisie}

      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Stock ${annee} en chiffres`}>
        {d ? (<>
          <Indicateur libelle={`Stock fin ${MOIS_LONGS[d.mois - 1]}`} valeur={montant(d.reel!)}
            detail={`Cave ${milliers(d.reelUnivers.cave ?? 0)} · Bar ${milliers(d.reelUnivers.bar ?? 0)}, au prix d’achat`} />
          <Indicateur libelle="Cible" aide="stockCible" valeur={montant(d.cible)} detail={reglage}
            info={d.etat ? <Chip size="small" color={ETAT[d.etat].puce} label={ETAT[d.etat].libelle} sx={{ ml: 1, fontWeight: 700 }} /> : undefined} />
          <Indicateur libelle={d.etat === 'haut' ? 'Argent immobilisé en trop' : d.etat === 'bas' ? 'À racheter pour être dans la cible' : 'Écart à la cible'}
            valeur={d.etat === 'ok' ? ecartMontant(d.ecart!) : montant(Math.abs(d.ecart!))}
            detail={d.etat === 'ok' ? `Fourchette de ${milliers(d.mini)} à ${milliers(d.maxi)}` : `Pour revenir à la cible ; fourchette de ${milliers(d.mini)} à ${milliers(d.maxi)}`} />
        </>) : (
          <Indicateur libelle={`Cible fin ${MOIS_LONGS[moisRepere - 1]}`} aide="stockCible" valeur={montant(s.mois[moisRepere - 1].cible)} detail={`${reglage}. Aucun stock saisi en ${annee}.`} />
        )}
      </Stack>
      {boutonSaisie && <Box>{boutonSaisie}</Box>}

      <Card component="section" aria-label={`Stock de fin de mois ${annee}`} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2 }}>
          <Typography variant="h2">Stock de fin de mois</Typography>
          {aDesEstimes && <Aide sujet="stockEstime" />}
        </Box>
        <GraphiqueMois
          titre={`Stock de fin de mois ${annee} face à la cible`}
          format={montant}
          formatAxe={milliers}
          series={[
            { nom: 'Fourchette visée', forme: 'bande', couleur: 'rgba(58, 143, 141, 0.22)', valeurs: s.mois.map((m) => m.maxi), bas: s.mois.map((m) => m.mini) },
            { nom: 'Stock saisi', forme: 'barre', couleur: brand.vert, valeurs: s.mois.map((m) => m.reel), couleurs: s.mois.map((m) => (m.etat ? ETAT[m.etat].couleur : null)) },
            ...(aDesEstimes ? [{ nom: 'Stock estimé', forme: 'contour' as const, couleur: brand.vertFonce, valeurs: complet.map((m, i) => (s.mois[i].reel === null && m.estime ? m.total : null)) }] : []),
            { nom: 'Cible', forme: 'ligne', couleur: theme.palette.text.primary, pointille: true, valeurs: s.mois.map((m) => m.cible) },
          ]}
        />
      </Card>

      <Card component="section" aria-label={`Stock ${annee} mois par mois`}>
        <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Mois par mois</Typography>
        <TableContainer>
          <Table className="colonne-fixe" size="small" aria-label={`Stock ${annee} par mois`} sx={{ ...styleTableau, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 190 }, '& td:not(:first-of-type), & th:not(:first-of-type)': { minWidth: 112 } }}>
            <TableHead>
              <TableRow>
                <TableCell><Box component="span" sx={{ fontWeight: 400 }}>Fin de mois</Box></TableCell>
                {MOIS.map((m, i) => (
                  <TableCell key={m} align="right">
                    {peutSaisir
                      ? <Button size="small" onClick={() => ouvrir(i + 1)} aria-label={`Saisir le stock de fin ${MOIS_LONGS[i]} ${annee}`} sx={{ minHeight: { xs: 48, md: 28 }, minWidth: 0, px: 0.5, fontSize: 'inherit' }}>{m}</Button>
                      : m}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Stock Cave</TableCell>
                {s.mois.map((m, i) => caseStock(m.reelUnivers.cave, complet[i].cave, m.mois))}
              </TableRow>
              <TableRow>
                <TableCell>Stock Bar</TableCell>
                {s.mois.map((m, i) => caseStock(m.reelUnivers.bar, complet[i].bar, m.mois))}
              </TableRow>
              <TableRow className="ligne-forte" sx={{ '& td': { fontWeight: 700 } }}>
                <TableCell>Stock total</TableCell>
                {s.mois.map((m, i) => caseStock(m.reel, m.reel ?? complet[i].total, m.mois))}
              </TableRow>
              <TableRow>
                <TableCell>Cible</TableCell>
                {s.mois.map((m) => <TableCell key={m.mois} align="right">{enChiffres(Math.round(m.cible))}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell>Écart à la cible</TableCell>
                {s.mois.map((m) => <TableCell key={m.mois} align="right" sx={{ color: m.etat ? ETAT[m.etat].couleur : undefined, fontWeight: m.etat && m.etat !== 'ok' ? 700 : 400 }}>{m.ecart === null ? '' : ecartMontant(m.ecart)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell>Couverture Cave</TableCell>
                {s.mois.map((m) => <TableCell key={m.mois} align="right">{m.couverture.cave === null ? '' : enMois(m.couverture.cave)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell>Couverture Bar</TableCell>
                {s.mois.map((m) => <TableCell key={m.mois} align="right">{m.couverture.bar === null ? '' : enMois(m.couverture.bar)}</TableCell>)}
              </TableRow>
              <TableRow>
                <TableCell>État</TableCell>
                {s.mois.map((m) => <TableCell key={m.mois} align="right">{m.etat ? <Chip size="small" color={ETAT[m.etat].puce} label={ETAT[m.etat].libelle} sx={{ fontWeight: 700 }} /> : ''}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  )
}
