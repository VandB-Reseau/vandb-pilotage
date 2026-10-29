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
import { EtatVide } from './EtatVide'
import { GraphiqueMois } from './GraphiqueMois'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { PastilleStatut } from './PastilleStatut'
import { chargerBudgets, chargerParametres, chargerReel, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { ecartChiffres, ecartMontant, ecartPts, ecartTaux, enChiffres, milliers, montant, MOIS, MOIS_LONGS, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { moisDuReel, suiviBudget, type LigneSuivi } from '../moteur/suivi'
import { brand } from '../theme/theme'

type Ligne = { libelle: string; valeur: (l: LigneSuivi) => number | null; cumul: number | null; ecart?: boolean; fort?: boolean }

// Réel de l'année face à son budget, mois par mois : où le magasin décroche, et de combien. muetSansReel (lot 30) : dans
// « Où on va », l'atterrissage dit déjà qu'il n'y a pas de réel
export function SuiviBudget({ magasin, annee, allerA, muetSansReel }: { magasin: string; annee: number; allerA: (onglet: string) => void; muetSansReel?: boolean }) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReel(magasin, annee)]).then(([d, p, reel]) => ({ d, parametres: p.parametres, reel })),
    [magasin, annee])

  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi={`Le suivi du budget ${annee}`} recharger={recharger} />

  const ligne = donnees.d.magasins.find((l) => l.magasin === magasin)
  const h = ligne?.statut ? hypothesesDe(ligne, donnees.d) : null
  if (!ligne || !h) {
    return (
      <EtatVide
        titre={`Pas de budget ${annee} à suivre`}
        texte={`Le suivi compare chaque mois le réel ${annee} au budget ${annee} du magasin. Il démarre dès que ce budget est proposé dans l’app.`}
      />
    )
  }
  const b = calculerBudget(h.hypotheses, donnees.parametres)
  const s = suiviBudget(moisDuReel(donnees.reel.lignes, donnees.reel.tickets), b)
  if (s.moisRealises === 0) {
    if (muetSansReel) return null
    return (
      <EtatVide
        titre={`Pas encore de réel ${annee}`}
        texte={`Le suivi part des chiffres réels ${annee}, importés chaque mois ou saisis à la main.`}
        action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
      />
    )
  }
  const c = s.cumul
  const finMois = MOIS_LONGS[s.moisRealises - 1]
  const sousBudget = s.mois.filter((l) => l.ecartCA !== null && l.ecartCA < 0).length
  const lignes: Ligne[] = [
    { libelle: 'CA HT réel', valeur: (l) => l.caReel, cumul: c.caReel, fort: true },
    { libelle: 'CA HT budgété', valeur: (l) => l.caBudget, cumul: c.caBudget },
    { libelle: 'Écart de CA', valeur: (l) => l.ecartCA, cumul: c.ecartCA, ecart: true },
    { libelle: 'Marge réelle', valeur: (l) => l.margeReel, cumul: c.margeReel, fort: true },
    { libelle: 'Marge budgétée', valeur: (l) => (l.caReel === null || l.margeReel !== null ? l.margeBudget : null), cumul: c.margeReel === null ? null : c.margeBudget },
    { libelle: 'Écart de marge', valeur: (l) => l.ecartMarge, cumul: c.ecartMarge, ecart: true },
  ]
  const couleur = (v: number | null, ecart?: boolean) => (ecart && v ? (v < 0 ? 'error.main' : 'success.dark') : undefined)

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body1" color="text.secondary">Budget {annee}</Typography>
        <PastilleStatut statut={ligne.statut} />
      </Box>
      <Box component="section" aria-label={`Réel face au budget à fin ${finMois}`} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <Indicateur
          libelle={`CA HT à fin ${finMois}`} aide="caCumule" valeur={milliers(c.caReel)}
          ecart={c.ecartCAPart === null ? undefined : { texte: `${ecartTaux(c.ecartCAPart)} sur le budget`, hausse: c.ecartCAPart >= 0, favorable: c.ecartCAPart >= 0 }}
          detail={`Budget des mêmes mois : ${milliers(c.caBudget)}`}
        />
        <Indicateur libelle="Écart de CA" aide="ecartBudget" valeur={ecartMontant(c.ecartCA)} detail={`${sousBudget} mois sous le budget sur ${s.moisRealises}`} serie={s.mois.map((l) => l.ecartCA)} />
        <Indicateur
          libelle="Taux de marge" aide="margeTheorique" valeur={c.tauxMargeReel === null ? 'Non connu' : taux(c.tauxMargeReel)}
          ecart={c.tauxMargeReel === null ? undefined : { texte: `${ecartPts(c.tauxMargeReel - c.tauxMargeBudget)} sur le budget`, hausse: c.tauxMargeReel >= c.tauxMargeBudget, favorable: c.tauxMargeReel >= c.tauxMargeBudget }}
          detail={`Budget : ${taux(c.tauxMargeBudget)}`}
        />
        <Indicateur
          libelle="Écart de marge" aide="ecartBudget" valeur={c.ecartMarge === null ? 'Non connu' : ecartMontant(c.ecartMarge)}
          detail={c.ecartMarge === null ? 'Marge absente des chiffres de caisse' : `Mois dont la marge est complète : ${s.mois.filter((l) => l.margeReel !== null).length} sur ${s.moisRealises}`}
        />
      </Box>

      <Card component="section" aria-label={`Réel et budget ${annee}, graphique`} sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h2" sx={{ mb: 2 }}>Chiffre d’affaires {annee} face au budget</Typography>
        <GraphiqueMois
          titre={`Chiffre d’affaires ${annee} : réel jusqu’à ${finMois}, comparé au budget`}
          format={montant} formatAxe={milliers}
          series={[
            { nom: 'Réel', valeurs: s.mois.map((l) => l.caReel), forme: 'barre', couleur: 'var(--mui-palette-text-primary)' },
            { nom: 'Budget', valeurs: s.mois.map((l) => l.caBudget), forme: 'ligne', couleur: brand.vert },
          ]}
        />
      </Card>

      <Card component="section" aria-label={`Réel et budget ${annee} mois par mois`}>
        <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Mois par mois</Typography>
        <TableContainer>
          <Table size="small" className="colonne-fixe" aria-label={`Réel face au budget ${annee} mois par mois`}
            sx={{ '& td, & th': { py: 0.75, px: 1, fontSize: '0.8125rem' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 150 }}><Box component="span" sx={{ fontWeight: 400 }}>En euros</Box></TableCell>
                {MOIS.map((m, i) => <TableCell key={m} align="right" sx={i >= s.moisRealises ? { color: 'text.disabled' } : undefined}>{m}</TableCell>)}
                <TableCell align="right">À fin {finMois}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.libelle} sx={l.ecart ? { bgcolor: 'background.default' } : undefined}>
                  <TableCell sx={{ fontWeight: l.fort || l.ecart ? 700 : 400, whiteSpace: 'nowrap', ...(l.ecart ? { bgcolor: 'background.default' } : {}) }}>{l.libelle}</TableCell>
                  {s.mois.map((m, i) => {
                    const v = l.valeur(m)
                    return (
                      <TableCell key={i} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: l.ecart ? 700 : 400, color: couleur(v, l.ecart) ?? (l.fort ? undefined : 'text.secondary') }}>
                        {v === null ? '' : l.ecart ? ecartChiffres(v) : enChiffres(Math.round(v))}
                      </TableCell>
                    )
                  })}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: couleur(l.cumul, l.ecart) }}>
                    {l.cumul === null ? '' : l.ecart ? ecartMontant(l.cumul) : montant(l.cumul)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Stack>
  )
}
