import { useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { ecartMilliers, enChiffres, enMilliers, milliers, MOIS, MOIS_LONGS, QUADRIMESTRES_COURTS } from '../lib/format'
import type { Tresorerie } from '../moteur/tresorerie'
import { niveauEcart, type PlanTresorerie } from '../moteur/visuel'
import { styleTableau } from '../theme/tableau'
import { Aide } from './Aide'
import { GraphiqueTresorerie } from './GraphiqueTresorerie'
import { GraphiqueTresorerieQuadri } from './GraphiqueTresorerieQuadri'
import { Indicateur } from './Indicateur'
import { CaseReelPrevu, EnTeteMois, LegendePastilles } from './Tableau'

const entier = (v: number) => enChiffres(Math.round(v))
// k€ à une décimale : « 113 », « −2 », « 1,2 »
const k = (v: number) => enMilliers(v)
type Vue = 'mois' | 'quadrimestre'
const CLE_VUE = 'pilotage.tresorerie.vue'
const lireVue = (): Vue => { try { return localStorage.getItem(CLE_VUE) === 'quadrimestre' ? 'quadrimestre' : 'mois' } catch { return 'mois' } }
const ecartK = (v: number) => (Math.round(v / 100) === 0 ? '0' : `${v > 0 ? '+' : '−'}${enMilliers(Math.abs(v))}`)

// Plan de trésorerie de l'année en cours, réel face au prévu (refonte P1 et P2, 2/11/2026). Le réel de trésorerie se pilote
// au quadrimestre (Joseph) : le solde réel est celui saisi à la fin de chaque quadrimestre ; l'encaissé réel vient de la
// caisse chaque mois ; le décaissé réel d'un quadrimestre se déduit du solde.
// Curseur Mois / Quadrimestre (Joseph, 03/11/2026) : il fait basculer ensemble le graphe et le tableau, à la place du second
// tableau « Par quadrimestre » empilé sous le premier ; le choix est retenu sur ce poste.
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
  const [vue, setVue] = useState<Vue>(lireVue)
  const changerVue = (v: Vue | null) => { if (!v) return; setVue(v); try { localStorage.setItem(CLE_VUE, v) } catch { /* poste sans stockage */ } }
  const sous = (i: number) => (i === enCours ? 'en cours' : plan.mois[i].encReel !== null ? 'réel' : 'prévu')
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={vue} onChange={(_, v: Vue | null) => changerVue(v)} aria-label="Lire la trésorerie">
          <ToggleButton value="mois" sx={{ minHeight: 48, px: 2.5 }}>Mois</ToggleButton>
          <ToggleButton value="quadrimestre" sx={{ minHeight: 48, px: 2.5 }}>Quadrimestre</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <LegendePastilles seuil={seuil} />
      </Box>
      <Box sx={{ px: 2.5, pb: 1 }}>
        {vue === 'mois'
          ? <GraphiqueTresorerie tresorerie={prevue} annee={annee} plan={plan} moisEnCours={enCours} />
          : <GraphiqueTresorerieQuadri plan={plan} annee={annee} quadriEnCours={enCours === null ? null : Math.floor(enCours / 4)} />}
      </Box>
      {vue === 'mois' ? (<>
      {/* T1 (Joseph, 02/11/2026) : un chiffre par case, en k€ ; l'écart au prévu sur une ligne à part, coloré seulement
          au-delà du seuil d'alerte ; le tableau tient dans l'écran du PC */}
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label={`Plan de trésorerie ${annee} mois par mois`}
          sx={{ ...styleTableau, '& td, & th': { ...styleTableau['& td, & th'], px: 0.75 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 170 }}><Box component="span" sx={{ fontWeight: 400 }}>En k€ TTC</Box></TableCell>
              {MOIS.map((_, i) => <EnTeteMois key={i} mois={i} enCours={i === enCours} sous={sous(i)} />)}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Encaissé en caisse</TableCell>
              {plan.mois.map((m, i) => (
                <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} title={m.encReel !== null ? `Réel ${entier(m.encReel)} €, prévu ${entier(m.encPrevu)} €` : `Prévu ${entier(m.encPrevu)} €`}
                  sx={m.encReel !== null ? { fontWeight: 700 } : { color: 'text.secondary' }}>
                  {k(m.encReel ?? m.encPrevu)}
                </TableCell>
              ))}
            </TableRow>
            {plan.mois.some((m) => m.encReel !== null) && (
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>Écart au prévu</TableCell>
                {plan.mois.map((m, i) => {
                  const niveau = niveauEcart(m.encReel, m.encPrevu, seuil)
                  return (
                    <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined}
                      sx={{ color: niveau === 'fort' ? 'error.main' : 'text.secondary', fontWeight: niveau === 'fort' ? 700 : 400 }}>
                      {m.encReel === null ? '' : ecartK(m.encReel - m.encPrevu)}
                    </TableCell>
                  )
                })}
              </TableRow>
            )}
            <TableRow>
              <TableCell>Décaissements prévus<Aide sujet="decaissements" compact /></TableCell>
              {plan.mois.map((m, i) => <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} sx={{ color: 'text.secondary' }}>{k(-m.decPrevu)}</TableCell>)}
            </TableRow>
            <TableRow className="ligne-cle">
              <TableCell>Trésorerie en fin de mois<Aide sujet="tresorerieFinMois" compact /></TableCell>
              {plan.mois.map((m, i) => {
                const v = m.finReelle ?? m.finPrevue
                return (
                  <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} title={m.finReelle !== null ? `Réel ${entier(m.finReelle)} €, prévu ${entier(m.finPrevue)} €` : `Prévu ${entier(m.finPrevue)} €`}
                    sx={{ color: v < 0 ? 'error.main' : undefined }}>
                    {k(v)}{m.finReelle !== null && <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}> réel</Box>}
                  </TableCell>
                )
              })}
            </TableRow>
            {plan.mois.some((m) => m.finProjetee !== null) && (
              <TableRow>
                <TableCell>Trésorerie projetée<Aide sujet="tresorerieGlissante" compact /></TableCell>
                {plan.mois.map((m, i) => (
                  <TableCell key={i} align="right" className={i === enCours ? 'en-cours' : undefined} sx={{ fontStyle: m.finReelle === null ? 'italic' : undefined, color: m.finProjetee !== null && m.finProjetee < 0 ? 'error.main' : undefined }}>
                    {m.finProjetee === null ? '' : k(m.finProjetee)}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </>) : (
      <TableContainer>
        <Table size="small" aria-label={`Trésorerie ${annee} par quadrimestre`} sx={{ ...styleTableau, minWidth: 560 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}><Box component="span" sx={{ fontWeight: 400 }}>En k€ TTC</Box></TableCell>
              {plan.quadrimestres.map((q) => <TableCell key={q.q} align="right">{QUADRIMESTRES_COURTS[q.q - 1]}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Trésorerie en début de période</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.debut} prevu={q.debutPrevu} niveau={niveauEcart(q.debut, q.debutPrevu, seuil)} format={k} />)}
            </TableRow>
            <TableRow>
              <TableCell>Encaissé en caisse</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.encReel} prevu={q.encPrevu} niveau={niveauEcart(q.encReel, q.encPrevu, seuil)} format={k} />)}
            </TableRow>
            <TableRow>
              <TableCell>Décaissé<Aide sujet="decaisseDeduit" compact /></TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.decReel} prevu={q.decPrevu} niveau={niveauEcart(q.decReel, q.decPrevu, seuil, true)} format={k} charge />)}
            </TableRow>
            <TableRow className="ligne-forte">
              <TableCell>Trésorerie en fin de période</TableCell>
              {plan.quadrimestres.map((q) => <CaseReelPrevu key={q.q} reel={q.fin} prevu={q.finPrevue} niveau={niveauEcart(q.fin, q.finPrevue, seuil)} format={k} fort />)}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      )}
      <Box sx={{ pb: 1.5 }} />
    </Card>
  )
}
