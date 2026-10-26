import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { Panne } from '../components/Panne'
import { anneeBudget, chargerParametres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { montant, taux } from '../lib/format'

export function Parametres() {
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerParametres(annee), [annee])
  const p = donnees?.parametres
  const lignes = p ? [
    { libelle: 'Redevance franchise', valeur: `${taux(p.tauxRedevance)} du CA HT` },
    { libelle: 'Publicité franchise', valeur: `${taux(p.tauxPublicite)} du CA HT` },
    { libelle: 'Impôt sur les sociétés, taux réduit', valeur: `${taux(p.impot.tauxReduit)} jusqu’à ${montant(p.impot.plafondTauxReduit)} de bénéfice` },
    { libelle: 'Impôt sur les sociétés, taux normal', valeur: taux(p.impot.tauxNormal) },
    { libelle: 'TVA moyenne du panier Cave', valeur: taux(p.tvaPanier.cave) },
    { libelle: 'TVA moyenne du panier Bar', valeur: taux(p.tvaPanier.bar) },
  ] : []

  return (
    <Box>
      <Typography variant="h1">Paramètres réseau</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Année {annee}{donnees && !donnees.enregistres ? ' · valeurs par défaut, pas encore enregistrées' : ''}
      </Typography>
      {erreur && <Panne quoi="Les paramètres" recharger={recharger} />}
      {chargement && <Skeleton variant="rounded" height={240} />}
      {p && (
        <Card>
          <Table aria-label={`Paramètres réseau ${annee}`}>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.libelle}>
                  <TableCell>{l.libelle}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{l.valeur}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </Box>
  )
}
