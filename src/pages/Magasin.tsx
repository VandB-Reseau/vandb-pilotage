import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import TableContainer from '@mui/material/TableContainer'
import Tabs from '@mui/material/Tabs'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import { useAuth } from '../auth/AuthContext'
import { AFaireFranchise } from '../components/AFaireFranchise'
import { BarreEnregistrement } from '../components/BarreEnregistrement'
import { EchangesBudget } from '../components/EchangesBudget'
import { AlertesEtActions } from '../components/PlanAction'
import { AtterrissageMagasin } from '../components/AtterrissageMagasin'
import { DetailCalcul } from '../components/DetailCalcul'
import { VersionsBudget } from '../components/VersionsBudget'
import { CompteResultatMois } from '../components/CompteResultatMois'
import { CopieHypotheses } from '../components/CopieHypotheses'
import { EtatVide } from '../components/EtatVide'
import { Indicateur } from '../components/Indicateur'
import { Panne } from '../components/Panne'
import { EquipeMagasin } from '../components/EquipeMagasin'
import { FraisMagasin } from '../components/FraisMagasin'
import { useGarde, useSaisieEnCours } from '../components/GardeSaisie'
import { PastilleStatut } from '../components/PastilleStatut'
import { ComparaisonMagasin } from '../components/ComparaisonMagasin'
import { QuadrimestresMagasin } from '../components/QuadrimestresMagasin'
import { ReelAnnee } from '../components/ReelAnnee'
import { poidsValides, SaisonnaliteMagasin } from '../components/SaisonnaliteMagasin'
import { SuiviBudget } from '../components/SuiviBudget'
import { TravauxMagasin } from '../components/TravauxMagasin'
import { AjustementsCAMagasin } from '../components/AjustementsCAMagasin'
import { BaseCAMagasin } from '../components/BaseCAMagasin'
import { TempsFortsMagasin } from '../components/TempsFortsMagasin'
import { TresorerieBudget } from '../components/TresorerieBudget'
import { EconomieFranchise } from '../components/EconomieFranchise'
import { FamillesReseau } from '../components/FamillesReseau'
import { SyntheseMagasin } from '../components/SyntheseMagasin'
import { GrilleHypotheses } from '../components/GrilleHypotheses'
import { lignesCibles, TableauCibles } from '../components/TableauCibles'
import {
  anneeBudget, changerStatut, chargerBudgets, chargerParametres, chargerReel, enregistrerAjustements, hypothesesDe, niveauxDe, statutLibelle, valeursSansCible,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { nombreChangements, reelEnRetard } from '../lib/aFaire'
import { feuillesBudget } from '../lib/exports'
import { lienMagasin, milliers, taux } from '../lib/format'
import { classeur, nomFichier, telecharger } from '../lib/xlsx'
import { syntheseReel } from '../moteur/reel'
import { calculerBudget, effetTravaux } from '../moteur/budget'
import { campagneDe } from '../moteur/campagne'
import { compteResultat } from '../moteur/compteResultat'
import { tresorerieBudget } from '../moteur/tresorerie'
import { ajustementsCopies, ecarts, valeurHeritee, type Cibles } from '../moteur/cibles'


// Onglet avec une pastille quand il manque quelque chose ; le détail est lu par les lecteurs d'écran
function LibelleOnglet({ texte, manque, detail }: { texte: string; manque: boolean; detail: string }) {
  return (
    <Badge variant="dot" color="warning" invisible={!manque} sx={{ '& .MuiBadge-dot': { right: -6, top: 2 } }}>
      {texte}{manque && <Box component="span" sx={visuellementCache}> ({detail})</Box>}
    </Badge>
  )
}
// Lot 27 : espaces de la fiche ; chaque partie (ancien onglet) appartient à un espace. « budget » : les hypothèses.
type Espace = 'synthese' | 'annee' | 'budget'
const PARTIES_ANNEE = ['reel', 'suivi', 'atterrissage', 'quadrimestres']
const espaceDe = (o: string): Espace => (o === 'synthese' ? 'synthese' : PARTIES_ANNEE.includes(o) ? 'annee' : 'budget')
type Partie = { cle: string; libelle: string; manque?: boolean; detail?: string }

const visuellementCache = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

type Message = { gravite: 'success' | 'error' | 'warning'; texte: string; details?: string[] }

export function Magasin() {
  const { nom = '' } = useParams()
  const { profil } = useAuth()
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerParametres(new Date().getFullYear())])
      .then(([d, p, pN]) => ({ d, parametres: p.parametres, parametresN: pN.parametres })), [nom, annee])
  const [brouillon, setBrouillon] = useState<Cibles>({})
  const [message, setMessage] = useState<Message | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [copie, setCopie] = useState(false)
  // Action préparée depuis les leviers commerciaux de la synthèse (lot 28) : le plan d'action s'ouvre pré-rempli
  const [proposition, setProposition] = useState<{ intitule: string; n: number } | null>(null)
  // Budget de l'an prochain, réel de l'année en cours et de la précédente
  const anneeEnCours = new Date().getFullYear()
  // Synthèse d'abord : la santé du magasin en un coup d'œil
  const [onglet, setOnglet] = useState((useLocation().state as { onglet?: string } | null)?.onglet ?? 'synthese')
  const [dernieres, setDernieres] = useState<Record<Exclude<Espace, 'synthese'>, string>>({ annee: 'reel', budget: 'budget' })
  const [anneeReel, setAnneeReel] = useState(anneeEnCours)
  const [anneeQuadri, setAnneeQuadri] = useState(anneeEnCours)

  const ligne = donnees?.d.magasins.find((l) => l.magasin === nom) ?? null
  useEffect(() => { setBrouillon(ligne?.ajustements ?? {}) }, [ligne])
  useSaisieEnCours(!!ligne && JSON.stringify(brouillon) !== JSON.stringify(ligne.ajustements))
  const garde = useGarde()
  // Réel de l'année : pastille de l'onglet si le dernier mois terminé manque (gardé en mémoire pour les onglets Réel et Atterrissage)
  const reel = useChargement(() => chargerReel(nom, anneeEnCours), [nom, anneeEnCours])
  // Magasins de la liste d'où l'on vient (filtres compris), pour passer au précédent ou au suivant
  const { state } = useLocation() as { state: { liste?: string[]; retour?: string; depuis?: { chemin: string; nom: string } } | null }

  const directeur = profil?.role === 'directeur'
  const peutSaisir = !!profil && profil.role !== 'aucun'
  const franchise = profil?.role === 'franchise'
  const seul = franchise && donnees?.d.magasins.length === 1
  const liste = (state?.liste ?? donnees?.d.magasins.map((l) => l.magasin) ?? []).filter((m) => donnees?.d.magasins.some((l) => l.magasin === m))
  const rang = liste.indexOf(nom)
  const voisin = (pas: number) => (rang < 0 || liste.length < 2 ? null : liste[(rang + pas + liste.length) % liste.length])
  const precedent = voisin(-1), suivant = voisin(1)
  const retour = seul ? null : (
    <Box className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      <Button component={RouterLink} to={`${state?.depuis?.chemin ?? '/'}${state?.retour ? `?${state.retour}` : ''}`} startIcon={<ArrowBack />} sx={{ minHeight: 48 }}>{state?.depuis?.nom ?? 'Magasins'}</Button>
      <Box sx={{ flex: 1 }} />
      {precedent && (
        <Button component={RouterLink} to={lienMagasin(precedent)} state={state} startIcon={<ChevronLeftOutlined />} aria-label={`Magasin précédent : ${precedent}`} sx={{ minHeight: 48, maxWidth: 260 }}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'inline' } }}>{precedent}</Box>
        </Button>
      )}
      {suivant && (
        <Button component={RouterLink} to={lienMagasin(suivant)} state={state} endIcon={<ChevronRightOutlined />} aria-label={`Magasin suivant : ${suivant}`} sx={{ minHeight: 48, maxWidth: 260 }}>
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'inline' } }}>{suivant}</Box>
        </Button>
      )}
    </Box>
  )

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
  const enregistrable = poidsValides(brouillon.poidsMois)
  // Effet des travaux : même budget sans eux
  const tresorerie = b && resolu ? tresorerieBudget(b, resolu.hypotheses, parametres, parametres.tresorerie, brouillon.tresorerieDepart ?? 0) : null
  const sansTravaux = resolu?.hypotheses.travaux ? calculerBudget({ ...resolu.hypotheses, travaux: undefined }, parametres) : null
  // Copie : magasins dont le budget est proposé ou en discussion
  const destinations = d.magasins.filter((l) => l.magasin !== ligne.magasin && l.base && l.statut && l.statut !== 'valide')
  const copier = (vers: string[]) => void agir(async () => {
    for (const nom of vers) {
      const cible = destinations.find((l) => l.magasin === nom)
      if (!cible) continue
      const ajustements = ajustementsCopies(ligne.ajustements, cible.ajustements)
      const h = hypothesesDe(cible, d, ajustements)
      if (h) await enregistrerAjustements(nom, annee, ajustements, h.hypotheses)
    }
    setCopie(false)
  }, vers.length > 1 ? `Hypothèses copiées vers ${vers.length} magasins.` : `Hypothèses copiées vers ${vers[0]}.`)

  // Export du budget tel qu'à l'écran, ajustements en cours compris
  const exporter = () => {
    if (!b || !resolu) return
    const statut = `${ligne.statut ? statutLibelle[ligne.statut] : 'Pas encore proposé'}${modifie ? ', ajustements non enregistrés' : ''}`
    telecharger(nomFichier(`Budget ${annee} - ${ligne.magasin}`),
      classeur(feuillesBudget({ magasin: ligne.magasin, annee, statut, lignes: compteResultat(b, resolu.hypotheses, parametres), familles: b.familles, flux: b.flux, tresorerie })))
  }

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


  // Lot 27 : trois espaces (synthèse, année en cours, budget) découpés en parties ; on garde la dernière partie de chaque espace
  const espace = espaceDe(onglet)
  const aller = (o: string) => { setOnglet(o); if (espaceDe(o) !== 'synthese') setDernieres((d) => ({ ...d, [espaceDe(o)]: o })) }
  const changerEspace = (e: Espace) => garde(() => { setBrouillon(ligne.ajustements); aller(e === 'synthese' ? 'synthese' : dernieres[e]) })
  const reelRetard = !!reel.donnees && reelEnRetard(syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes)
  const partiesAnnee: Partie[] = [
    { cle: 'reel', libelle: 'Réel', manque: reelRetard, detail: 'en retard' },
    { cle: 'suivi', libelle: `Suivi du budget ${anneeEnCours}` },
    { cle: 'atterrissage', libelle: `Atterrissage ${anneeEnCours}` },
    { cle: 'quadrimestres', libelle: 'Quadrimestres' },
  ]
  const partiesBudget: Partie[] = [
    { cle: 'budget', libelle: 'Hypothèses' },
    { cle: 'equipe', libelle: 'Équipe', manque: !d.equipes[ligne.magasin]?.length, detail: 'à renseigner' },
    { cle: 'frais', libelle: 'Frais', manque: !d.frais[ligne.magasin]?.length, detail: 'à renseigner' },
    { cle: 'calendrier', libelle: 'Calendrier' },
    { cle: 'resultat', libelle: 'Résultat et trésorerie' },
    { cle: 'echanges', libelle: 'Échanges et versions' },
  ]
  // Budget : la partie affichée ; les autres parties du budget restent dans la page pour l'impression
  const partie = (cle: string) => (onglet === cle ? undefined : 'partie-cachee')

  // Effet des changements non enregistrés, face au budget enregistré
  const enregistre = hypothesesDe(ligne, d, ligne.ajustements)
  const bAvant = enregistre ? calculerBudget(enregistre.hypotheses, parametres) : null
  const tresoAvant = bAvant && enregistre ? tresorerieBudget(bAvant, enregistre.hypotheses, parametres, parametres.tresorerie, ligne.ajustements.tresorerieDepart ?? 0) : null
  const enregistrer = () => resolu && void agir(() => enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses),
    directeur ? 'Ajustements enregistrés.' : 'Ajustements enregistrés : le budget est en discussion avec le siège.')

  return (
    <Box>
      {retour}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h1">{ligne.magasin}</Typography>
        <PastilleStatut statut={ligne.statut} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 2, minHeight: '1.5em' }}>
        {espace === 'budget' && ligne.base ? `${nbEcarts === 0 ? 'Aucun écart' : nbEcarts === 1 ? '1 écart' : `${nbEcarts} écarts`} aux cibles du siège` : ''}
        {espace === 'budget' && <Box component="span" className="impression-seule">{ligne.base ? ' · ' : ''}Budget {annee} · imprimé le {new Date().toLocaleDateString('fr-FR')}</Box>}
      </Typography>

      <Tabs value={espace} onChange={(_, v: Espace) => changerEspace(v)} aria-label="Vues du magasin"
        sx={{ mb: espace === 'synthese' ? 3 : 1.5, minHeight: 0, '& .MuiTabs-flexContainer': { gap: 0.5, flexWrap: 'wrap' }, '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTab-root': { minHeight: 48, borderRadius: 2, px: 2.5, fontWeight: 700, fontSize: '0.9375rem', color: 'text.secondary', bgcolor: 'action.hover' },
          '& .MuiTab-root.Mui-selected': { bgcolor: 'text.primary', color: 'background.paper' } }}>
        <Tab value="synthese" label="Synthèse" />
        <Tab value="annee" label={<LibelleOnglet texte={`${anneeEnCours} en cours`} manque={reelRetard} detail="réel en retard" />} />
        <Tab value="budget" label={<LibelleOnglet texte={`Budget ${annee}`} manque={directeur && !ligne.statut} detail="à proposer" />} />
      </Tabs>
      {espace !== 'synthese' && (
        <Tabs value={onglet} onChange={(_, v: string) => (espace === 'budget' && onglet !== 'equipe' && onglet !== 'frais' ? aller(v) : garde(() => aller(v)))} variant="scrollable" scrollButtons="auto"
          aria-label={espace === 'budget' ? `Parties du budget ${annee}` : `Parties de l’année ${anneeEnCours}`} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          {(espace === 'budget' ? partiesBudget : partiesAnnee).map((x) => (
            <Tab key={x.cle} value={x.cle} label={x.manque !== undefined ? <LibelleOnglet texte={x.libelle} manque={x.manque} detail={x.detail ?? ''} /> : x.libelle} sx={{ minHeight: 48 }} />
          ))}
        </Tabs>
      )}

      {onglet === 'synthese' && franchise && (
        <AFaireFranchise
          key={`a-faire-${ligne.magasin}`} magasin={ligne.magasin} allerA={(o, a) => { if (a) setAnneeQuadri(a); aller(o) }}
          moisRenseignes={reel.donnees ? syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes : null}
          budget={{ annee, statut: ligne.statut, avant: campagneDe(parametres, annee).validation }} aEquipe={!!d.equipes[ligne.magasin]?.length} aFrais={!!d.frais[ligne.magasin]?.length}
        />
      )}
      {onglet === 'synthese' && <AlertesEtActions key={`alertes-${ligne.magasin}`} magasin={ligne.magasin} equipe={!franchise && profil?.role !== 'aucun'} proposition={proposition} />}
      {onglet === 'synthese' ? (
        <>
          <SyntheseMagasin key={ligne.magasin} magasin={ligne.magasin} d={d} annee={anneeEnCours} parametres={donnees.parametresN} allerA={aller}
            visiteEtActions={!franchise && profil?.role !== 'aucun'} proposerAction={!franchise && profil?.role !== 'aucun' ? (intitule) => setProposition({ intitule, n: Date.now() }) : undefined} />
          {!franchise && <ComparaisonMagasin key={`comparaison-${ligne.magasin}`} magasin={ligne.magasin} directeur={directeur} />}
          {!franchise && <FamillesReseau key={`familles-${ligne.magasin}`} magasin={ligne.magasin} directeur={directeur} />}
        </>
      ) : onglet === 'suivi' ? (
        <SuiviBudget key={ligne.magasin} magasin={ligne.magasin} annee={anneeEnCours} allerA={aller} />
      ) : onglet === 'atterrissage' ? (
        <AtterrissageMagasin
          key={ligne.magasin} ligne={ligne} d={d} annee={anneeEnCours} anneeBudget={annee} parametres={donnees.parametresN}
          directeur={directeur} peutSaisir={peutSaisir} allerA={aller} apresProposition={recharger}
        />
      ) : onglet === 'reel' ? (
        <Stack spacing={2}>
          <ToggleButtonGroup exclusive size="small" value={anneeReel} onChange={(_, v: number | null) => v && setAnneeReel(v)} aria-label="Année du réel">
            {[anneeEnCours, anneeEnCours - 1].map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: 48, minWidth: 72 }}>{a}</ToggleButton>)}
          </ToggleButtonGroup>
          <ReelAnnee key={`${ligne.magasin}-${anneeReel}`} magasin={ligne.magasin} annee={anneeReel} peutSaisir={peutSaisir} apresEnregistrement={reel.recharger} />
        </Stack>
      ) : onglet === 'quadrimestres' ? (
        <Stack spacing={2}>
          <ToggleButtonGroup exclusive size="small" value={anneeQuadri} onChange={(_, v: number | null) => v && garde(() => setAnneeQuadri(v))} aria-label="Année des quadrimestres">
            {[anneeEnCours, anneeEnCours - 1].map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: 48, minWidth: 72 }}>{a}</ToggleButton>)}
          </ToggleButtonGroup>
          <QuadrimestresMagasin key={`${ligne.magasin}-${anneeQuadri}`} magasin={ligne.magasin} annee={anneeQuadri} peutSaisir={peutSaisir} />
        </Stack>
      ) : (<Stack spacing={3}>

      {message && (
        <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>
          {message.texte}
          {message.details?.length ? <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>{message.details.map((t) => <li key={t}>{t}</li>)}</Box> : null}
        </Alert>
      )}

      {b && (
        <>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label="Indicateurs clés">
            <Indicateur libelle="Chiffre d’affaires HT" valeur={milliers(b.ca)} detail={`Atterrissage de l’année en cours : ${milliers(b.atterrissage)}`} action={<DetailCalcul quoi="ca" budget={b} annee={annee} />} />
            <Indicateur libelle="Marge commerciale" valeur={taux(b.tauxMarge)} detail={milliers(b.marge)} action={<DetailCalcul quoi="marge" budget={b} annee={annee} />} />
            <Indicateur libelle="Masse salariale / marge" valeur={taux(b.ratios.personnelSurMarge)} detail={`${taux(b.ratios.personnelSurCA)} du CA`} />
            <Indicateur libelle="EBE" valeur={milliers(b.ebe)} detail={`${taux(b.ratios.ebeSurCA)} du CA`} action={<DetailCalcul quoi="ebe" budget={b} annee={annee} />} />
            <Indicateur libelle="Résultat net" valeur={milliers(b.resultatNet)} detail={`Impôt : ${milliers(b.impot)}`} />
          </Stack>

          <Stack direction="row" useFlexGap spacing={1.5} className="pas-a-l-impression" sx={{ flexWrap: 'wrap' }} aria-label="Actions sur le budget">
            {directeur && ligne.base && ligne.statut !== 'valide' && (
              <Button variant={modifie ? 'outlined' : 'contained'} color="success" startIcon={<CheckCircleOutlined />} disabled={occupe || !enregistrable} sx={{ minHeight: 48 }}
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
            {directeur && ligne.base && !copie && (
              <Button variant="outlined" startIcon={<ContentCopyOutlined />} disabled={occupe || modifie} onClick={() => setCopie(true)} sx={{ minHeight: 48 }}>
                Copier vers d’autres magasins
              </Button>
            )}
            <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
            <Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exporter} sx={{ minHeight: 48 }}>Exporter en Excel</Button>
            <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()} sx={{ minHeight: 48, display: { xs: 'none', md: 'inline-flex' } }}>Imprimer</Button>
          </Stack>
          {copie && <CopieHypotheses source={ligne.magasin} magasins={destinations.map((l) => l.magasin)} occupe={occupe} onCopier={copier} onFermer={() => setCopie(false)} />}
        </>
      )}

      {onglet === 'equipe' ? (
        <EquipeMagasin
          key={ligne.magasin} magasin={ligne.magasin} equipe={d.equipes[ligne.magasin] ?? []} annee={anneeEnCours} anneeBudget={annee}
          hausse={resolu?.hypotheses.hausseSalaires ?? valeurHeritee(niveauxDe(ligne, d, brouillon), 'hausseSalaires')?.valeur ?? 0}
          charges={donnees.parametresN.charges} chargesBudget={parametres.charges}
          peutSaisir={peutSaisir} apresEnregistrement={recharger} caAnnee={b?.atterrissage} caBudget={b?.ca} ebeBudget={b?.ebe}
        />
      ) : onglet === 'frais' ? (
        <FraisMagasin key={ligne.magasin} magasin={ligne.magasin} lignes={d.frais[ligne.magasin] ?? []} annee={anneeEnCours} peutSaisir={peutSaisir} apresEnregistrement={recharger}
          tauxSurCA={{ publicite: parametres.tauxPublicite, redevance: parametres.tauxRedevance }}
          budget={b ? { annee, ca: b.ca, ebe: b.ebe } : undefined} />
      ) : onglet === 'echanges' ? (
        <>
          {profil && <EchangesBudget key={`echanges-${ligne.magasin}`} ligne={ligne} d={d} annee={annee} parametres={parametres} moi={profil} />}
          {profil && ligne.base && b && (
            <VersionsBudget
              key={`versions-${ligne.magasin}`} ligne={ligne} d={d} annee={annee} parametres={parametres} budget={b} ajustements={brouillon}
              peutEnregistrer={directeur || profil.role === 'franchise'} peutReprendre={peutAjuster} moi={profil}
              onReprendre={(a) => { setBrouillon(a); setMessage({ gravite: 'warning', texte: 'Hypothèses de la version reprises. Enregistre les ajustements pour les garder.' }) }}
            />
          )}
        </>
      ) : !b ? (
        <EtatVide
          titre={`Pas encore de budget ${annee}`}
          texte={directeur
            ? `Le budget ${annee} se propose à partir de l’atterrissage ${anneeEnCours} du magasin.`
            : `Le siège n’a pas encore proposé de budget ${annee} pour ce magasin. Il apparaîtra ici dès sa proposition.`}
          action={directeur ? <Button variant="contained" onClick={() => aller('atterrissage')} sx={{ minHeight: 48 }}>Voir l’atterrissage {anneeEnCours}</Button> : undefined}
        />
      ) : (
        <>
          <Stack spacing={3} className={partie('budget')}>
            {ligne.base && resolu && (
              <Card component="section" aria-label="Hypothèses du magasin">
                <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Hypothèses</Typography>
                <TableContainer>
                  <GrilleHypotheses
                    titre="Hypothèses du magasin" familles={b.familles} flux={b.flux} annee={annee}
                    cibles={brouillon} auDessus={niveauxDe(ligne, d).slice(0, -1)} valeursBase={valeursSansCible(ligne.base)}
                    onChange={setBrouillon} lectureSeule={!peutAjuster}
                  />
                </TableContainer>
                <Typography variant="h3" sx={{ px: 2.5, pt: 3, pb: 1 }}>Salaires et frais</Typography>
                <TableContainer>
                  <TableauCibles
                    titre="Autres hypothèses du magasin"
                    lignes={lignesCibles([], false, [])}
                    niveau="magasin"
                    cibles={brouillon}
                    auDessus={niveauxDe(ligne, d).slice(0, -1)}
                    valeursBase={valeursSansCible(ligne.base)}
                    onChange={setBrouillon}
                    lectureSeule={!peutAjuster}
                  />
                </TableContainer>
              </Card>
            )}
            {ligne.base && (
              <BaseCAMagasin
                key={`base-${ligne.magasin}`}
                magasin={ligne.magasin} budget={b} annee={annee} ouverture={d.ouvertures?.[ligne.magasin]}
                rythme={brouillon.rythme} directeur={directeur} peutAjuster={peutAjuster} apresOuverture={recharger}
                onRythme={(r) => setBrouillon(({ rythme: _, ...reste }) => (r ? { ...reste, rythme: r } : reste))}
              />
            )}
          </Stack>
          {ligne.base && (
            <Stack spacing={3} className={partie('calendrier')}>
              <SaisonnaliteMagasin budget={b} poids={brouillon.poidsMois} lectureSeule={!peutAjuster}
                onChange={(p) => setBrouillon(({ poidsMois: _, ...reste }) => (p ? { ...reste, poidsMois: p } : reste))} />
              {resolu && (
                <TravauxMagasin
                  key={`${ligne.magasin}-${!!brouillon.travaux}`}
                  travaux={brouillon.travaux} lectureSeule={!peutAjuster}
                  effetCA={sansTravaux ? b.ca - sansTravaux.ca : 0} dotation={effetTravaux(resolu.hypotheses.travaux).dotation}
                  onChange={(t) => setBrouillon(({ travaux: _, ...reste }) => (t ? { ...reste, travaux: t } : reste))}
                />
              )}
              <TempsFortsMagasin tempsForts={brouillon.tempsForts} lectureSeule={!peutAjuster} annee={annee} budget={b}
                onChange={(l) => setBrouillon(({ tempsForts: _, ...reste }) => (l ? { ...reste, tempsForts: l } : reste))} />
              <AjustementsCAMagasin ajustements={brouillon.ajustementsCA} lectureSeule={!peutAjuster} annee={annee} effet={b.tempsForts?.ajustements ?? 0}
                onChange={(l) => setBrouillon(({ ajustementsCA: _, ...reste }) => (l ? { ...reste, ajustementsCA: l } : reste))} />
            </Stack>
          )}
          <Stack spacing={3} className={partie('resultat')}>
            {resolu && <CompteResultatMois lignes={compteResultat(b, resolu.hypotheses, parametres)} titre={`Compte de résultat ${annee}`} libelleTableau={`Budget ${annee} mois par mois`} />}
            {resolu && b && <EconomieFranchise budget={b} hypotheses={resolu.hypotheses} parametres={parametres} annee={annee} />}
            {tresorerie && (
              <TresorerieBudget
                key={ligne.magasin} tresorerie={tresorerie} annee={annee} depart={brouillon.tresorerieDepart} lectureSeule={!peutAjuster} replie={franchise}
                onDepart={(v) => setBrouillon(({ tresorerieDepart: _, ...reste }) => (v === undefined ? reste : { ...reste, tresorerieDepart: v }))}
              />
            )}
          </Stack>
        </>
      )}

      {espace === 'budget' && peutAjuster && modifie && b && (
        <BarreEnregistrement
          changements={nombreChangements(ligne.ajustements, brouillon)} occupe={occupe} desactive={!enregistrable}
          libelle="Enregistrer les ajustements" onAnnuler={() => setBrouillon(ligne.ajustements)} onEnregistrer={enregistrer}
          avertissement={enregistrable ? undefined : 'La saisonnalité doit faire 100 %.'}
          effets={bAvant ? [
            { libelle: 'CA', avant: milliers(bAvant.ca), apres: milliers(b.ca) },
            { libelle: 'EBE', avant: milliers(bAvant.ebe), apres: milliers(b.ebe) },
            ...(tresoAvant && tresorerie ? [{ libelle: 'Trésorerie fin décembre', avant: milliers(tresoAvant.fin), apres: milliers(tresorerie.fin) }] : []),
          ] : []}
        />
      )}
      </Stack>)}
    </Box>
  )
}
