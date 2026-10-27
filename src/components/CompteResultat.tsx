import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { montant, taux } from '../lib/format'
import type { Budget } from '../moteur/types'

// Compte de résultat annuel, montants et part du CA
export function CompteResultat({ b, titre, libelleTableau }: { b: Budget; titre: string; libelleTableau: string }) {
  const lignes = [
    { libelle: 'Chiffre d’affaires HT', valeur: b.ca, fort: true },
    { libelle: 'Achats consommés HT', valeur: -b.mois.reduce((a, m) => a + m.achats, 0) },
    { libelle: 'Marge commerciale', valeur: b.marge, fort: true },
    { libelle: 'Charges externes (redevance et publicité comprises)', valeur: -b.chargesExternes },
    { libelle: 'Impôts et taxes', valeur: -b.impotsTaxes },
    { libelle: 'Frais de personnel', valeur: -b.personnel },
    { libelle: 'Excédent brut d’exploitation', valeur: b.ebe, fort: true },
    { libelle: 'Résultat d’exploitation', valeur: b.resultatExploitation },
    { libelle: 'Résultat avant impôt', valeur: b.resultatAvantImpot },
    { libelle: 'Impôt sur les sociétés', valeur: -b.impot },
    { libelle: 'Résultat net', valeur: b.resultatNet, fort: true },
    { libelle: 'Trésorerie dégagée après emprunts', valeur: b.tresorerieDegagee },
  ]
  return (
    <Card component="section" aria-label={titre}>
      <Typography variant="h2" sx={{ p: 2, pb: 0 }}>{titre}</Typography>
      {/* Le compte de résultat se lit d'un bloc, sans défilement interne */}
      <TableContainer sx={{ maxHeight: 'none' }}>
        <Table aria-label={libelleTableau}>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.libelle}>
                <TableCell sx={{ fontWeight: l.fort ? 700 : 400 }}>{l.libelle}</TableCell>
                <TableCell align="right" sx={{ fontWeight: l.fort ? 700 : 400, whiteSpace: 'nowrap' }}>{montant(l.valeur)}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{taux(b.ca ? l.valeur / b.ca : 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}
