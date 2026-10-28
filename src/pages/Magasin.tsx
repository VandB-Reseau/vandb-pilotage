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
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { useAuth } from '../auth/AuthContext'
import { AFaireFranchise } from '../components/AFaireFranchise'
import { EchangesBudget } from '../components/EchangesBudget'
import { AtterrissageMagasin } from '../components/AtterrissageMagasin'
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
import { AlertesDuMagasin } from '../components/AlertesMagasins'
import { SimulationMagasin } from '../components/SimulationMagasin'
import { QuadrimestresMagasin } from '../components/QuadrimestresMagasin'
import { ReelAnnee } from '../components/ReelAnnee'
import { poidsValides, SaisonnaliteMagasin } from '../components/SaisonnaliteMagasin'
import { SuiviBudget } from '../components/SuiviBudget'
import { TravauxMagasin } from '../components/TravauxMagasin'
import { TresorerieBudget } from '../components/TresorerieBudget'
import { SyntheseMagasin } from '../components/SyntheseMagasin'
import { GrilleHypotheses } from '../components/GrilleHypotheses'
import { lignesCibles, TableauCibles } from '../components/TableauCibles'
import {
  anneeBudget, changerStatut, chargerBudgets, chargerParametres, chargerReel, enregistrerAjustements, hypothesesDe, niveauxDe, statutLibelle, valeursSansCible,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { reelEnRetard } from '../lib/aFaire'
import { feuillesBudget } from '../lib/exports'
import { lienMagasin, milliers, taux } from '../lib/format'
import { classeur, nomFichier, telecharger } from '../lib/xlsx'
import { syntheseReel } from '../moteur/reel'
import { calculerBudget, effetTravaux } from '../moteur/budget'
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
  // Budget de l'an prochain, réel de l'année en cours et de la précédente
  const anneeEnCours = new Date().getFullYear()
  // Synthèse d'abord : la santé du magasin en un coup d'œil
  const [onglet, setOnglet] = useState((useLocation().state as { onglet?: string } | null)?.onglet ?? 'synthese')
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
      classeur(feuillesBudget({ magasin: ligne.magasin, annee, statut, lignes: compteResultat(b, resolu.hypotheses, parametres), familles: b.familles, tresorerie })))
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


  return (
    <Box>
      {retour}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h1">{ligne.magasin}</Typography>
        <PastilleStatut statut={ligne.statut} />
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 2, minHeight: '1.5em' }}>
        {onglet === 'budget' && ligne.base ? `${nbEcarts === 0 ? 'Aucun écart' : nbEcarts === 1 ? '1 écart' : `${nbEcarts} écarts`} aux cibles du siège` : ''}
        {onglet === 'budget' && <Box component="span" className="impression-seule">{ligne.base ? ' · ' : ''}Budget {annee} · imprimé le {new Date().toLocaleDateString('fr-FR')}</Box>}
      </Typography>

      <Tabs value={onglet} onChange={(_, v: string) => garde(() => { setOnglet(v); setBrouillon(ligne.ajustements) })} variant="scrollable" scrollButtons="auto" aria-label="Vues du magasin" sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab value="synthese" label="Synthèse" sx={{ minHeight: 48 }} />
        <Tab value="suivi" label={`Suivi du budget ${anneeEnCours}`} sx={{ minHeight: 48 }} />
        <Tab value="budget" label={<LibelleOnglet texte={`Budget ${annee}`} manque={directeur && !ligne.statut} detail="à proposer" />} sx={{ minHeight: 48 }} />
        <Tab value="atterrissage" label={`Atterrissage ${anneeEnCours}`} sx={{ minHeight: 48 }} />
        <Tab value="reel" label={<LibelleOnglet texte="Réel" manque={!!reel.donnees && reelEnRetard(syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes)} detail="en retard" />} sx={{ minHeight: 48 }} />
        <Tab value="quadrimestres" label="Quadrimestres" sx={{ minHeight: 48 }} />
        <Tab value="simulation" label="Et si…" sx={{ minHeight: 48 }} />
        <Tab value="equipe" label={<LibelleOnglet texte="Équipe" manque={!d.equipes[ligne.magasin]?.length} detail="à renseigner" />} sx={{ minHeight: 48 }} />
        <Tab value="frais" label={<LibelleOnglet texte="Frais" manque={!d.frais[ligne.magasin]?.length} detail="à renseigner" />} sx={{ minHeight: 48 }} />
      </Tabs>

      {onglet === 'synthese' && franchise && (
        <AFaireFranchise
          key={`a-faire-${ligne.magasin}`} magasin={ligne.magasin} allerA={(o, a) => { if (a) setAnneeQuadri(a); setOnglet(o) }}
          moisRenseignes={reel.donnees ? syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes : null}
          budget={{ annee, statut: ligne.statut }} aEquipe={!!d.equipes[ligne.magasin]?.length} aFrais={!!d.frais[ligne.magasin]?.length}
        />
      )}
      {onglet === 'synthese' && <AlertesDuMagasin magasin={ligne.magasin} />}
      {onglet === 'synthese' ? (
        <>
          <SyntheseMagasin key={ligne.magasin} magasin={ligne.magasin} d={d} annee={anneeEnCours} parametres={donnees.parametresN} allerA={setOnglet} />
          {!franchise && <ComparaisonMagasin key={`comparaison-${ligne.magasin}`} magasin={ligne.magasin} directeur={directeur} />}
        </>
      ) : onglet === 'suivi' ? (
        <SuiviBudget key={ligne.magasin} magasin={ligne.magasin} annee={anneeEnCours} allerA={setOnglet} />
      ) : onglet === 'atterrissage' ? (
        <AtterrissageMagasin
          key={ligne.magasin} ligne={ligne} d={d} annee={anneeEnCours} anneeBudget={annee} parametres={donnees.parametresN}
          directeur={directeur} peutSaisir={peutSaisir} allerA={setOnglet} apresProposition={recharger}
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
      ) : onglet === 'simulation' ? (
        resolu ? (
          <SimulationMagasin key={ligne.magasin} hypotheses={resolu.hypotheses} parametres={parametres} annee={annee} depart={brouillon.tresorerieDepart ?? 0} />
        ) : (
          <EtatVide titre={`Pas encore de budget ${annee}`} texte="La simulation part du budget du magasin. Elle sera possible dès que le siège l’aura proposé."
            action={directeur ? <Button variant="contained" onClick={() => setOnglet('atterrissage')} sx={{ minHeight: 48 }}>Proposer le budget</Button> : undefined} />
        )
      ) : onglet === 'frais' ? (
        <FraisMagasin key={ligne.magasin} magasin={ligne.magasin} lignes={d.frais[ligne.magasin] ?? []} annee={anneeEnCours} peutSaisir={peutSaisir} apresEnregistrement={recharger} />
      ) : onglet === 'equipe' ? (
        <EquipeMagasin
          key={ligne.magasin} magasin={ligne.magasin} equipe={d.equipes[ligne.magasin] ?? []} annee={anneeEnCours} anneeBudget={annee}
          hausse={resolu?.hypotheses.hausseSalaires ?? valeurHeritee(niveauxDe(ligne, d, brouillon), 'hausseSalaires')?.valeur ?? 0}
          charges={donnees.parametresN.charges} chargesBudget={parametres.charges}
          peutSaisir={peutSaisir} apresEnregistrement={recharger}
        />
      ) : (<>

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
            ? `Le budget ${annee} se propose à partir de l’atterrissage ${anneeEnCours} du magasin.`
            : `Le siège n’a pas encore proposé de budget ${annee} pour ce magasin. Il apparaîtra ici dès sa proposition.`}
          action={directeur ? <Button variant="contained" onClick={() => setOnglet('atterrissage')} sx={{ minHeight: 48 }}>Voir l’atterrissage {anneeEnCours}</Button> : undefined}
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

          <Stack direction="row" useFlexGap spacing={1.5} className="pas-a-l-impression" sx={{ flexWrap: 'wrap' }} aria-label="Actions sur le budget">
            {peutAjuster && modifie && (
              <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !enregistrable} sx={{ minHeight: 48 }}
                onClick={() => resolu && void agir(() => enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses),
                  directeur ? 'Ajustements enregistrés.' : 'Ajustements enregistrés : le budget est en discussion avec le siège.')}>
                Enregistrer les ajustements
              </Button>
            )}
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

          {profil && <EchangesBudget key={`echanges-${ligne.magasin}`} ligne={ligne} d={d} annee={annee} parametres={parametres} moi={profil} />}

          {copie && <CopieHypotheses source={ligne.magasin} magasins={destinations.map((l) => l.magasin)} occupe={occupe} onCopier={copier} onFermer={() => setCopie(false)} />}

          {ligne.base && resolu && b && (
            <Card component="section" aria-label="Hypothèses du magasin">
              <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Hypothèses</Typography>
              <TableContainer>
                <GrilleHypotheses
                  titre="Hypothèses du magasin" familles={b.familles} annee={annee}
                  cibles={brouillon} auDessus={niveauxDe(ligne, d).slice(0, 2)} valeursBase={valeursSansCible(ligne.base)}
                  onChange={setBrouillon} lectureSeule={!peutAjuster}
                />
              </TableContainer>
              <Typography variant="h3" sx={{ px: 2.5, pt: 3, pb: 1 }}>Salaires, frais et tickets</Typography>
              <TableContainer>
                <TableauCibles
                  titre="Autres hypothèses du magasin"
                  lignes={lignesCibles(ligne.base.familles, false, (['cave', 'bar'] as const).filter((u) => ligne.base?.flux?.[u])).filter((l) => !/par famille$/.test(l.section))}
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

          {ligne.base && b && (
            <SaisonnaliteMagasin budget={b} poids={brouillon.poidsMois} lectureSeule={!peutAjuster}
              onChange={(p) => setBrouillon(({ poidsMois: _, ...reste }) => (p ? { ...reste, poidsMois: p } : reste))} />
          )}
          {ligne.base && b && resolu && (
            <TravauxMagasin
              key={`${ligne.magasin}-${!!brouillon.travaux}`}
              travaux={brouillon.travaux} lectureSeule={!peutAjuster}
              effetCA={sansTravaux ? b.ca - sansTravaux.ca : 0} dotation={effetTravaux(resolu.hypotheses.travaux).dotation}
              onChange={(t) => setBrouillon(({ travaux: _, ...reste }) => (t ? { ...reste, travaux: t } : reste))}
            />
          )}

          {resolu && <CompteResultatMois lignes={compteResultat(b, resolu.hypotheses, parametres)} titre={`Compte de résultat ${annee}`} libelleTableau={`Budget ${annee} mois par mois`} />}
          {tresorerie && (
            <TresorerieBudget
              key={ligne.magasin} tresorerie={tresorerie} annee={annee} depart={brouillon.tresorerieDepart} lectureSeule={!peutAjuster}
              onDepart={(v) => setBrouillon(({ tresorerieDepart: _, ...reste }) => (v === undefined ? reste : { ...reste, tresorerieDepart: v }))}
            />
          )}
        </Stack>
      )}
      </>)}
    </Box>
  )
}
