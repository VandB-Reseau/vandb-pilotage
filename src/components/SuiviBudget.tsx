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
import { atterrissageDe, chargerBudgets, chargerParametres, chargerQuadrimestres, chargerReel, chargerSecours, hypothesesDe, parametresDuBudget, type SaisiesQuadrimestres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { ecartChiffres, ecartMilliers, ecartMontant, ecartPts, ecartTaux, enChiffres, milliers, MOIS, MOIS_LONGS, montant, taux } from '../lib/format'
import { usePreference } from '../lib/preferences'
import { calculerBudget } from '../moteur/budget'
import { cumul, cumulApres, santeMagasin } from '../moteur/sante'
import { effetsSurLaMarge, moisDuReel, suiviBudget } from '../moteur/suivi'
import { reelComplete } from '../moteur/reelComplete'
import { Aide } from './Aide'
import { Repliable } from './Repliable'
import { niveauEcart } from '../moteur/visuel'
import { brand } from '../theme/theme'
import { styleTableau } from '../theme/tableau'
import { CaseComplete, CaseReelPrevu, COULEUR_BARRE, EnTeteMois, LegendePastilles } from './Tableau'

// Réel de l'année face à son budget, mois par mois : où le magasin décroche, et de combien. muetSansReel (lot 30) : dans
// « Où on va », l'atterrissage dit déjà qu'il n'y a pas de réel.
// Refonte visuelle (2/11/2026) : jauges sur les chiffres clés (R4), barres du réel dans le contour du budget avec l'an
// dernier en trait (R1) ou trajectoire cumulée jusqu'à l'atterrissage (R2), tableau à cases réel / prévu (T1, T2).
// Lot 41 (proposition 5) : dans « Où en est le magasin », la conclusion se lit en haut (vue « conclusion ») et le
// graphique avec le détail mois par mois plus bas (vue « detail ») ; sans budget à suivre, le détail le dit, la conclusion se tait.
export function SuiviBudget({ magasin, annee, allerA, muetSansReel, vue: partie = 'complet' }: { magasin: string; annee: number; allerA: (onglet: string) => void; muetSansReel?: boolean; vue?: 'complet' | 'conclusion' | 'detail' }) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReel(magasin, annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee).catch(() => undefined),
      chargerQuadrimestres(annee).catch((): SaisiesQuadrimestres => ({}))])
      .then(([d, p, reel, reelN1, secours, quadrimestres]) => ({ d, parametres: p.parametres, reel, reelN1, secours, quadrimestres: quadrimestres[magasin] ?? {} })),
    [magasin, annee])
  const [vue, setVue] = usePreference<'mois' | 'cumul'>('suivi', 'mois', ['mois', 'cumul'])

  if (chargement && !donnees) return partie === 'complet' ? <Skeleton variant="rounded" height={320} /> : null
  if (erreur || !donnees) return partie === 'conclusion' ? null : <Panne quoi={`Le suivi du budget ${annee}`} recharger={recharger} />

  const ligne = donnees.d.magasins.find((l) => l.magasin === magasin)
  const h = ligne?.statut ? hypothesesDe(ligne, donnees.d) : null
  if (!ligne || !h) {
    if (partie === 'conclusion') return null
    return (
      <EtatVide
        titre={`Pas de budget ${annee} à suivre`}
        texte={`Le suivi compare chaque mois le réel ${annee} au budget ${annee} du magasin. Il démarre dès que ce budget est proposé dans l’app.`}
      />
    )
  }
  const pBudget = parametresDuBudget(ligne, donnees.parametres)
  const b = calculerBudget(h.hypotheses, pBudget)
  const caisse = moisDuReel(donnees.reel.lignes, donnees.reel.tickets)
  const s = suiviBudget(caisse, b)
  // Réel complété (03/11/2026) : quadrimestres répartis par mois, budget pour les charges des autres mois
  const rc = reelComplete(caisse, donnees.quadrimestres, b, pBudget, annee)
  if (s.moisRealises === 0) {
    if (muetSansReel || partie !== 'complet') return null
    return (
      <EtatVide
        titre={`Pas encore de réel ${annee}`}
        texte={`Le suivi part des chiffres réels ${annee}, importés chaque mois ou saisis à la main.`}
        action={<Button variant="contained" onClick={() => allerA('reel')} sx={{ minHeight: 48 }}>Voir le réel</Button>}
      />
    )
  }
  const seuil = donnees.parametres.alertes.ecartCA
  const c = s.cumul
  const finMois = MOIS_LONGS[s.moisRealises - 1]
  const enCours = annee === new Date().getFullYear() ? new Date().getMonth() : null
  const n1 = moisDuReel(donnees.reelN1.lignes, donnees.reelN1.tickets).map((m) => (m.caHT > 0 ? m.caHT : null))
  const niveauxCA = s.mois.map((l) => niveauEcart(l.caReel, l.caBudget, seuil))
  // R2 : atterrissage de l'année (réel, puis projection) face au budget cumulé
  const a = atterrissageDe({ n: donnees.reel, n1: donnees.reelN1 }, annee, donnees.d.equipes[magasin], donnees.d.frais[magasin], donnees.parametres, donnees.secours, donnees.d.prets?.[magasin])
  const projection = a ? santeMagasin(donnees.reel, donnees.reelN1, a.budget).projection : null
  const atterri = projection ? cumulApres(s.mois.map((l) => l.caReel), projection) : null
  const finAtterri = atterri?.[11] ?? null
  // Conclusion : écart de CA, écart de taux de marge, et ce qui pèse le plus sur la marge
  const effets = effetsSurLaMarge(s)
  const totalMarge = effets.effetCA + (effets.effetTaux ?? 0)
  const conclusion = [
    `À fin ${finMois}, CA ${c.ecartCAPart === null ? ecartMilliers(c.ecartCA) : `${ecartTaux(c.ecartCAPart)} sur le budget (${ecartMilliers(c.ecartCA)})`}`,
    c.tauxMargeReel === null ? '. ' : `, taux de marge ${ecartPts(c.tauxMargeReel - c.tauxMargeBudget)}. `,
    effets.effetTaux === null ? '' : effets.principal === 'taux'
      ? `Sur la marge, le taux pèse le plus : ${ecartMilliers(effets.effetTaux)}, contre ${ecartMilliers(effets.effetCA)} pour le CA.`
      : `Sur la marge, le CA pèse le plus : ${ecartMilliers(effets.effetCA)}, contre ${ecartMilliers(effets.effetTaux)} pour le taux.`,
  ].join('').trim()

  // Joseph (03/11/2026) : un budget pas encore validé sert quand même de référence, signalé « provisoire »
  const provisoire = ligne.statut !== 'valide'
  const phrase = (
    <Stack spacing={0.75}>
      <Box component="p" aria-label="Conclusion" sx={{ m: 0, pl: 2, py: 0.5, borderLeft: 4, borderColor: totalMarge < 0 || c.ecartCA < 0 ? 'error.main' : 'success.main', fontSize: '1.0625rem', fontWeight: 700, maxWidth: '80ch' }}>
        {conclusion}
      </Box>
      {provisoire && (
        <Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>
          Budget {annee} provisoire : pas encore validé, le suivi le compare à sa dernière version.
        </Typography>
      )}
    </Stack>
  )
  if (partie === 'conclusion') return phrase
  return (
    <Stack spacing={3} id={partie === 'detail' ? 'partie-suivi' : undefined} sx={{ scrollMarginTop: 80 }}>
      {/* Lot 38 (D3) : la conclusion d'abord, calculée par le moteur ; le détail mois par mois est replié */}
      {partie === 'complet' && phrase}
      {partie === 'complet' && <Box component="section" aria-label={`Réel face au budget à fin ${finMois}`} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        <Indicateur
          libelle={`CA HT à fin ${finMois}`} aide="caCumule" valeur={milliers(c.caReel)}
          ecart={c.ecartCAPart === null ? undefined : { texte: `${ecartTaux(c.ecartCAPart)} sur le budget`, hausse: c.ecartCAPart >= 0, favorable: c.ecartCAPart >= 0 }}
          jauge={{ valeur: c.caReel, cible: c.caBudget, niveau: niveauEcart(c.caReel, c.caBudget, seuil), libelle: `CA réel face au budget à fin ${finMois}` }}
          detail={`Budget des mêmes mois : ${milliers(c.caBudget)}`}
        />
        <Indicateur
          libelle="Taux de marge" aide="margeTheorique" valeur={c.tauxMargeReel === null ? 'Non connu' : taux(c.tauxMargeReel)}
          ecart={c.tauxMargeReel === null ? undefined : { texte: `${ecartPts(c.tauxMargeReel - c.tauxMargeBudget)} sur le budget`, hausse: c.tauxMargeReel >= c.tauxMargeBudget, favorable: c.tauxMargeReel >= c.tauxMargeBudget }}
          jauge={c.tauxMargeReel === null ? undefined : { valeur: c.tauxMargeReel, cible: c.tauxMargeBudget, niveau: niveauEcart(c.tauxMargeReel, c.tauxMargeBudget, seuil), libelle: 'Taux de marge réel face au budget' }}
          detail={`Budget : ${taux(c.tauxMargeBudget)}`}
        />
        <Indicateur
          libelle="Écart de marge" aide="ecartBudget" valeur={c.ecartMarge === null ? 'Non connu' : ecartMilliers(c.ecartMarge)}
          detail={c.ecartMarge === null ? 'Marge absente des chiffres de caisse' : `Budget des mêmes mois : ${milliers(c.margeBudget)}`}
        />
      </Box>}

      {/* Lot 41 : sur « Où en est le magasin », le graphique est celui de la synthèse ; le détail garde le tableau */}
      {partie === 'complet' && <Card component="section" aria-label={`Réel et budget ${annee}, graphique`} sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h2" sx={{ flex: 1, minWidth: 200 }}>Chiffre d’affaires {annee} face au budget</Typography>
          <ToggleButtonGroup exclusive size="small" value={vue} onChange={(_, v: 'mois' | 'cumul' | null) => v && setVue(v)} aria-label="Affichage du suivi" className="pas-a-l-impression">
            <ToggleButton value="mois" sx={{ minHeight: 48, textTransform: 'none', px: 2 }}>Mois par mois</ToggleButton>
            <ToggleButton value="cumul" sx={{ minHeight: 48, textTransform: 'none', px: 2 }}>Cumulé</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {vue === 'mois' ? (
          <GraphiqueMois
            titre={`Chiffre d’affaires ${annee} : réel jusqu’à ${finMois} dans le contour du budget, et ${annee - 1}`}
            format={montant} formatAxe={milliers} moisEnCours={enCours}
            series={[
              { nom: 'Réel', valeurs: s.mois.map((l) => l.caReel), forme: 'barre', couleur: brand.vert, couleurs: niveauxCA.map((n) => (n ? COULEUR_BARRE[n] : null)) },
              { nom: 'Budget', valeurs: s.mois.map((l) => l.caBudget), forme: 'contour', couleur: 'var(--mui-palette-text-secondary)' },
              ...(n1.some((v) => v !== null) ? [{ nom: `Réel ${annee - 1}`, valeurs: n1, forme: 'ligne' as const, couleur: brand.or }] : []),
            ]}
          />
        ) : (
          <GraphiqueMois
            titre={`Chiffre d’affaires ${annee} cumulé : réel jusqu’à ${finMois}, atterrissage ensuite, face au budget`}
            note={finAtterri === null ? undefined : `Atterrissage ${annee} : ${milliers(finAtterri)}, ${ecartMilliers(finAtterri - b.ca)} face au budget de ${milliers(b.ca)}`}
            format={montant} formatAxe={milliers} moisEnCours={enCours}
            series={[
              { nom: 'Budget', valeurs: cumul(b.mois.map((m) => m.ca)), forme: 'ligne', couleur: 'var(--mui-palette-text-secondary)' },
              ...(atterri ? [{ nom: 'Atterrissage', valeurs: atterri, forme: 'ligne' as const, couleur: brand.vert, pointille: true }] : []),
              { nom: 'Réel', valeurs: cumul(s.mois.map((l) => l.caReel)), forme: 'ligne', couleur: brand.vertFonce },
            ]}
          />
        )}
      </Card>}

      <Repliable titre="Mois par mois" nom={`Réel et budget ${annee} mois par mois`} droite={<LegendePastilles seuil={seuil} />}>
        <TableContainer>
          <Table size="small" className="colonne-fixe" aria-label={`Réel face au budget ${annee} mois par mois`} sx={styleTableau}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 150 }}><Box component="span" sx={{ fontWeight: 400 }}>En euros</Box></TableCell>
                {MOIS.map((_, i) => {
                  const q = rc.mois[i]?.quadrimestre
                  return <EnTeteMois key={i} mois={i} enCours={i === enCours} sous={i === enCours ? 'en cours' : rc.mois[i] ? (q ? `réel + Q${q}` : 'réel + ≈') : i < s.moisRealises ? 'réel / budget' : 'budget'} />
                })}
                <TableCell align="right">À fin {finMois}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow className="ligne-cle">
                <TableCell sx={{ fontWeight: 700 }}>CA HT</TableCell>
                {s.mois.map((l, i) => <CaseReelPrevu key={i} reel={l.caReel} prevu={l.caBudget} niveau={niveauxCA[i]} format={entier} enCours={i === enCours} />)}
                <CaseReelPrevu reel={c.caReel} prevu={c.caBudget} niveau={niveauEcart(c.caReel, c.caBudget, seuil)} format={entier} fort />
              </TableRow>
              <TableRow className="ligne-cle">
                <TableCell sx={{ fontWeight: 700 }}>Marge</TableCell>
                {s.mois.map((l, i) => (
                  <CaseReelPrevu key={i} reel={l.margeReel} prevu={l.caReel === null || l.margeReel !== null ? l.margeBudget : null}
                    niveau={niveauEcart(l.margeReel, l.margeBudget, seuil)} format={entier} enCours={i === enCours} />
                ))}
                <CaseReelPrevu reel={c.margeReel} prevu={c.margeReel === null ? null : c.margeBudget} niveau={niveauEcart(c.margeReel, c.margeBudget, seuil)} format={entier} fort />
              </TableRow>
              {rc.cumul && ([
                ['marge', 'Marge après démarque', false],
                ['personnel', 'Frais de personnel', true],
                ['autres', 'Charges externes, impôts et taxes', true],
                ['ebe', 'EBE', false],
              ] as const).map(([k, libelle, charge]) => {
                const de = (m: NonNullable<typeof rc.mois[number]>) => (k === 'autres'
                  ? { valeur: m.chargesExternes.valeur + m.impotsTaxes.valeur, source: m.chargesExternes.source === 'estime' || m.impotsTaxes.source === 'estime' ? 'estime' as const : 'reparti' as const }
                  : m[k])
                const prevu = (i: number) => (k === 'autres' ? b.mois[i].chargesExternes + b.mois[i].impotsTaxes : b.mois[i][k])
                const total = k === 'autres'
                  ? { valeur: rc.cumul!.chargesExternes.valeur + rc.cumul!.impotsTaxes.valeur, source: rc.cumul!.chargesExternes.source === 'estime' || rc.cumul!.impotsTaxes.source === 'estime' ? 'estime' as const : 'reparti' as const }
                  : rc.cumul![k]
                return (
                  <TableRow key={k} className={k === 'ebe' ? 'ligne-cle' : undefined}>
                    <TableCell sx={{ fontWeight: k === 'ebe' ? 700 : 400 }}>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>{libelle}{k === 'ebe' && <Aide sujet="reelComplete" />}</Box>
                    </TableCell>
                    {rc.mois.map((m, i) => <CaseComplete key={i} chiffre={m ? de(m) : null} prevu={prevu(i)} format={entier} enCours={i === enCours} charge={charge} />)}
                    <CaseComplete chiffre={total} prevu={k === 'autres' ? rc.budget.chargesExternes + rc.budget.impotsTaxes : rc.budget[k]} format={entier} fort charge={charge} />
                  </TableRow>
                )
              })}
              <TableRow>
                <TableCell>Écart de CA</TableCell>
                {s.mois.map((l, i) => (
                  <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} sx={{ color: l.ecartCA === null ? undefined : l.ecartCA < 0 ? 'error.main' : 'success.dark' }}>
                    {l.ecartCA === null ? '' : ecartChiffres(l.ecartCA)}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700, color: c.ecartCA < 0 ? 'error.main' : 'success.dark' }}>{ecartMontant(c.ecartCA)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Repliable>
    </Stack>
  )
}

const entier = (v: number) => enChiffres(Math.round(v))
