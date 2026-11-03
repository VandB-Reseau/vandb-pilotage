import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { Aide } from './Aide'
import type { Cibles } from '../moteur/cibles'
import { marquerRienPrevu, reponseQuestion, saisiesQuestion, type QuestionCalendrier } from '../moteur/questions'

// Joseph (03/11/2026) : une fois la carte ouverte, on voit ce qu'il faut remplir. Questions numérotées, chacune avec sa
// réponse ; « Oui » mène au bloc de saisie, « Rien de prévu » répond sans rien saisir. Évènements & Temps forts : temps
// forts et clients extérieurs ; Investissements & Financements : travaux, achats, emprunts.
export const ANCRES_QUESTIONS: Record<QuestionCalendrier, string> = {
  travaux: 'bloc-travaux', investissements: 'bloc-investissements', emprunts: 'bloc-emprunts', tempsForts: 'bloc-temps-forts', ajustementsCA: 'bloc-clients',
}

function textes(annee: number): Record<QuestionCalendrier, { question: string; court: string; un: string; plusieurs: string }> {
  return {
    travaux: { question: `Des travaux ou une fermeture en ${annee} ?`, court: 'travaux ou fermeture', un: 'chantier prévu', plusieurs: 'chantiers prévus' },
    investissements: { question: `Des achats d’équipement, de mobilier ou d’informatique en ${annee} ?`, court: 'achats d’équipement', un: 'achat prévu', plusieurs: 'achats prévus' },
    emprunts: { question: `Un nouvel emprunt ou un apport en ${annee} ?`, court: 'emprunt ou apport', un: 'financement prévu', plusieurs: 'financements prévus' },
    tempsForts: { question: `Des temps forts en ${annee} : salon, marché de Noël, soirée, opération commerciale ?`, court: 'temps forts', un: 'temps fort prévu', plusieurs: 'temps forts prévus' },
    ajustementsCA: { question: `Des clients extérieurs gagnés ou perdus face à ${annee - 1} : comité d’entreprise, association, restaurant ?`, court: 'clients extérieurs', un: 'client', plusieurs: 'clients' },
  }
}

export function QuestionsCalendrier({ cibles, annee, lectureSeule, onChange, questions, etat }: {
  cibles: Cibles
  annee: number
  lectureSeule: boolean
  onChange: (c: Cibles) => void
  questions: readonly QuestionCalendrier[]
  etat: 'aFaire' | 'aVerifier' | 'fait'
}) {
  const t = textes(annee)
  const fait = etat === 'fait'
  const allerA = (q: QuestionCalendrier) => document.getElementById(ANCRES_QUESTIONS[q])?.scrollIntoView({ block: 'start' })
  return (
    <Card component="section" aria-label={`Questions : ${questions.map((q) => t[q].court).join(', ')}`} sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>{`À répondre pour ${annee}`}<Aide sujet="questionsCalendrier" /></Typography>
        <Chip size="small" color={fait ? 'success' : 'warning'} label={fait ? 'Fait' : 'À faire'} />
      </Box>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {questions.map((q, i) => {
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
