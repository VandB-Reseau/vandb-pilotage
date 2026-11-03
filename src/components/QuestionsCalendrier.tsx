import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import type { Cibles } from '../moteur/cibles'
import { etatCalendrier, marquerRienPrevu, QUESTIONS_CALENDRIER, reponseQuestion, saisiesQuestion, type QuestionCalendrier } from '../moteur/questions'

// Joseph (03/11/2026) : une fois la carte Calendrier ouverte, on voit ce qu'il faut remplir. Trois questions numérotées,
// chacune avec sa réponse ; « Oui » mène au bloc de saisie, « Rien de prévu » répond sans rien saisir.
export const ANCRES_QUESTIONS: Record<QuestionCalendrier, string> = { travaux: 'bloc-travaux', tempsForts: 'bloc-temps-forts', ajustementsCA: 'bloc-clients' }

function textes(annee: number): Record<QuestionCalendrier, { question: string; court: string; un: string; plusieurs: string }> {
  return {
    travaux: { question: `Des travaux ou une fermeture en ${annee} ?`, court: 'travaux ou fermeture', un: 'mois touché', plusieurs: 'mois touchés' },
    tempsForts: { question: `Des temps forts en ${annee} : salon, marché de Noël, soirée, opération commerciale ?`, court: 'temps forts', un: 'temps fort prévu', plusieurs: 'temps forts prévus' },
    ajustementsCA: { question: 'Des clients gagnés ou perdus : nouveau marché, association, concurrent, horaires ?', court: 'clients gagnés ou perdus', un: 'changement prévu', plusieurs: 'changements prévus' },
  }
}

export function QuestionsCalendrier({ cibles, annee, lectureSeule, onChange }: {
  cibles: Cibles
  annee: number
  lectureSeule: boolean
  onChange: (c: Cibles) => void
}) {
  const t = textes(annee)
  const fait = etatCalendrier(cibles) === 'fait'
  const allerA = (q: QuestionCalendrier) => document.getElementById(ANCRES_QUESTIONS[q])?.scrollIntoView({ block: 'start' })
  return (
    <Card component="section" aria-label="Questions du calendrier" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>{`À répondre pour ${annee}`}<Aide sujet="questionsCalendrier" /></Typography>
        <Chip size="small" color={fait ? 'success' : 'warning'} label={fait ? 'Fait' : 'À faire'} />
      </Box>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {QUESTIONS_CALENDRIER.map((q, i) => {
          const r = reponseQuestion(cibles, q)
          const n = saisiesQuestion(cibles, q)
          return (
            <Box component="li" key={q} aria-label={t[q].question}
              sx={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 0.5, flexWrap: 'wrap', py: 1, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
              <Typography sx={{ flex: '1 1 320px', fontWeight: 600 }}>{`${i + 1}. ${t[q].question}`}</Typography>
              <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600, color: r === 'aRepondre' ? 'warning.dark' : 'text.primary' }}>
                {r === 'saisie' ? `Oui, ${n} ${n > 1 ? t[q].plusieurs : t[q].un}` : r === 'rien' ? 'Rien de prévu' : 'À répondre'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {r === 'saisie' && <Button onClick={() => allerA(q)} aria-label={`Voir : ${t[q].court}`} sx={{ minHeight: 48 }}>Voir</Button>}
                {r !== 'saisie' && !lectureSeule && (
                  <Button variant={r === 'aRepondre' ? 'contained' : 'outlined'} onClick={() => allerA(q)} aria-label={`Oui, saisir : ${t[q].court}`} sx={{ minHeight: 48 }}>Oui, saisir</Button>
                )}
                {r === 'aRepondre' && !lectureSeule && (
                  <Button variant="outlined" onClick={() => onChange(marquerRienPrevu(cibles, q, true))} aria-label={`Rien de prévu : ${t[q].court}`} sx={{ minHeight: 48 }}>Rien de prévu</Button>
                )}
                {r === 'rien' && !lectureSeule && (
                  <Button onClick={() => onChange(marquerRienPrevu(cibles, q, false))} aria-label={`Annuler la réponse : ${t[q].court}`} sx={{ minHeight: 48 }}>Annuler</Button>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Card>
  )
}
