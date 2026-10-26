import { Link as RouterLink, useParams } from 'react-router-dom'
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
import ArrowBack from '@mui/icons-material/ArrowBack'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { anneeBudget, chargerMagasins, chargerParametres } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { montant, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

function Indicateur({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) {
  return (
    <Card sx={{ p: 2, flex: '1 1 160px' }}>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography variant="h3" component="p" sx={{ mt: 0.5 }}>{valeur}</Typography>
      {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
    </Card>
  )
}

export function Magasin() {
  const { nom = '' } = useParams()
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(async () => {
    const [lignes, { parametres }] = await Promise.all([chargerMagasins(annee), chargerParametres(annee)])
    const ligne = lignes.find((l) => l.magasin === nom) ?? null
    return { ligne, budget: ligne?.hypotheses ? calculerBudget(ligne.hypotheses, parametres) : null }
  }, [nom, annee])

  const retour = <Button component={RouterLink} to="/" startIcon={<ArrowBack />} sx={{ mb: 2, minHeight: 48 }}>Magasins</Button>

  if (chargement) return <Box>{retour}<Skeleton variant="rounded" height={160} /></Box>
  if (erreur) return <Box>{retour}<Panne quoi="Les chiffres du magasin" recharger={recharger} /></Box>
  if (!donnees?.ligne) {
    return <Box>{retour}<EtatVide titre="Ce magasin n’est pas dans ton périmètre" texte="Il n’apparaît pas parmi les magasins rattachés à ton compte. Reviens à la liste pour choisir un de tes magasins." /></Box>
  }

  const { ligne, budget: b } = donnees
  const lignesResultat = b ? [
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
  ] : []

  return (
    <Box>
      {retour}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h1">{ligne.magasin}</Typography>
        <PastilleStatut statut={ligne.statut} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Budget {annee}</Typography>

      {!b ? (
        <EtatVide titre={`Pas encore de budget ${annee}`} texte={`Le siège n’a pas encore proposé de budget ${annee} pour ce magasin. Il apparaîtra ici dès sa proposition.`} />
      ) : (
        <Stack spacing={3}>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Indicateurs clés">
            <Indicateur libelle="Chiffre d’affaires HT" valeur={milliers(b.ca)} detail={`Atterrissage de l’année en cours : ${milliers(b.atterrissage)}`} />
            <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} />
            <Indicateur libelle="Masse salariale / marge" valeur={taux(b.ratios.personnelSurMarge)} detail={`${taux(b.ratios.personnelSurCA)} du CA`} />
            <Indicateur libelle="EBE" valeur={milliers(b.ebe)} detail={`${taux(b.ratios.ebeSurCA)} du CA`} />
            <Indicateur libelle="Résultat net" valeur={milliers(b.resultatNet)} detail={`Impôt : ${milliers(b.impot)}`} />
          </Stack>

          <Card component="section" aria-label="Compte de résultat">
            <Typography variant="h2" sx={{ p: 2, pb: 0 }}>Compte de résultat</Typography>
            {/* Le compte de résultat se lit d'un bloc, sans défilement interne */}
            <TableContainer sx={{ maxHeight: 'none' }}>
              <Table aria-label="Compte de résultat annuel">
                <TableBody>
                  {lignesResultat.map((l) => (
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

          <Card component="section" aria-label="Mois par mois">
            <Typography variant="h2" sx={{ p: 2, pb: 0 }}>Mois par mois</Typography>
            <TableContainer>
              <Table className="colonne-fixe" aria-label="Budget mois par mois">
                <TableHead>
                  <TableRow>
                    <TableCell>Mois</TableCell>
                    <TableCell align="right">CA HT</TableCell>
                    <TableCell align="right">Marge</TableCell>
                    <TableCell align="right">Personnel</TableCell>
                    <TableCell align="right">EBE</TableCell>
                    <TableCell align="right">CA par heure</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {b.mois.map((m, i) => (
                    <TableRow key={MOIS[i]}>
                      <TableCell>{MOIS[i]}</TableCell>
                      <TableCell align="right">{montant(m.ca)}</TableCell>
                      <TableCell align="right">{montant(m.marge)}</TableCell>
                      <TableCell align="right">{montant(m.personnel)}</TableCell>
                      <TableCell align="right" sx={{ color: m.ebe < 0 ? 'error.main' : undefined, fontWeight: m.ebe < 0 ? 700 : 400 }}>{montant(m.ebe)}</TableCell>
                      <TableCell align="right">{m.productivite === null ? '' : montant(m.productivite)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Stack>
      )}
    </Box>
  )
}
