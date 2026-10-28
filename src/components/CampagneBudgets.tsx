import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { chargerReelDuCompte, type Statut } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { avancementCampagne, type Avancement, type Campagne } from '../moteur/campagne'

const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
const COLONNES: { cle: Exclude<keyof Avancement, 'nom'>; libelle: string }[] = [
  { cle: 'magasins', libelle: 'Magasins' }, { cle: 'aProposer', libelle: 'À proposer' }, { cle: 'proposes', libelle: 'Proposés' },
  { cle: 'enDiscussion', libelle: 'En discussion' }, { cle: 'valides', libelle: 'Validés' }, { cle: 'enRetard', libelle: 'En retard' },
]

function Tableau({ titre, lignes, sansNom }: { titre: string; lignes: Avancement[]; sansNom: string }) {
  return (
    <TableContainer>
      <Table size="small" aria-label={titre} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
        <TableHead>
          <TableRow>
            <TableCell>{titre}</TableCell>
            {COLONNES.map((c) => <TableCell key={c.cle} align="right">{c.libelle}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {lignes.map((l) => (
            <TableRow key={l.nom}>
              <TableCell sx={{ fontWeight: 600 }}>{l.nom || sansNom}</TableCell>
              {COLONNES.map((c) => (
                <TableCell key={c.cle} align="right" sx={c.cle === 'enRetard' && l.enRetard ? { color: 'error.main', fontWeight: 700 } : undefined}>{l[c.cle]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// Campagne des budgets (lot 28) : les trois dates du Directeur et l'avancement par Responsable Régional et par Coach
export function CampagneBudgets({ annee, campagne, magasins, aujourdhui }: {
  annee: number
  campagne: Campagne
  magasins: { magasin: string; statut: Statut | null }[]
  aujourdhui: string
}) {
  // Coach et RR de chaque magasin : tenus dans l'app du réseau ; sans eux, l'avancement global reste
  const { donnees } = useChargement(() => chargerReelDuCompte(new Date().getFullYear()).catch(() => null), [])
  const total = avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: ['Tout le périmètre'] })), campagne, aujourdhui)[0]
  if (!total) return null
  const parRR = donnees && Object.keys(donnees.rrs).length
    ? avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: donnees.rrs[m.magasin] ?? [] })), campagne, aujourdhui) : []
  const parCoach = donnees && Object.keys(donnees.coachs).length
    ? avancementCampagne(magasins.map((m) => ({ statut: m.statut, responsables: donnees.coachs[m.magasin] ? [donnees.coachs[m.magasin]] : [] })), campagne, aujourdhui) : []
  const etape = aujourdhui <= campagne.proposition ? `Propositions attendues avant le ${jour(campagne.proposition)}`
    : aujourdhui <= campagne.retour ? `Retours des franchisés attendus avant le ${jour(campagne.retour)}`
      : aujourdhui <= campagne.validation ? `Validations attendues avant le ${jour(campagne.validation)}` : `Campagne close depuis le ${jour(campagne.validation)}`

  return (
    <Card component="section" aria-label={`Campagne des budgets ${annee}`}>
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Typography variant="h2">Campagne des budgets {annee}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {etape} · {total.valides} validé{total.valides > 1 ? 's' : ''} sur {total.magasins}
          {total.enRetard > 0 && <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}> · {total.enRetard} en retard</Box>}
        </Typography>
      </Box>
      {parRR.length > 0 && <Tableau titre="Par Responsable Régional" lignes={parRR} sansNom="Sans Responsable Régional" />}
      {parCoach.length > 0 && <Box sx={{ mt: parRR.length ? 2 : 0 }}><Tableau titre="Par Coach" lignes={parCoach} sansNom="Sans Coach" /></Box>}
    </Card>
  )
}
