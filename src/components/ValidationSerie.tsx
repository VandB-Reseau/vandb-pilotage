import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import DoneAllOutlined from '@mui/icons-material/DoneAllOutlined'
import { changerStatut, departEstime, hypothesesDe, parametresDuBudget, type DonneesBudgets, type LigneMagasin } from '../data/pilotage'
import { pretsAValider } from '../moteur/changements'
import type { ParametresReseau } from '../moteur/types'

// Lot 42 (Joseph, 02/11/2026, proposition 6) : les budgets envoyés par le franchisé sans aucun changement par rapport au
// siège se valident ensemble ; le Responsable Régional ou le Directeur ne passe du temps que sur les budgets discutés.
// Valider fige, avec les hypothèses, la trésorerie au 1er janvier estimée quand le franchisé n'a pas saisi la sienne.
export function ValidationSerie({ d, parametres, annee, apres }: { d: DonneesBudgets; parametres: ParametresReseau; annee: number; apres: () => void }) {
  const prets = pretsAValider(d.magasins.filter((l) => l.base))
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  if (!prets.length && !message) return null

  const valider = async () => {
    setOccupe(true)
    setMessage(null)
    let ok = 0
    const echecs: string[] = []
    for (const l of prets as LigneMagasin[]) {
      try {
        const estimee = departEstime(l, d, parametresDuBudget(l, parametres))
        const h = hypothesesDe(l, d)
        if (!h) throw new Error()
        await changerStatut(l.magasin, annee, 'valide', estimee ? { ...h.hypotheses, departEstime: estimee } : h.hypotheses)
        ok++
      } catch {
        echecs.push(l.magasin)
      }
    }
    setOccupe(false)
    setMessage(echecs.length
      ? { gravite: 'error', texte: `${ok} budget${ok > 1 ? 's' : ''} validé${ok > 1 ? 's' : ''}. Pas abouti pour : ${echecs.join(', ')}. Vérifie ta connexion, puis réessaie.` }
      : { gravite: 'success', texte: `${ok} budget${ok > 1 ? 's' : ''} ${annee} validé${ok > 1 ? 's' : ''}.` })
    apres()
  }

  return (
    <Card component="section" aria-label="Budgets prêts à valider" sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderLeft: 4, borderColor: 'success.main' }}>
      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" sx={{ mb: prets.length ? 1.5 : 0 }} slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>}
      {prets.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h2">{prets.length === 1 ? '1 budget prêt à valider' : `${prets.length} budgets prêts à valider`}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Envoyés sans changement par rapport au siège : {prets.map((l) => l.magasin).join(', ')}.
            </Typography>
          </Box>
          <Button variant="contained" color="success" startIcon={<DoneAllOutlined />} disabled={occupe} onClick={() => void valider()} sx={{ minHeight: 48 }}>
            {prets.length === 1 ? 'Valider ce budget' : `Valider les ${prets.length}`}
          </Button>
        </Box>
      )}
    </Card>
  )
}
