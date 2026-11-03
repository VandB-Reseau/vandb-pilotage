import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from './ChampNombre'
import { useSaisieEnCours } from './GardeSaisie'
import { SectionParametres } from './SectionParametres'
import { enregistrerParametres } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { BORNES_REGLES, reglesDe, reglesHorsBornes, reglesParDefaut } from '../moteur/regles'
import type { ParametresReseau, ReglesCalcul } from '../moteur/types'

type Cle = keyof ReglesCalcul
// Lot 40 : règles de calcul, rangées par usage. Libellés : ce que la règle change, dans les mots du terrain.
const GROUPES: { titre: string; regles: { cle: Cle; libelle: string; unite: string }[] }[] = [
  {
    titre: 'Atterrissage de l’année en cours',
    regles: [
      { cle: 'jeuneMagasin', libelle: 'Magasin en montée en charge tant qu’il a moins de', unite: 'mois' },
      { cle: 'moisRythme', libelle: 'Rythme récent : derniers mois réalisés pris en compte', unite: 'mois' },
      { cle: 'ecartRythme', libelle: 'Rythme récent suivi d’office tant qu’il s’écarte de moins de', unite: '%' },
    ],
  },
  {
    titre: 'Budget',
    regles: [{ cle: 'seuilRythme', libelle: 'Rythme de sortie retenu d’office tant qu’il s’écarte de l’atterrissage de moins de', unite: '%' }],
  },
  {
    titre: 'Médianes du réseau',
    regles: [
      { cle: 'magasinsSaisonnalite', libelle: 'Saisonnalité du réseau publiée à partir de (magasins avec 12 mois)', unite: 'magasins' },
      { cle: 'magasinsCalage', libelle: 'Tickets et panier par ancienneté publiés à partir de', unite: 'magasins' },
      { cle: 'magasinsFamille', libelle: 'Familles face au réseau publiées à partir de', unite: 'magasins' },
    ],
  },
  {
    titre: 'Alertes',
    regles: [{ cle: 'moisCommerciaux', libelle: 'Tickets et panier comparés à l’an dernier sur les derniers', unite: 'mois' }],
  },
]
export const LIBELLES_REGLES: Record<Cle, string> = Object.fromEntries(GROUPES.flatMap((g) => g.regles.map((r) => [r.cle, r.libelle]))) as Record<Cle, string>

const versTexte = (r: ReglesCalcul) => Object.fromEntries((Object.keys(BORNES_REGLES) as Cle[]).map((k) =>
  [k, String(BORNES_REGLES[k].taux ? Math.round(r[k] * 1000) / 10 : r[k]).replace('.', ',')])) as Record<Cle, string>
const bornes = (k: Cle) => { const b = BORNES_REGLES[k]; return b.taux ? `${b.min * 100} à ${b.max * 100} %` : `${b.min} à ${b.max}` }

export function ReglesCalculParametres({ annee, parametres, lecture, onEnregistre, onModifie }: {
  annee: number
  parametres: ParametresReseau
  lecture: boolean
  onEnregistre: () => void
  onModifie: (m: boolean) => void
}) {
  const enregistrees = reglesDe(parametres)
  const [textes, setTextes] = useState(() => versTexte(enregistrees))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const empreinte = JSON.stringify(enregistrees)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setTextes(versTexte(enregistrees)), [empreinte])

  const lues = Object.fromEntries((Object.keys(textes) as Cle[]).map((k) => {
    const n = nombre(textes[k])
    return [k, n === null ? NaN : BORNES_REGLES[k].taux ? Math.round(n * 10) / 1000 : n]
  })) as unknown as ReglesCalcul
  const hors = reglesHorsBornes(lues)
  const modifiees = JSON.stringify(lues) !== empreinte
  useSaisieEnCours(!lecture && modifiees)
  useEffect(() => { onModifie(!lecture && modifiees) }, [lecture, modifiees, onModifie])

  const enregistrer = async () => {
    if (hors.length) return
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerParametres(annee, { ...parametres, regles: lues })
      setMessage({ gravite: 'success', texte: `Règles de calcul ${annee} enregistrées.` })
      onEnregistre()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  return (
    <SectionParametres nom="Règles de calcul" titre={`Règles de calcul ${annee}`} parDefaut={JSON.stringify(enregistrees) === JSON.stringify(reglesParDefaut)}
      action={lecture ? undefined : (
        <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !modifiees || hors.length > 0} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
      )}>
      {message && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>
        </Box>
      )}
      {hors.length > 0 && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="warning">
            {hors.map((k) => `${LIBELLES_REGLES[k]} : de ${bornes(k)}${BORNES_REGLES[k].taux ? '' : ', nombre entier'}.`).join(' ')}
          </Alert>
        </Box>
      )}
      <Table aria-label={`Règles de calcul ${annee}`}>
        {GROUPES.map((g) => (
          <TableBody key={g.titre}>
            <TableRow><TableCell colSpan={2} sx={{ fontWeight: 700, bgcolor: 'action.hover' }}>{g.titre}</TableCell></TableRow>
            {g.regles.map((r) => (
              <TableRow key={r.cle}>
                <TableCell>{r.libelle}</TableCell>
                <TableCell align="right">
                  <ChampNombre libelle={r.libelle} valeur={textes[r.cle]} unite={r.unite} largeur={r.unite === 'magasins' ? 150 : 120}
                    onChange={(v) => setTextes((t) => ({ ...t, [r.cle]: v }))} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        ))}
      </Table>
    </SectionParametres>
  )
}
