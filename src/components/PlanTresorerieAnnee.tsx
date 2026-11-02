import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { ecartMilliers, enChiffres, milliers, MOIS, MOIS_LONGS, QUADRIMESTRES_COURTS } from '../lib/format'
import type { Tresorerie } from '../moteur/tresorerie'
import { niveauEcart, type PlanTresorerie } from '../moteur/visuel'
import { styleTableau } from '../theme/tableau'
import { Aide } from './Aide'
import { GraphiqueTresorerie } from './GraphiqueTresorerie'
import { Indicateur } from './Indicateur'
import { CaseReelPrevu, EnTeteMois, LegendePastilles } from './Tableau'

const entier = (v: number) => enChiffres(Math.round(v))

// Plan de trésorerie de l'année en cours, réel face au prévu (refonte P1 et P2, 2/11/2026). Le réel de trésorerie se pilote
// au quadrimestre (Joseph) : le solde réel est celui saisi à la fin de chaque quadrimestre ; l'encaissé réel vient de la
// caisse chaque mois ; le décaissé réel d'un quadrimestre se déduit du solde.
export function PlanTresorerieAnnee({ annee, plan, prevue, seuil, enCours, source }: {
  annee: number
  plan: PlanTresorerie
  prevue: Tresorerie
  seuil: number
  enCours: number | null
  source: 'budget' | 'atterrissage'
}) {
  const r = plan.dernierReel
  const finProjetee = plan.mois[11].finProjetee
  const sous = (i: number) => (i === enCours ? 'en cours' : plan.mois[i].encReel !== null ? 'réel / prévu' : 'prévu')
  return (
    <Card component="section" aria-label={`Plan de trésorerie ${annee}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, pt: 2, pb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h2">Plan de trésorerie {annee}</Typography><Aide sujet="planTresorerie" />
        <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
          Prévu : {source === 'budget' ? `budget ${annee}` : `selon l’atterrissage, faute de budget ${annee}`}. Réel : solde saisi à chaque quadrimestre.
        </Typography>
      </Box>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', px: 2.5, py: 1.5 }} aria-label="Trésorerie en bref">
        <Indicateur
          libelle={r ? `Trésorerie fin ${MOIS_LONGS[r.mois]}` : 'Trésorerie réelle'} valeur={r ? milliers(r.montant) : 'À saisir'}
          ecart={r ? { texte: `${ecartMilliers(r.ecart)} sur le prévu`, hausse: r.ecart >= 0, favorable: r.ecart >= 0 } : undefined}
          detail={r ? `Prévu : ${milliers(r.prevu)} · saisie au quadrimestre` : 'Saisie avec le quadrimestre, ligne « Trésorerie en fin de période »'}
        />
        {plan.pointBas && (
          <Indicateur libelle="Point bas à venir" aide="pointBas" valeur={milliers(plan.pointBas.montant)}
            detail={`Fin ${MOIS_LONGS[plan.pointBas.mois]}, ${plan.pointBas.source === 'projection' ? 'depuis le dernier solde réel' : 'selon le prévu'}`} />
        )}
        <Indicateur
          libelle="Fin décembre" aide="tresorerieGlissante" valeur={milliers(finProjetee ?? prevue.fin)}
          ecart={finProjetee !== null ? { texte: `${ecartMilliers(finProjetee - prevue.fin)} sur le prévu`, hausse: finProjetee >= prevue.fin, favorable: finProjetee >= prevue.fin } : undefined}
          detail={finProjetee !== null ? `Projeté depuis le dernier solde réel · prévu ${milliers(prevue.fin)}` : 'Prévu'}
        />
      </Stack>
      <Box sx={{ px: 2.5, pb: 1 }}><GraphiqueTresorerie tresorerie={prevue} annee={annee} plan={plan} moisEnCours={enCours} /></Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 1, pb: 1 }}>
        <Typography variant="h3" sx={{ flex: 1 }}>Mois par mois</Typography>
        <LegendePastilles seuil={seuil} />
      </Box>
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label={`Plan de trésorerie ${annee} mois par mois`} sx={styleTableau}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}><Box component="span" sx={{ fontWeight: 400 }}>En euros TTC</Box></TableCell>
              {MOIS.map((_, i) => <EnTeteMois key={i} mois={i} enCours={i === enCours} sous={sous(i)} />)}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Encaissé en caisse</TableCell>
              {plan.mois.map((m, i) => <CaseReelPrevu key={i} reel={m.encReel} prevu={m.encPrevu} niveau={niveauEcart(m.encReel, m.encPrevu, seuil)} format={entier} enCours={i === enCours} />)}
            </TableRow>
            <TableRow>
              <TableCell>Décaissements prévus</TableCell>
              {plan.mois.map((m, i) => <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} sx={{ color: 'text.secondary' }}>{entier(-m.decPrevu)}</TableCell>)}
            </TableRow>
            <TableRow className="ligne-forte">
              <TableCell>Trésorerie en fin de mois</TableCell>
              {plan.mois.map((m, i) => (
                <CaseReelPrevu key={i} reel={m.finReelle} prevu={m.finPrevue} niveau={niveauEcart(m.finReelle, m.finPrevue, seuil)} format={entier} enCours={i === enCours} fort />
              ))}
            </TableRow>
            {plan.mois.some((m) => m.finProjetee !== null) && (
              <TableRow>
                <TableCell>Trésorerie projetée</TableCell>
                {plan.mois.map((m, i) => (
                  <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} sx={{ fontStyle: m.finReelle === null ? 'italic' : undefined, color: m.finProjetee !== null && m.finProjetee < 0 ? 'error.main' : undefined }}>
                    {m.finProjetee === null ? '' : entier(m.finProjetee)}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h3" sx={{ px: 2.5, pt: 2.5, pb: 1 }}>Par quadrimestre</Typography>
      <TableContainer>
        <Table size="small" aria-label={`Trésorerie ${annee} par quadrimestre`} sx={{ ...styleTableau, minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}><Box component="span" sx={{ fontWeight: 400 }}>En euros TTC</Box></TableCell>
              {plan.quadrimestres.map((q) => <TableCell key={q.q} align="right">{QUADRIMESTRES_COURTS[q.q - 1]}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Trésorerie en début de période</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.debut} prevu={q.debutPrevu} niveau={niveauEcart(q.debut, q.debutPrevu, seuil)} format={entier} />)}
            </TableRow>
            <TableRow>
              <TableCell>Encaissé en caisse</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.encReel} prevu={q.encPrevu} niveau={niveauEcart(q.encReel, q.encPrevu, seuil)} format={entier} />)}
            </TableRow>
            <TableRow>
              <TableCell>Décaissé<Aide sujet="decaisseDeduit" compact /></TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.decReel} prevu={q.decPrevu} niveau={niveauEcart(q.decReel, q.decPrevu, seuil, true)} format={entier} charge />)}
            </TableRow>
            <TableRow className="ligne-forte">
              <TableCell>Trésorerie en fin de période</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.fin} prevu={q.finPrevue} niveau={niveauEcart(q.fin, q.finPrevue, seuil)} format={entier} fort />)}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ pb: 1.5 }} />
    </Card>
  )
}
