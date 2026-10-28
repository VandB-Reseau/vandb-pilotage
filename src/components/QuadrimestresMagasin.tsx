import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from './ChampNombre'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { chargerBudgets, chargerParametres, chargerQuadrimestres, chargerReel, enregistrerQuadrimestres, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { nombre } from '../import/caisse'
import { ecartMontant, ecartPts, enChiffres, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { QUADRIMESTRES, quadrimestreLibelle, resultatsQuadrimestres, type Quadrimestre, type ResultatQuadrimestre, type SaisieQuadrimestre } from '../moteur/quadrimestre'
import { moisDuReel } from '../moteur/suivi'

type Champ = keyof SaisieQuadrimestre
type Textes = Record<Quadrimestre, Record<Champ, string>>
const CHAMPS: Champ[] = ['achats', 'variationStock', 'chargesExternes', 'impotsTaxes', 'personnel', 'tresorerie']
const LIBELLES: Record<Champ, string> = {
  achats: 'Achats de marchandises HT',
  variationStock: 'Variation de stock (fin − début)',
  chargesExternes: 'Charges externes (redevance et publicité comprises)',
  impotsTaxes: 'Impôts et taxes',
  personnel: 'Frais de personnel',
  tresorerie: 'Trésorerie en fin de période',
}
const COURT: Record<Quadrimestre, string> = { 1: 'Janv. à avr.', 2: 'Mai à août', 3: 'Sept. à déc.' }
const vers = (saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>>): Textes =>
  Object.fromEntries(QUADRIMESTRES.map((q) => [q, Object.fromEntries(CHAMPS.map((c) => [c, saisies[q]?.[c] == null ? '' : enChiffres(saisies[q]![c]!)]))])) as Textes

// Résultat réel tous les 4 mois : quelques montants comptables saisis, le reste calculé (CA de la caisse, marge, EBE)
export function QuadrimestresMagasin({ magasin, annee, peutSaisir }: { magasin: string; annee: number; peutSaisir: boolean }) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReel(magasin, annee), chargerQuadrimestres(annee)])
      .then(([d, p, reel, q]) => ({ d, parametres: p.parametres, reel, saisies: q[magasin] ?? {} })),
    [magasin, annee])
  const [textes, setTextes] = useState<Textes>(vers({}))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { if (donnees) setTextes(vers(donnees.saisies)) }, [donnees])

  // Saisies lues depuis les champs : un quadrimestre sans aucun montant n'existe pas
  const lues: Partial<Record<Quadrimestre, SaisieQuadrimestre>> = {}
  let lisible = true
  for (const q of QUADRIMESTRES) {
    const s = Object.fromEntries(CHAMPS.map((c) => { const n = nombre(textes[q][c]); if (Number.isNaN(n)) lisible = false; return [c, Number.isNaN(n) ? null : n] })) as unknown as SaisieQuadrimestre
    if (CHAMPS.some((c) => s[c] !== null) || donnees?.saisies[q]) lues[q] = s
  }
  const negatif = QUADRIMESTRES.some((q) => (['achats', 'chargesExternes', 'impotsTaxes', 'personnel'] as Champ[]).some((c) => (lues[q]?.[c] ?? 0) < 0))
  const modifie = !!donnees && JSON.stringify(vers(lues)) !== JSON.stringify(vers(donnees.saisies))
  useSaisieEnCours(modifie)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi={`Les quadrimestres ${annee}`} recharger={recharger} />

  const ligne = donnees.d.magasins.find((l) => l.magasin === magasin)
  const h = ligne?.statut ? hypothesesDe(ligne, donnees.d) : null
  const budget = h ? calculerBudget(h.hypotheses, donnees.parametres) : null
  const { parQuadrimestre, cumul, dernier } = resultatsQuadrimestres(moisDuReel(donnees.reel.lignes, donnees.reel.tickets), lues, budget)
  const colonnes: (ResultatQuadrimestre | null)[] = [...parQuadrimestre, cumul]

  const enregistrer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerQuadrimestres(magasin, annee, lues)
      setMessage({ gravite: 'success', texte: 'Quadrimestres enregistrés.' })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  const vide = <TableCell align="right" sx={{ color: 'text.disabled' }}>–</TableCell>
  const calcul = (libelle: string, f: (r: ResultatQuadrimestre) => number | null, texte: (v: number) => string, o: { fort?: boolean; rouge?: boolean } = {}) => (
    <TableRow sx={o.fort ? { bgcolor: 'background.default', '& td': { bgcolor: 'background.default', fontWeight: 700 } } : undefined}>
      <TableCell>{libelle}</TableCell>
      {colonnes.map((r, i) => {
        const v = r ? f(r) : null
        return v === null ? <TableCell key={i} align="right" sx={{ color: 'text.disabled' }}>–</TableCell>
          : <TableCell key={i} align="right" sx={o.rouge && v < 0 ? { color: 'error.main' } : undefined}>{texte(v)}</TableCell>
      })}
    </TableRow>
  )
  const saisie = (c: Champ) => (
    <TableRow key={c}>
      <TableCell>{LIBELLES[c]}</TableCell>
      {QUADRIMESTRES.map((q) => (
        <TableCell key={q} align="right" sx={{ py: 0.5 }}>
          <ChampNombre libelle={`${LIBELLES[c]} : ${quadrimestreLibelle[q].toLowerCase()}`} valeur={textes[q][c]} desactive={!peutSaisir} largeur={150}
            onChange={(v) => setTextes((t) => ({ ...t, [q]: { ...t[q], [c]: v } }))} />
        </TableCell>
      ))}
      {c === 'tresorerie' ? (cumul?.tresorerie == null ? vide : <TableCell align="right">{enChiffres(Math.round(cumul.tresorerie))}</TableCell>)
        : (() => { const v = cumul ? QUADRIMESTRES.filter((q) => dernier && q <= dernier).map((q) => lues[q]?.[c]) : []
          return v.length && v.every((x) => x != null) ? <TableCell align="right">{enChiffres(Math.round(v.reduce((a, b) => a! + b!, 0)!))}</TableCell> : vide })()}
    </TableRow>
  )
  const euros = (v: number) => enChiffres(Math.round(v) || 0)
  const fin = dernier ? quadrimestreLibelle[dernier].split(' à ')[1] : ''

  return (
    <Stack spacing={3}>
      {cumul?.ebe != null && (
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Résultat réel à fin ${fin}`}>
          <Indicateur
            libelle={`EBE réel à fin ${fin}`} valeur={milliers(cumul.ebe)}
            ecart={cumul.ecartEBE === null ? undefined : { texte: `${ecartMontant(cumul.ecartEBE)} sur le budget`, hausse: cumul.ecartEBE >= 0, favorable: cumul.ecartEBE >= 0 }}
            detail={cumul.ebeSurCA === null ? undefined : `${taux(cumul.ebeSurCA)} du CA`}
          />
          <Indicateur
            libelle="Taux de marge réel" valeur={cumul.tauxMarge === null ? '–' : taux(cumul.tauxMarge)}
            detail={cumul.ecartMargeCaisse === null ? undefined : `${ecartPts(cumul.ecartMargeCaisse)} face à la marge de la caisse`}
          />
          <Indicateur libelle="Masse salariale / marge" valeur={cumul.personnelSurMarge === null ? '–' : taux(cumul.personnelSurMarge)} />
        </Stack>
      )}

      <Card component="section" aria-label={`Quadrimestres ${annee}`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Quadrimestres {annee}</Typography>
          {peutSaisir && modifie && (
            <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !lisible || negatif} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>
              Enregistrer les quadrimestres
            </Button>
          )}
        </Box>
        {message && <Box sx={{ px: 2.5, pb: 1 }}><Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>}
        {negatif && <Box sx={{ px: 2.5, pb: 1 }}><Alert severity="warning">Les achats et les charges se saisissent en positif.</Alert></Box>}
        <TableContainer>
          <Table size="small" className="colonne-fixe" aria-label={`Résultat réel ${annee} par quadrimestre`} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 240 } }}>
            <TableHead>
              <TableRow>
                <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros HT</Box></TableCell>
                {QUADRIMESTRES.map((q) => <TableCell key={q} align="right">{COURT[q]}</TableCell>)}
                <TableCell align="right">{dernier ? `Cumul à fin ${fin}` : 'Cumul'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calcul('CA HT de la caisse', (r) => r.ca, euros, { fort: true })}
              {saisie('achats')}
              {saisie('variationStock')}
              {calcul('Marge réelle', (r) => r.marge, euros, { fort: true })}
              {calcul('Taux de marge réel', (r) => r.tauxMarge, taux)}
              {calcul('Taux de marge théorique de la caisse', (r) => r.tauxMargeCaisse, taux)}
              {calcul('Écart à la marge de la caisse (démarque)', (r) => r.ecartMargeCaisse, ecartPts, { rouge: true })}
              {calcul('Taux de marge du budget', (r) => r.tauxMargeBudget, taux)}
              {saisie('chargesExternes')}
              {saisie('impotsTaxes')}
              {saisie('personnel')}
              {calcul('EBE réel', (r) => r.ebe, euros, { fort: true, rouge: true })}
              {calcul('EBE / CA', (r) => r.ebeSurCA, taux)}
              {calcul('EBE du budget', (r) => r.budget?.ebe ?? null, euros)}
              {calcul('Écart d’EBE au budget', (r) => r.ecartEBE, ecartMontant, { rouge: true })}
              {saisie('tresorerie')}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  )
}
