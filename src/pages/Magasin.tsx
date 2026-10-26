import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
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
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import { useAuth } from '../auth/AuthContext'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { PastilleStatut } from '../components/PastilleStatut'
import { lignesCibles, TableauCibles } from '../components/TableauCibles'
import {
  anneeBudget, changerStatut, chargerBudgets, chargerParametres, enregistrerAjustements, hypothesesDe, niveauxDe, proposerBudget, valeursSansCible,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { lirePrevisionnel, ModeleInconnu } from '../import/previsionnel'
import { lireClasseur } from '../import/xlsx'
import { montant, milliers, taux } from '../lib/format'
import { calculerBudget } from '../moteur/budget'
import { appliquerCibles, ecarts, type Cibles } from '../moteur/cibles'

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

type Message = { gravite: 'success' | 'error' | 'warning'; texte: string; details?: string[] }

export function Magasin() {
  const { nom = '' } = useParams()
  const { profil } = useAuth()
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee)]).then(([d, p]) => ({ d, parametres: p.parametres })), [nom, annee])
  const [brouillon, setBrouillon] = useState<Cibles>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [occupe, setOccupe] = useState(false)
  const fichier = useRef<HTMLInputElement>(null)

  const ligne = donnees?.d.magasins.find((l) => l.magasin === nom) ?? null
  useEffect(() => { setBrouillon(ligne?.ajustements ?? {}) }, [ligne])

  const directeur = profil?.role === 'directeur'
  const retour = <Button component={RouterLink} to="/" startIcon={<ArrowBack />} sx={{ mb: 2, minHeight: 48 }}>Magasins</Button>

  if (chargement && !donnees) return <Box>{retour}<Skeleton variant="rounded" height={160} /></Box>
  if (erreur) return <Box>{retour}<Panne quoi="Les chiffres du magasin" recharger={recharger} /></Box>
  if (!donnees || !ligne) {
    return <Box>{retour}<EtatVide titre="Ce magasin n’est pas dans ton périmètre" texte="Il n’apparaît pas parmi les magasins rattachés à ton compte. Reviens à la liste pour choisir un de tes magasins." /></Box>
  }

  const { d, parametres } = donnees
  const resolu = hypothesesDe(ligne, d, brouillon)
  const b = resolu ? calculerBudget(resolu.hypotheses, parametres) : null
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(ligne.ajustements)
  const peutAjuster = (directeur || profil?.role === 'franchise') && !!ligne.base && ligne.statut !== 'valide'
  const nbEcarts = resolu ? ecarts(resolu.provenance).length : 0

  const agir = async (action: () => Promise<void>, reussite: string) => {
    setOccupe(true)
    setMessage(null)
    try {
      await action()
      setMessage({ gravite: 'success', texte: reussite })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  const importer = async (f: File) => {
    setOccupe(true)
    setMessage(null)
    try {
      const { base, alertes } = lirePrevisionnel(await lireClasseur(await f.arrayBuffer()), annee)
      const hypotheses = appliquerCibles(base, niveauxDe(ligne, d)).hypotheses
      try {
        await proposerBudget(ligne.magasin, annee, base, hypotheses)
      } catch {
        setMessage({ gravite: 'error', texte: 'Le prévisionnel est lu, mais le budget n’a pas pu être enregistré. Vérifie ta connexion, puis réessaie.' })
        return
      }
      setMessage({ gravite: alertes.length ? 'warning' : 'success', texte: `Prévisionnel importé : budget ${annee} proposé au magasin.`, details: alertes })
      recharger()
    } catch (e) {
      setMessage({
        gravite: 'error',
        texte: e instanceof ModeleInconnu
          ? `Ce classeur n’est pas le prévisionnel du réseau : il lui manque ${e.onglets.length > 1 ? 'les onglets' : 'l’onglet'} « ${e.onglets.join(' », « ')} ».`
          : 'Ce fichier ne s’ouvre pas comme un classeur Excel (.xlsx). Enregistre-le au format .xlsx, puis réessaie.',
      })
    } finally {
      setOccupe(false)
      if (fichier.current) fichier.current.value = ''
    }
  }

  const boutonImport = directeur && (
    <>
      <input ref={fichier} type="file" accept=".xlsx" hidden aria-label="Prévisionnel Excel du magasin" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importer(f) }} />
      <Button variant={ligne.base ? 'outlined' : 'contained'} startIcon={<UploadFileOutlined />} disabled={occupe} onClick={() => fichier.current?.click()} sx={{ minHeight: 48 }}>
        {ligne.base ? 'Réimporter le prévisionnel' : 'Importer le prévisionnel'}
      </Button>
    </>
  )

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
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Budget {annee}{ligne.base ? ` · ${nbEcarts === 0 ? 'aucun écart' : nbEcarts === 1 ? '1 écart' : `${nbEcarts} écarts`} aux cibles du siège` : ''}
      </Typography>

      {message && (
        <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }} sx={{ mb: 3 }}>
          {message.texte}
          {message.details?.length ? <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>{message.details.map((t) => <li key={t}>{t}</li>)}</Box> : null}
        </Alert>
      )}

      {!b ? (
        <EtatVide
          titre={`Pas encore de budget ${annee}`}
          texte={directeur
            ? `Le budget part du prévisionnel Excel du magasin : son réalisé, ses salaires, ses frais et ses emprunts. Les objectifs viennent des cibles du réseau et de son groupe.`
            : `Le siège n’a pas encore proposé de budget ${annee} pour ce magasin. Il apparaîtra ici dès sa proposition.`}
          action={boutonImport || undefined}
        />
      ) : (
        <Stack spacing={3}>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Indicateurs clés">
            <Indicateur libelle="Chiffre d’affaires HT" valeur={milliers(b.ca)} detail={`Atterrissage de l’année en cours : ${milliers(b.atterrissage)}`} />
            <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} />
            <Indicateur libelle="Masse salariale / marge" valeur={taux(b.ratios.personnelSurMarge)} detail={`${taux(b.ratios.personnelSurCA)} du CA`} />
            <Indicateur libelle="EBE" valeur={milliers(b.ebe)} detail={`${taux(b.ratios.ebeSurCA)} du CA`} />
            <Indicateur libelle="Résultat net" valeur={milliers(b.resultatNet)} detail={`Impôt : ${milliers(b.impot)}`} />
          </Stack>

          {(directeur || modifie) && (
            <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap' }} aria-label="Actions sur le budget">
              {peutAjuster && modifie && (
                <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe} sx={{ minHeight: 48 }}
                  onClick={() => resolu && void agir(() => enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses),
                    directeur ? 'Ajustements enregistrés.' : 'Ajustements enregistrés : le budget est en discussion avec le siège.')}>
                  Enregistrer les ajustements
                </Button>
              )}
              {directeur && ligne.base && ligne.statut !== 'valide' && (
                <Button variant={modifie ? 'outlined' : 'contained'} color="success" startIcon={<CheckCircleOutlined />} disabled={occupe} sx={{ minHeight: 48 }}
                  onClick={() => resolu && void agir(async () => {
                    if (modifie) await enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses)
                    await changerStatut(ligne.magasin, annee, 'valide', resolu.hypotheses)
                  }, `Budget ${annee} validé.`)}>
                  Valider le budget
                </Button>
              )}
              {directeur && ligne.statut === 'valide' && resolu && (
                <Button variant="outlined" startIcon={<LockOpenOutlined />} disabled={occupe} sx={{ minHeight: 48 }}
                  onClick={() => void agir(() => changerStatut(ligne.magasin, annee, 'en_discussion', resolu.hypotheses), 'Budget rouvert : il est de nouveau en discussion.')}>
                  Rouvrir la discussion
                </Button>
              )}
              {boutonImport}
            </Stack>
          )}

          {ligne.base && resolu && (
            <Card component="section" aria-label="Hypothèses du magasin">
              <Typography variant="h2" sx={{ p: 2, pb: 1 }}>Hypothèses</Typography>
              <TableContainer>
                <TableauCibles
                  titre="Hypothèses du magasin"
                  lignes={lignesCibles(ligne.base.familles, false, (['cave', 'bar'] as const).filter((u) => ligne.base?.flux?.[u]))}
                  niveau="magasin"
                  cibles={brouillon}
                  auDessus={niveauxDe(ligne, d).slice(0, 2)}
                  valeursBase={valeursSansCible(ligne.base)}
                  onChange={setBrouillon}
                  lectureSeule={!peutAjuster}
                />
              </TableContainer>
            </Card>
          )}

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
