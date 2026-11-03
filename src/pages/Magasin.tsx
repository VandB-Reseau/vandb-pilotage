import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Badge from '@mui/material/Badge'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined'
import PrintOutlined from '@mui/icons-material/PrintOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined'
import { useAuth } from '../auth/AuthContext'
import { AFaireFranchise } from '../components/AFaireFranchise'
import { BarreEnregistrement } from '../components/BarreEnregistrement'
import { HistoriqueBudget } from '../components/HistoriqueBudget'
import { AvecCommentaires, BoutonCommenter } from '../components/Commentaires'
import { AlertesEtActions } from '../components/PlanAction'
import { AtterrissageMagasin } from '../components/AtterrissageMagasin'
import { DetailCalcul } from '../components/DetailCalcul'
import { VersionsBudget } from '../components/VersionsBudget'
import { CompteResultatMois } from '../components/CompteResultatMois'
import { CopieHypotheses } from '../components/CopieHypotheses'
import { ANCRES_QUESTIONS, QuestionsCalendrier } from '../components/QuestionsCalendrier'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { EquipeMagasin } from '../components/EquipeMagasin'
import { FraisBudget } from '../components/FraisBudget'
import { FraisMagasin } from '../components/FraisMagasin'
import { useGarde, useSaisieEnCours } from '../components/GardeSaisie'
import { PastilleStatut } from '../components/PastilleStatut'
import { Repliable } from '../components/Repliable'
import { ComparaisonMagasin } from '../components/ComparaisonMagasin'
import { QuadrimestresMagasin } from '../components/QuadrimestresMagasin'
import { ReelAnnee } from '../components/ReelAnnee'
import { poidsValides, SaisonnaliteMagasin } from '../components/SaisonnaliteMagasin'
import { StockMagasin } from '../components/StockMagasin'
import { SuiviBudget } from '../components/SuiviBudget'
import { TravauxMagasin } from '../components/TravauxMagasin'
import { BaseCAMagasin } from '../components/BaseCAMagasin'
import { EvenementsMagasin } from '../components/EvenementsMagasin'
import { AchatsMagasin, CapaciteAutofinancement, FinancementsMagasin } from '../components/InvestissementsMagasin'
import { PretsMagasin } from '../components/PretsMagasin'
import { pretsDeLAnnee, pretsDeuxAnnees, pretsValides } from '../moteur/financement'
import { etatCalendrier, etatInvestissements, QUESTIONS_CALENDRIER, QUESTIONS_INVESTISSEMENTS } from '../moteur/questions'
import { TresorerieBudget } from '../components/TresorerieBudget'
import { TresorerieDepart } from '../components/TresorerieDepart'
import { EconomieFranchise } from '../components/EconomieFranchise'
import { FamillesReseau } from '../components/FamillesReseau'
import { SyntheseMagasin } from '../components/SyntheseMagasin'
import { Effet, HypotheseCle, HypothesesUnivers, TableauHypotheses } from '../components/HypothesesUnivers'
import { HypothesesCartes } from '../components/HypothesesCartes'
import { RevueChangements } from '../components/RevueChangements'
import { SimulateurObjectif } from '../components/ObjectifEbe'
import { economieFranchise } from '../moteur/economie'
import { changementsCibles, changementsParTheme, effetsChangements, pointsAvantValidation, themeDeCle, type ThemeAccord } from '../moteur/changements'
import { marquesEtapes } from '../moteur/campagne'
import { tresorerieDepartEstimee } from '../moteur/reprise'
import { ResultatDirect } from '../components/ResultatDirect'
import { PanneauImpact } from '../components/PanneauImpact'
import { impactBudget, libelleDernier, suivreDernier, tauxSurCA } from '../moteur/impact'
import { AccordTheme } from '../components/AccordTheme'
import {
  anneeBudget, avecEquipeEtFrais, changerStatut, chargerBudgets, envoyerAuSiege, chargerParametres, chargerReel, enregistrerAjustements, hypothesesDe, niveauxDe, parametresDuBudget, statutLibelle, valeursSansCible, type LigneMagasin,
} from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { nombreChangements, reelEnRetard } from '../lib/aFaire'
import { feuillesBudget } from '../lib/exports'
import { lienMagasin, milliers, MOIS_LONGS, taux } from '../lib/format'
import { ESPACES, PARTIE_PAR_DEFAUT, SECTIONS_SUIVI, espaceDe, estSectionSuivi, estTheme, etapeDe, libelleEspace, partieConnue, partieDe, partiesDe, sectionDe, THEMES, type Espace } from '../lib/navigation'
import { classeur, nomFichier, telecharger } from '../lib/xlsx'
import { syntheseReel } from '../moteur/reel'
import { calculerBudget, effetTravaux } from '../moteur/budget'
import { campagneDe } from '../moteur/campagne'
import { compteResultat } from '../moteur/compteResultat'
import { grilleDe } from '../moteur/parametres'
import { reglesDe } from '../moteur/regles'
import { tresorerieBudget } from '../moteur/tresorerie'
import { copieParThemes, ecarts, ecrireCible, valeurHeritee, type Cibles, type ThemeCopie } from '../moteur/cibles'
import { trancheMillesime } from '../moteur/projection'


// Onglet avec une pastille quand il manque quelque chose ; le détail est lu par les lecteurs d'écran
function LibelleOnglet({ texte, manque, detail, marque }: { texte: string; manque: boolean; detail: string; marque?: string }) {
  return (
    <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 }}>
      <Badge variant="dot" color="warning" invisible={!manque} sx={{ '& .MuiBadge-dot': { right: -6, top: 2 } }}>
        {texte}{manque && <Box component="span" sx={visuellementCache}> ({detail})</Box>}
      </Badge>
      {marque && <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.8 }}>{marque}</Box>}
    </Box>
  )
}
// Lot 36 : la fiche se découpe en parties rangées dans trois espaces (Données, Budget, Suivi), voir lib/navigation

// Pastille de l'onglet d'un espace : ce qui manque dans une de ses pages
const ESPACE_MANQUES: Record<Espace, string[]> = { suivi: ['atterrissage'], budget: ['budget'], donnees: ['reel', 'frais'] }

const visuellementCache = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

type Message = { gravite: 'success' | 'error' | 'warning'; texte: string; details?: string[] }

export function Magasin() {
  const { nom = '', partie: partieUrl } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Panneau Impact (03/11/2026) : à droite dès que l'écran laisse la place au tableau des hypothèses à côté
  const impactACote = useMediaQuery('(min-width:1280px)')
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
  // Lot 36 : la partie affichée vient de l'adresse ; un ancien lien (sans partie, ou par l'état « onglet ») est réécrit
  const etatLien = location.state as { onglet?: string; section?: string } | null
  const voulu = partieUrl ?? etatLien?.onglet ?? 'synthese'
  const onglet = partieConnue(voulu) ? partieDe(voulu) : 'synthese'
  useEffect(() => {
    if (partieUrl === onglet) return
    const { onglet: _o, ...reste } = etatLien ?? {}
    navigate(lienMagasin(nom, onglet), { replace: true, state: { ...reste, section: sectionDe(voulu) ?? undefined } })
  }, [partieUrl, onglet, nom]) // eslint-disable-line react-hooks/exhaustive-deps
  // Partie regroupée demandée (« calendrier », « plan »…) : la page défile jusqu'à elle une fois affichée
  const [section, setSection] = useState<string | null>(etatLien?.section ?? null)
  useEffect(() => { if (etatLien?.section) setSection(etatLien.section) }, [etatLien?.section])
  useEffect(() => {
    if (!section) return
    const t = window.setTimeout(() => { document.getElementById(`partie-${section}`)?.scrollIntoView({ block: 'start' }); setSection(null) }, 50)
    return () => window.clearTimeout(t)
  }, [section, onglet])
  // Section du Suivi ouverte d'office : la dernière vers laquelle un lien a mené
  const [sectionOuverte, setSectionOuverte] = useState<string | null>(estSectionSuivi(etatLien?.section) ? etatLien!.section! : null)
  useEffect(() => { if (estSectionSuivi(section)) setSectionOuverte(section) }, [section])
  const [anneeReel, setAnneeReel] = useState(anneeEnCours)
  const [anneeQuadri, setAnneeQuadri] = useState(anneeEnCours)

  const ligne = donnees?.d.magasins.find((l) => l.magasin === nom) ?? null
  // Le brouillon est repris du magasin une fois chargé : avant, aucune saisie n'est « en cours » (pas de garde intempestive)
  const [brouillonDe, setBrouillonDe] = useState<object | null>(null)
  // Un prêt enregistré recharge le magasin sans perdre les ajustements en cours du budget
  const garderBrouillon = useRef<Cibles | null>(null)
  useEffect(() => {
    const garde = garderBrouillon.current
    garderBrouillon.current = null
    setBrouillon(garde ?? ligne?.ajustements ?? {}); setBrouillonDe(ligne)
  }, [ligne])
  const rechargerEnGardant = () => { garderBrouillon.current = brouillon; recharger() }
  useSaisieEnCours(!!ligne && brouillonDe === ligne && JSON.stringify(brouillon) !== JSON.stringify(ligne.ajustements))
  // Panneau Impact : les hypothèses telles qu'avant le dernier changement (moteur : suivreDernier)
  const [avantDernier, setAvantDernier] = useState<Cibles | null>(null)
  const brouillonPrecedent = useRef<Cibles>(brouillon)
  useEffect(() => {
    const precedent = brouillonPrecedent.current, enregistre = ligne?.ajustements ?? {}
    setAvantDernier((a) => suivreDernier(a, precedent, brouillon, enregistre))
    brouillonPrecedent.current = brouillon
  }, [brouillon]) // eslint-disable-line react-hooks/exhaustive-deps
  const garde = useGarde()
  // Réel de l'année : pastille de l'onglet si le dernier mois terminé manque (gardé en mémoire pour les onglets Réel et Atterrissage)
  const reel = useChargement(() => chargerReel(nom, anneeEnCours), [nom, anneeEnCours])
  // Lot 38 (D2) : statut du budget de l'année en cours, affiché dans l'en-tête du Suivi
  const budgetsN = useChargement(() => chargerBudgets(anneeEnCours), [anneeEnCours])
  // Magasins de la liste d'où l'on vient (filtres compris), pour passer au précédent ou au suivant
  const state = location.state as { liste?: string[]; retour?: string; depuis?: { chemin: string; nom: string } } | null

  const directeur = profil?.role === 'directeur'
  // Joseph, 29/10/2026 : le budget est validé par le RR (ses magasins) ou par le Directeur
  const peutValider = directeur || profil?.role === 'rr'
  const peutSaisir = !!profil && profil.role !== 'aucun'
  const franchise = profil?.role === 'franchise'
  const seul = franchise && donnees?.d.magasins.length === 1
  const liste = (state?.liste ?? donnees?.d.magasins.map((l) => l.magasin) ?? []).filter((m) => donnees?.d.magasins.some((l) => l.magasin === m))
  const rang = liste.indexOf(nom)
  const voisin = (pas: number) => (rang < 0 || liste.length < 2 ? null : liste[(rang + pas + liste.length) % liste.length])
  const precedent = voisin(-1), suivant = voisin(1)
  // Option A (Joseph, 03/11/2026) : une seule rangée au-dessus du nom, le fil d'Ariane ; on change de magasin par la
  // recherche de la barre du haut, ou par précédent et suivant dans la liste d'où l'on vient
  const depuis = state?.depuis ?? { chemin: '/', nom: franchise ? 'Mes magasins' : 'Magasins' }
  const retour = seul ? null : (
    <Box component="nav" aria-label="Fil d’Ariane" className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap', minHeight: 48 }}>
      <Link component={RouterLink} to={`${depuis.chemin}${state?.retour ? `?${state.retour}` : ''}`} color="text.secondary"
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, fontSize: '0.9375rem', textUnderlineOffset: 3 }}>{depuis.nom}</Link>
      <Typography component="span" color="text.secondary" aria-hidden sx={{ px: 0.5 }}>/</Typography>
      <Typography component="span" color="text.secondary" aria-current="page" sx={{ fontSize: '0.9375rem' }}>{ligne?.magasin ?? nom}</Typography>
      <Box sx={{ flex: 1 }} />
      {precedent && (
        <Tooltip title={`Magasin précédent : ${precedent}`}>
          <IconButton component={RouterLink} to={lienMagasin(precedent, onglet)} state={state} aria-label={`Magasin précédent : ${precedent}`} sx={{ width: 48, height: 48 }}><ChevronLeftOutlined /></IconButton>
        </Tooltip>
      )}
      {suivant && (
        <Tooltip title={`Magasin suivant : ${suivant}`}>
          <IconButton component={RouterLink} to={lienMagasin(suivant, onglet)} state={state} aria-label={`Magasin suivant : ${suivant}`} sx={{ width: 48, height: 48 }}><ChevronRightOutlined /></IconButton>
        </Tooltip>
      )}
    </Box>
  )

  // Quitter le budget sans enregistrer (la garde a demandé confirmation) : on repart des ajustements enregistrés
  const espaceAffiche = espaceDe(onglet)
  useEffect(() => { if (espaceAffiche !== 'budget' && ligne) setBrouillon(ligne.ajustements) }, [espaceAffiche]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lot 43 (Joseph, 03/11/2026) : l'état de chaque étape du budget, lu dans les onglets sans ouvrir l'étape
  const modifieMenu = !!ligne && brouillonDe === ligne && JSON.stringify(brouillon) !== JSON.stringify(ligne.ajustements)
  const marquesMenu: Record<string, string> = ligne ? marquesEtapes({
    statut: ligne.statut, propose: !!ligne.base, modifie: modifieMenu, role: profil?.role ?? 'aucun',
    changements: ligne.statut === 'propose' ? changementsCibles(ligne.siege ?? {}, ligne.ajustements).length : 0,
  }) : {}

  if (chargement && !donnees) return <Box>{retour}<Skeleton variant="rounded" height={160} /></Box>
  if (erreur) return <Box>{retour}<Panne quoi="Les chiffres du magasin" recharger={recharger} /></Box>
  if (!donnees || !ligne) {
    return <Box>{retour}<EtatVide titre="Ce magasin n’est pas dans ton périmètre" texte="Il n’apparaît pas parmi les magasins rattachés à ton compte. Reviens à la liste pour choisir un de tes magasins." /></Box>
  }

  const { d } = donnees
  // Lot 38 : un budget validé se calcule avec les paramètres réseau du jour de sa validation
  const parametres = parametresDuBudget(ligne, donnees.parametres)
  const resolu = hypothesesDe(ligne, d, brouillon)
  const b = resolu ? calculerBudget(resolu.hypotheses, parametres) : null
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(ligne.ajustements)
  const peutAjuster = (directeur || profil?.role === 'franchise') && !!ligne.base && ligne.statut !== 'valide'
  const nbEcarts = resolu ? ecarts(resolu.provenance).length : 0
  // Lot 35 : frais du budget à partir des frais de l'année en cours ; inflation des frais pour les lignes sans choix
  const baseFrais = ligne.base ? avecEquipeEtFrais(ligne.base, d.equipes[ligne.magasin], d.frais[ligne.magasin], d.comptes?.[ligne.magasin], d.prets?.[ligne.magasin]) : null
  const inflation = resolu?.provenance.find((x) => x.cle === 'inflationFrais')?.valeur ?? 0
  const enregistrable = poidsValides(brouillon.poidsMois)
  // Lot 42 (proposition 5) : sans trésorerie au 1er janvier saisie, celle estimée depuis les comptes de l'année
  const estimee = ligne.statut === 'valide' && ligne.figees ? ligne.figees.departEstime ?? null
    : baseFrais ? tresorerieDepartEstimee(baseFrais, d.comptes?.[ligne.magasin], parametres) : null
  const departDe = (c: Cibles) => c.tresorerieDepart ?? estimee?.montant ?? 0
  // EBE du budget avec une hypothèse changée (objectif d'EBE, effet de la hausse des salaires et de l'inflation des frais)
  const ebeAvec = (cle: string, x: number) => { const h = hypothesesDe(ligne, d, ecrireCible(brouillon, cle, x)); return h ? calculerBudget(h.hypotheses, parametres).ebe : 0 }
  // Effet des travaux : même budget sans eux
  const tresorerie = b && resolu ? tresorerieBudget(b, resolu.hypotheses, parametres, parametres.tresorerie, departDe(brouillon)) : null
  // Lot 42 (proposition 4) : EBE de la proposition du siège, pour lire l'écart en direct
  const auSiege = ligne.base ? hypothesesDe(ligne, d, ligne.siege ?? {}) : null
  const bSiege = auSiege ? calculerBudget(auSiege.hypotheses, parametres) : null
  const ebeSiege = bSiege ? bSiege.ebe : null
  const tresoSiege = bSiege && auSiege ? tresorerieBudget(bSiege, auSiege.hypotheses, parametres, parametres.tresorerie, departDe(ligne.siege ?? {})) : null
  const sansTravaux = resolu?.hypotheses.travaux ? calculerBudget({ ...resolu.hypotheses, travaux: undefined }, parametres) : null
  // Lot 42 (proposition 3) : copie thème par thème vers les magasins dont le budget est proposé ou en discussion
  const groupesNoms = new Map(d.groupes.map((g) => [g.id, g.nom]))
  const destinations = d.magasins.filter((l) => l.magasin !== ligne.magasin && l.base && (l.statut === 'propose' || l.statut === 'en_discussion'))
  const copieVers = (cible: LigneMagasin, themes: ThemeCopie[]) => copieParThemes(ligne.ajustements, cible.ajustements, themes)
  const ebeCopie = (nom: string, themes: ThemeCopie[]) => {
    const cible = destinations.find((l) => l.magasin === nom)
    if (!cible) return null
    const p = parametresDuBudget(cible, donnees.parametres)
    const avant = hypothesesDe(cible, d), apres = hypothesesDe(cible, d, copieVers(cible, themes))
    return avant && apres ? { avant: calculerBudget(avant.hypotheses, p).ebe, apres: calculerBudget(apres.hypotheses, p).ebe } : null
  }
  const copier = (vers: string[], themes: ThemeCopie[]) => void agir(async () => {
    for (const nom of vers) {
      const cible = destinations.find((l) => l.magasin === nom)
      if (!cible) continue
      const ajustements = copieVers(cible, themes)
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


  // Lot 36 : l'espace de la partie affichée ; aller à une partie = changer d'adresse, en gardant la liste d'où l'on vient
  const espace = espaceDe(onglet)
  const aller = (o: string) => {
    const { onglet: _o, section: _s, ...reste } = (location.state ?? {}) as Record<string, unknown>
    navigate(lienMagasin(ligne.magasin, partieDe(o)), { state: reste })
    setSection(sectionDe(o))
  }
  const reelRetard = !!reel.donnees && reelEnRetard(syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes)
  const manques: Record<string, { detail: string } | undefined> = {
    reel: reelRetard ? { detail: 'en retard' } : undefined,
    frais: !d.frais[ligne.magasin]?.length ? { detail: 'à renseigner' } : undefined,
    budget: !d.equipes[ligne.magasin]?.length && !d.comptes?.[ligne.magasin]?.quadrimestres.length ? { detail: 'équipe à renseigner' } : undefined,
    atterrissage: directeur && !ligne.statut ? { detail: 'budget à proposer' } : undefined,
  }
  const parties = partiesDe(espace, anneeEnCours)
  // Budget : la partie affichée ; les autres parties du budget restent dans la page pour l'impression
  const partie = (cle: string) => (onglet === partieDe(cle) ? undefined : 'partie-cachee')
  // Lot 37 : un thème des hypothèses (ventes, calendrier, équipe, frais, trésorerie) s'ouvre depuis sa carte
  const themeOuvert = estTheme(onglet) ? THEMES.find((t) => t.cle === onglet)! : null
  const communHypotheses = ligne.base ? {
    cibles: brouillon, auDessus: niveauxDe(ligne, d).slice(0, -1), valeursBase: valeursSansCible(ligne.base), onChange: setBrouillon, lectureSeule: !peutAjuster,
  } : null

  // Effet des changements non enregistrés, face au budget enregistré
  const enregistre = hypothesesDe(ligne, d, ligne.ajustements)
  const bAvant = enregistre ? calculerBudget(enregistre.hypotheses, parametres) : null
  const tresoAvant = bAvant && enregistre ? tresorerieBudget(bAvant, enregistre.hypotheses, parametres, parametres.tresorerie, departDe(ligne.ajustements)) : null
  const anneeChoix = (valeur: number, choisir: (v: number) => void, libelle: string) => (
    <ToggleButtonGroup exclusive size="small" value={valeur} onChange={(_, v: number | null) => v && choisir(v)} aria-label={libelle}>
      {[anneeEnCours, anneeEnCours - 1].map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: 48, minWidth: 72 }}>{a}</ToggleButton>)}
    </ToggleButtonGroup>
  )
  const enregistrer = () => resolu && void agir(() => enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses),
    franchise ? 'Ajustements enregistrés. Envoie-les au siège quand ils sont prêts (étape 3).' : 'Ajustements enregistrés.')

  // Lot 41 (proposition 3) : ce que le magasin a changé par rapport au siège, avec l'effet de chaque changement sur l'EBE
  const nomsFrais = Object.fromEntries((baseFrais?.frais ?? []).map((f) => [f.code, f.libelle]))
  const revue = onglet === 'echanges' && ligne.base && ligne.statut !== 'valide' ? (() => {
    const siege = ligne.siege ?? {}
    const ebe = (c: typeof brouillon) => { const h = hypothesesDe(ligne, d, c); return h ? calculerBudget(h.hypotheses, parametres).ebe : 0 }
    const r = effetsChangements(siege, brouillon, changementsCibles(siege, brouillon, nomsFrais), ebe)
    return { ...r, themes: changementsParTheme(siege, r.effets, ebe) }
  })() : null
  const envoyer = () => resolu && void agir(async () => {
    if (modifie) await enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses)
    await envoyerAuSiege(ligne.magasin, annee)
  }, 'Budget envoyé au siège : il est en discussion.')
  const boutonValider = peutValider && ligne.base && ligne.statut !== 'valide' ? (
    <Button variant="contained" color="success" startIcon={<CheckCircleOutlined />} disabled={occupe || !enregistrable} sx={{ minHeight: 48 }}
      onClick={() => resolu && void agir(async () => {
        if (modifie) await enregistrerAjustements(ligne.magasin, annee, brouillon, resolu.hypotheses)
        // Lot 42 : la trésorerie estimée est figée avec le budget (le RR ne touche pas aux ajustements)
        await changerStatut(ligne.magasin, annee, 'valide', brouillon.tresorerieDepart === undefined && estimee ? { ...resolu.hypotheses, departEstime: estimee } : resolu.hypotheses)
      }, `Budget ${annee} validé.`)}>
      Valider le budget
    </Button>
  ) : null
  // Lot 42 (proposition 6) : « D'accord » thème par thème, pour le franchisé qui peut encore ajuster
  const themesChanges = new Set(changementsCibles(ligne.siege ?? {}, brouillon).map((c) => themeDeCle(c.cle)))
  const accordTheme = franchise && peutAjuster ? (theme: ThemeAccord, nom: string) => (
    <AccordTheme nom={nom} change={themesChanges.has(theme)} accepte={(brouillon.accords ?? []).includes(theme)}
      onChange={(oui) => setBrouillon((c) => {
        const l = (c.accords ?? []).filter((t) => t !== theme)
        const accords = oui ? [...l, theme] : l
        const { accords: _, ...reste } = c
        return accords.length ? { ...reste, accords } : reste
      })} />
  ) : null
  const alerteMessage = message ? (
    <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>
          {message.texte}
          {message.details?.length ? <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>{message.details.map((t) => <li key={t}>{t}</li>)}</Box> : null}
        </Alert>
  ) : null
  // Panneau Impact (Joseph, 03/11/2026) : sur l'étape Construire et ses thèmes, il remplace la barre d'enregistrement
  const avecImpact = espace === 'budget' && !!b && !!ligne.base && (onglet === 'budget' || estTheme(onglet))
  const barreBudget = espace === 'budget' && peutAjuster && modifie && b && !avecImpact ? (
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
  ) : null

  const avantH = avecImpact && avantDernier && peutAjuster ? hypothesesDe(ligne, d, avantDernier) : null
  const bDernier = avantH ? calculerBudget(avantH.hypotheses, parametres) : null
  const panneau = avecImpact && b && bAvant ? (
    <PanneauImpact
      key={`impact-${ligne.magasin}`} cote={impactACote}
      enregistre={impactBudget(b, bAvant, tresorerie, tresoAvant)}
      siege={bSiege ? impactBudget(b, bSiege, tresorerie, tresoSiege) : null}
      referenceParDefaut={peutAjuster ? 'enregistre' : 'siege'}
      dernier={bDernier && avantDernier ? { libelle: libelleDernier(avantDernier, brouillon, nomsFrais), ca: b.ca - bDernier.ca, ebe: b.ebe - bDernier.ebe } : null}
      onAnnulerDernier={avantDernier ? () => setBrouillon(avantDernier) : undefined}
      changements={peutAjuster && modifie ? nombreChangements(ligne.ajustements, brouillon) : 0}
      onAnnuler={() => setBrouillon(ligne.ajustements)} onEnregistrer={peutAjuster ? enregistrer : undefined}
      occupe={occupe} desactive={!enregistrable} avertissement={enregistrable ? undefined : 'La saisonnalité doit faire 100 %.'}
      infos={{ ca: <DetailCalcul quoi="ca" budget={b} annee={annee} />, marge: <DetailCalcul quoi="marge" budget={b} annee={annee} />, ebe: <DetailCalcul quoi="ebe" budget={b} annee={annee} /> }}
    />
  ) : null

  // Lot 38 (D1) : passer d'une étape du budget à la suivante sans remonter en haut de page
  // Lot 43 : du point de départ aussi (la trésorerie au 1er janvier y est un ajustement) ; seules les parts de l'année
  // saisies au point de départ, et la fiche de l'équipe, demandent confirmation
  const allerEtape = (cle: string) => garde(() => aller(cle), espace === 'budget' && onglet !== 'equipe')
  const iEtape = espace === 'budget' && !themeOuvert ? parties.findIndex((x) => x.cle === etapeDe(onglet)) : -1
  const etapeAvant = iEtape > 0 ? parties[iEtape - 1] : null
  const etapeApres = iEtape >= 0 && iEtape < parties.length - 1 ? parties[iEtape + 1] : null
  const sansNumero = (t: string) => t.replace(/^\d · /, '')
  const piedEtapes = iEtape >= 0 ? (
    <Box component="nav" aria-label="Étape précédente ou suivante" className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      {etapeAvant && (
        <Button variant="text" startIcon={<ChevronLeftOutlined />} onClick={() => allerEtape(etapeAvant.cle)} sx={{ minHeight: 48 }}>{sansNumero(etapeAvant.libelle)}</Button>
      )}
      <Box sx={{ flex: 1 }} />
      <Typography variant="body2" color="text.secondary">Étape {iEtape + 1} sur {parties.length}</Typography>
      {etapeApres && (
        <Button variant="contained" endIcon={<ChevronRightOutlined />} onClick={() => allerEtape(etapeApres.cle)} sx={{ minHeight: 48 }}>
          Étape suivante : {sansNumero(etapeApres.libelle)}
        </Button>
      )}
    </Box>
  ) : null
  // Lot 38 (D2) : statut du budget de l'espace affiché (budget en préparation, ou budget de l'année suivie) et actions
  const ligneN = budgetsN.donnees?.magasins.find((l) => l.magasin === ligne.magasin)
  const statutEntete = espace === 'budget' ? { annee, statut: ligne.statut }
    : espace === 'suivi' && ligneN ? { annee: anneeEnCours, statut: ligneN.statut } : null
  const actionsEntete = espace === 'budget' && b ? (
    <Stack direction="row" useFlexGap spacing={1} className="pas-a-l-impression" aria-label="Exporter ou imprimer le budget">
      <Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exporter} sx={{ minHeight: 48 }}>Exporter en Excel</Button>
      <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()} sx={{ minHeight: 48, display: { xs: 'none', md: 'inline-flex' } }}>Imprimer</Button>
    </Stack>
  ) : null

  return (
    <Box>
      {retour}
      {/* Lot 38 (D2) : un en-tête unique, nom, budget et son statut, actions ; le statut ne se répète plus dans la page */}
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 1, flexWrap: 'wrap', mb: espace === 'budget' && ligne.base ? 0.5 : 3 }}>
        <Typography variant="h1">{ligne.magasin}</Typography>
        {statutEntete && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" color="text.secondary" component="span">Budget {statutEntete.annee}</Typography>
            <PastilleStatut statut={statutEntete.statut} />
          </Box>
        )}
        {actionsEntete && <Box sx={{ flex: 1 }} />}
        {actionsEntete}
      </Box>
      {espace === 'budget' && ligne.base && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {`${nbEcarts === 0 ? 'Aucun écart' : nbEcarts === 1 ? '1 écart' : `${nbEcarts} écarts`} aux cibles du siège`}
          <Box component="span" className="impression-seule"> · imprimé le {new Date().toLocaleDateString('fr-FR')}</Box>
        </Typography>
      )}

      {/* Option A (Joseph, 03/11/2026) : trois onglets (Suivi, Budget, Saisies). Le Suivi tient sur une page ; les étapes
          du budget se lisent en frise (une progression, pas des onglets) ; les saisies gardent leurs pages en puces */}
      <Box component="nav" aria-label="Pages du magasin" className="pas-a-l-impression" sx={{ mb: 3 }}>
        <Tabs value={espace} onChange={(_, v: Espace) => garde(() => aller(PARTIE_PAR_DEFAUT[v]), v === espace)} variant="scrollable" scrollButtons={false}
          aria-label="Espaces du magasin" sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 48, fontWeight: 700, fontSize: '1rem', px: { xs: 2, md: 3 } } }}>
          {ESPACES.map((e) => {
            const manque = ESPACE_MANQUES[e.cle].map((k) => manques[k]).find(Boolean)
            return <Tab key={e.cle} value={e.cle} label={<LibelleOnglet texte={libelleEspace(e.cle, anneeEnCours, annee)} manque={!!manque} detail={manque?.detail ?? ''} />} />
          })}
        </Tabs>
        {espace === 'budget' && (
          <Tabs value={etapeDe(onglet)} onChange={(_, v: string) => allerEtape(v)} variant="scrollable" scrollButtons={false}
            aria-label={`Étapes du budget ${annee}`}
            sx={{ mt: 2, minHeight: 56, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTabs-flexContainer': { gap: 0 },
              '& .MuiTab-root': { minHeight: 56, px: 1, py: 0.5, alignItems: 'center', textAlign: 'left', color: 'text.primary', opacity: 1, fontWeight: 400, textTransform: 'none',
                flexDirection: 'row', gap: 1.25, '&:not(:last-of-type)::after': { content: '""', width: { xs: 16, md: 40 }, height: 2, bgcolor: 'divider', ml: { xs: 0.5, md: 1.5 } } },
              '& .MuiTab-root.Mui-selected': { fontWeight: 800, color: 'text.primary' },
              '& .rond-etape': { width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, border: 2, borderColor: 'divider', bgcolor: 'background.paper' },
              '& .Mui-selected .rond-etape': { borderColor: 'text.primary', bgcolor: 'text.primary', color: 'background.paper' } }}>
            {parties.map((x) => {
              const [numero, nomEtape] = x.libelle.split(' · ')
              return (
                <Tab key={x.cle} value={x.cle} aria-current={etapeDe(onglet) === x.cle ? 'step' : undefined}
                  onClick={themeOuvert && x.cle === 'budget' ? () => (onglet === 'equipe' ? garde(() => aller('budget')) : aller('budget')) : undefined}
                  label={<>
                    <Box component="span" className="rond-etape">{numero}<Box component="span" sx={visuellementCache}> · </Box></Box>
                    <LibelleOnglet texte={nomEtape ?? x.libelle} manque={!!manques[x.cle]} detail={manques[x.cle]?.detail ?? ''} marque={marquesMenu[x.cle]} />
                  </>} />
              )
            })}
          </Tabs>
        )}
        {espace === 'donnees' && (
          <Tabs value={onglet} onChange={(_, v: string) => allerEtape(v)} variant="scrollable" scrollButtons="auto" aria-label="Saisies du magasin"
            sx={{ mt: 1.5, minHeight: 48, '& .MuiTabs-indicator': { display: 'none' }, '& .MuiTabs-flexContainer': { gap: 1 },
              '& .MuiTab-root': { minHeight: 48, borderRadius: 999, px: 2, py: 0.75, alignItems: 'flex-start', textAlign: 'left', color: 'text.primary', border: 1, borderColor: 'divider', bgcolor: 'background.paper' },
              '& .MuiTab-root.Mui-selected': { bgcolor: 'text.primary', color: 'background.paper', borderColor: 'text.primary' } }}>
            {parties.map((x) => (
              <Tab key={x.cle} value={x.cle} aria-current={onglet === x.cle ? 'page' : undefined}
                label={<LibelleOnglet texte={x.libelle} manque={!!manques[x.cle]} detail={manques[x.cle]?.detail ?? ''} />} />
            ))}
          </Tabs>
        )}
      </Box>
      <AvecCommentaires actif={espace === 'budget' && !!ligne.base} magasin={ligne.magasin} annee={annee} moi={profil}>
      {(commentaires, ouvertsC) => (<>
      {themeOuvert && (
        <Box className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Button component={RouterLink} to={lienMagasin(ligne.magasin, 'budget')} data-sans-garde={onglet === 'equipe' ? undefined : ''} startIcon={<ArrowBack />} sx={{ minHeight: 48 }}>
            Toutes les hypothèses
          </Button>
          <Typography variant="h2">{themeOuvert.libelle} {annee}</Typography>
          <BoutonCommenter ancre={`theme/${themeOuvert.cle}`} libelle={themeOuvert.libelle} />
        </Box>
      )}

      <AvecImpact panneau={panneau} commentaires={commentaires} cote={impactACote}>
      {onglet === 'synthese' ? (
        <Stack spacing={3}>
        <SyntheseMagasin key={ligne.magasin} magasin={ligne.magasin} d={d} annee={anneeEnCours} parametres={donnees.parametresN} allerA={aller}
          visiteEtActions={!franchise && profil?.role !== 'aucun'} proposerAction={!franchise && profil?.role !== 'aucun' ? (intitule) => setProposition({ intitule, n: Date.now() }) : undefined}
          quoiFaire={<>
            {franchise && (
              <AFaireFranchise
                key={`a-faire-${ligne.magasin}`} magasin={ligne.magasin} allerA={(o, a) => { if (a) setAnneeQuadri(a); aller(o) }}
                moisRenseignes={reel.donnees ? syntheseReel(reel.donnees.lignes, reel.donnees.tickets).moisRenseignes : null}
                budget={{ annee, statut: ligne.statut, avant: campagneDe(parametres, annee).validation }} aEquipe={!!d.equipes[ligne.magasin]?.length} aFrais={!!d.frais[ligne.magasin]?.length}
              />
            )}
            <AlertesEtActions key={`alertes-${ligne.magasin}`} magasin={ligne.magasin} equipe={!franchise && profil?.role !== 'aucun'} proposition={proposition} />
          </>}
          conclusion={<SuiviBudget key={`conclusion-${ligne.magasin}`} magasin={ligne.magasin} annee={anneeEnCours} allerA={aller} vue="conclusion" />}
          detail={<>
            <SuiviBudget key={`detail-${ligne.magasin}`} magasin={ligne.magasin} annee={anneeEnCours} allerA={aller} vue="detail" />
            <Stack spacing={2} component="section" aria-label="Comptes du quadrimestre" id="partie-quadrimestres" sx={{ scrollMarginTop: 80 }}>
              <Typography variant="h2">Comptes du quadrimestre</Typography>
              {anneeChoix(anneeQuadri, (v) => setAnneeQuadri(v), 'Année des comptes')}
              <QuadrimestresMagasin key={`${ligne.magasin}-${anneeQuadri}-compte`} magasin={ligne.magasin} annee={anneeQuadri} peutSaisir={peutSaisir} vue="compte" />
            </Stack>
          </>}
          plusLoin={franchise ? undefined : <>
            <ComparaisonMagasin key={`comparaison-${ligne.magasin}`} magasin={ligne.magasin} directeur={directeur} />
            <FamillesReseau key={`familles-${ligne.magasin}`} magasin={ligne.magasin} directeur={directeur} />
          </>}
        />
        {/* Option A (Joseph, 03/11/2026) : le Suivi sur une page ; atterrissage, trésorerie et stock en sections repliées,
            ouvertes d'office quand un lien y mène */}
        {alerteMessage}
        {SECTIONS_SUIVI(anneeEnCours).map((x) => (
          <Box key={`${x.cle}-${sectionOuverte === x.cle}`} id={`partie-${x.cle}`} sx={{ scrollMarginTop: 80 }}>
            <Repliable titre={x.libelle} nom={x.libelle} ouvert={sectionOuverte === x.cle}
              droite={manques[x.cle] ? <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 700 }}>{manques[x.cle]!.detail === 'budget à proposer' ? 'Budget à proposer' : manques[x.cle]!.detail}</Typography> : undefined}>
              <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5 }}>
                {x.cle === 'atterrissage' ? (
                  <AtterrissageMagasin
                    key={ligne.magasin} ligne={ligne} d={d} annee={anneeEnCours} anneeBudget={annee} parametres={donnees.parametresN}
                    directeur={directeur} peutSaisir={peutSaisir} allerA={aller} apresProposition={recharger} repartition={ligne.ajustements.poidsMois}
                  />
                ) : x.cle === 'tresorerie' ? (
                  <Stack spacing={2}>
                    {anneeChoix(anneeQuadri, (v) => setAnneeQuadri(v), 'Année de la trésorerie')}
                    <QuadrimestresMagasin key={`${ligne.magasin}-${anneeQuadri}-tresorerie`} magasin={ligne.magasin} annee={anneeQuadri} peutSaisir={peutSaisir} vue="tresorerie" />
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    {anneeChoix(anneeReel, (v) => setAnneeReel(v), 'Année du stock')}
                    <StockMagasin key={`${ligne.magasin}-${anneeReel}`} magasin={ligne.magasin} annee={anneeReel} peutSaisir={false} />
                  </Stack>
                )}
              </Box>
            </Repliable>
          </Box>
        ))}
        </Stack>
      ) : onglet === 'saisieStock' ? (
        <Stack spacing={2}>
          {anneeChoix(anneeReel, (v) => setAnneeReel(v), 'Année du stock')}
          <StockMagasin key={`${ligne.magasin}-${anneeReel}-saisie`} magasin={ligne.magasin} annee={anneeReel} peutSaisir={peutSaisir} />
        </Stack>
      ) : onglet === 'reel' ? (
        <Stack spacing={2}>
          <ToggleButtonGroup exclusive size="small" value={anneeReel} onChange={(_, v: number | null) => v && setAnneeReel(v)} aria-label="Année du réel">
            {[anneeEnCours, anneeEnCours - 1].map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: 48, minWidth: 72 }}>{a}</ToggleButton>)}
          </ToggleButtonGroup>
          <ReelAnnee key={`${ligne.magasin}-${anneeReel}`} magasin={ligne.magasin} annee={anneeReel} peutSaisir={peutSaisir} apresEnregistrement={reel.recharger} />
        </Stack>
      ) : onglet === 'quadrimestres' ? (
        <Stack spacing={2} id="partie-quadrimestres" sx={{ scrollMarginTop: 80 }}>
          <Typography variant="h2">Quadrimestres comptables</Typography>
          {anneeChoix(anneeQuadri, (v) => garde(() => setAnneeQuadri(v)), 'Année des quadrimestres')}
          <QuadrimestresMagasin key={`${ligne.magasin}-${anneeQuadri}`} magasin={ligne.magasin} annee={anneeQuadri} peutSaisir={peutSaisir} />
        </Stack>
      ) : onglet === 'equipe' ? (
        <Stack spacing={3}>
        {alerteMessage}
        {/* Joseph (03/11/2026) : avec les cartes, la hausse générale des salaires se règle dans le thème Équipe */}
        {communHypotheses && resolu && b && (
          <Card component="section" aria-label="Hypothèse des salaires">
            <TableauHypotheses titre={`Hypothèses ${annee} : salaires`} annee={annee} effet>
              <HypotheseCle cle="hausseSalaires" nom="Hausse générale des salaires" libelle="Hausse générale des salaires" quoi="hausse générale des salaires" aide="hausseSalaires"
                apres={`${milliers(b.personnel)} · ${taux(b.ratios.pctFP)} de FP`} effet={<Effet ebe={b.ebe - ebeAvec('hausseSalaires', 0)} />} {...communHypotheses} />
            </TableauHypotheses>
          </Card>
        )}
        <EquipeMagasin
          key={ligne.magasin} magasin={ligne.magasin} equipe={d.equipes[ligne.magasin] ?? []} annee={anneeEnCours} anneeBudget={annee}
          hausse={resolu?.hypotheses.hausseSalaires ?? valeurHeritee(niveauxDe(ligne, d, brouillon), 'hausseSalaires')?.valeur ?? 0}
          charges={donnees.parametresN.charges} chargesBudget={parametres.charges}
          peutSaisir={peutSaisir} apresEnregistrement={recharger} caAnnee={b?.atterrissage} caBudget={b?.ca} ebeBudget={b?.ebe}
        />
        {barreBudget}
        </Stack>
      ) : onglet === 'frais' ? (
        <FraisMagasin key={ligne.magasin} magasin={ligne.magasin} lignes={d.frais[ligne.magasin] ?? []} annee={anneeEnCours} peutSaisir={peutSaisir} apresEnregistrement={recharger}
          prets={pretsValides(d.prets?.[ligne.magasin]).length ? pretsDeLAnnee(d.prets?.[ligne.magasin], anneeEnCours) : null}
          tauxSurCA={{ publicite: parametres.tauxPublicite, redevance: parametres.tauxRedevance }} grille={grilleDe(parametres)}
          budget={b ? { annee, ca: b.ca, ebe: b.ebe } : undefined} />
      ) : (<Stack spacing={3}>

      {alerteMessage}

      {b && !themeOuvert && (
        <>
          {/* Lot 42 (proposition 4) : le résultat reste en vue et se recalcule à chaque changement ; sur Construire, c'est le panneau Impact */}
          {!avecImpact && <ResultatDirect budget={b} ebeSiege={ebeSiege} tresorerie={tresorerie} annee={annee}
            infos={{ ca: <DetailCalcul quoi="ca" budget={b} annee={annee} />, marge: <DetailCalcul quoi="marge" budget={b} annee={annee} />, ebe: <DetailCalcul quoi="ebe" budget={b} annee={annee} /> }} />}

          {(peutValider && ligne.base) || (directeur && ligne.base && !copie) || (franchise && peutAjuster && onglet !== 'echanges') ? <Stack direction="row" useFlexGap spacing={1.5} className="pas-a-l-impression" sx={{ flexWrap: 'wrap' }} aria-label="Actions sur le budget">
            {/* Lot 41 : envoyer et valider se font à l'étape 3, après le résultat, devant les changements du magasin */}
            {franchise && peutAjuster && onglet !== 'echanges' && (
              <Button variant="contained" startIcon={<SendOutlined />} onClick={() => allerEtape('echanges')} sx={{ minHeight: 48 }}>
                {ligne.statut === 'en_discussion' ? 'Revoir mon envoi au siège' : 'Envoyer au siège'}
              </Button>
            )}
            {peutValider && ligne.base && ligne.statut !== 'valide' && onglet !== 'echanges' && (
              <Button variant="outlined" color="success" startIcon={<FactCheckOutlined />} onClick={() => allerEtape('echanges')} sx={{ minHeight: 48 }}>
                Revoir et valider
              </Button>
            )}
            {peutValider && ligne.statut === 'valide' && resolu && (
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
          </Stack> : null}
          {copie && (
            <CopieHypotheses source={ligne.magasin} occupe={occupe} onCopier={copier} onFermer={() => setCopie(false)} ebe={ebeCopie}
              destinations={destinations.map((l) => ({ magasin: l.magasin, statut: l.statut as 'propose' | 'en_discussion', groupe: l.groupeId ? groupesNoms.get(l.groupeId) ?? '' : '', tranche: trancheMillesime(d.ouvertures?.[l.magasin], annee) }))} />
          )}
        </>
      )}

      {onglet === 'echanges' ? (
        <>
          {revue && (
            <RevueChangements
              franchise={franchise} themes={revue.themes} total={revue.total} ebeSiege={revue.ebeSiege} ebeMagasin={revue.ebeMagasin}
              envoyeLe={ligne.envoyeLe} statut={ligne.statut} occupe={occupe} onEnvoyer={franchise && peutAjuster ? envoyer : undefined}
              validation={boutonValider ? {
                points: pointsAvantValidation({ tresorerieDepart: brouillon.tresorerieDepart, estimee: estimee ? milliers(estimee.montant) : undefined, pointBas: tresorerie?.pointBas ?? null, changementsNonEnvoyes: ligne.statut === 'propose' && revue.effets.length > 0, commentairesOuverts: ouvertsC }, MOIS_LONGS),
                bouton: boutonValider,
              } : undefined}
            />
          )}
          {profil && <HistoriqueBudget key={`historique-${ligne.magasin}`} ligne={ligne} d={d} annee={annee} parametres={parametres} />}
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
          {/* Joseph (03/11/2026) : sur « Construire », toutes les hypothèses en cartes, les ventes de chaque univers comprises */}
          {onglet === 'budget' && resolu && (
            <Box className="pas-a-l-impression">
              <HypothesesCartes magasin={ligne.magasin} annee={annee} budget={b} cibles={brouillon} hausseSalaires={resolu.hypotheses.hausseSalaires ?? 0}
                inflation={inflation} sansEquipe={!d.equipes[ligne.magasin]?.length} sansFrais={!baseFrais?.frais.length} lectureSeule={!peutAjuster}
                reprise={resolu.hypotheses.reprise} accord={accordTheme ?? undefined}
                depart={{ annee: anneeEnCours, tresorerie: brouillon.tresorerieDepart ?? estimee?.montant ?? null, estimee: brouillon.tresorerieDepart === undefined && !!estimee, saisonnalite: !!brouillon.poidsMois }} />
            </Box>
          )}
          <Stack spacing={3} className={partie('ventes')} id="partie-ventes" sx={{ scrollMarginTop: 200 }}>
            {communHypotheses && (
              <Card component="section" aria-label="Hypothèses du magasin">
                <HypothesesUnivers familles={b.familles} flux={b.flux} annee={annee} surCA={resolu ? tauxSurCA(resolu.hypotheses.frais, parametres) : 0} {...communHypotheses} />
                {accordTheme && <Box className="pas-a-l-impression" sx={{ px: 2.5, pb: 2 }}>{accordTheme('ventes', 'Ventes et marge')}</Box>}
              </Card>
            )}
          </Stack>
          {ligne.base && (
            <Stack spacing={3} className={partie('depart')} id="partie-depart" sx={{ scrollMarginTop: 80 }}>
              {/* Joseph (03/11/2026) : le point de départ est une carte de « Construire » : trésorerie au 1er janvier,
                  saisonnalité et base du CA ; l'atterrissage de l'année en cours est dans le Suivi */}
              <TresorerieDepart annee={annee} depart={brouillon.tresorerieDepart} estimee={estimee} lectureSeule={!peutAjuster} tresorerie={tresorerie}
                accord={accordTheme?.('tresoBudget', 'Point de départ')}
                onDepart={(v) => setBrouillon(({ tresorerieDepart: _, ...reste }) => (v === undefined ? reste : { ...reste, tresorerieDepart: v }))} />
              <SaisonnaliteMagasin budget={b} poids={brouillon.poidsMois} lectureSeule={!peutAjuster}
                onChange={(p) => setBrouillon(({ poidsMois: _, ...reste }) => (p ? { ...reste, poidsMois: p } : reste))} />
              <BaseCAMagasin
                key={`base-${ligne.magasin}`}
                magasin={ligne.magasin} budget={b} annee={annee} ouverture={d.ouvertures?.[ligne.magasin]}
                rythme={brouillon.rythme} directeur={directeur} peutAjuster={peutAjuster} apresOuverture={recharger} seuilRythme={reglesDe(parametres).seuilRythme}
                onRythme={(r) => setBrouillon(({ rythme: _, ...reste }) => (r ? { ...reste, rythme: r } : reste))}
              />
              <Box className="pas-a-l-impression">
                <Button variant="text" onClick={() => aller('atterrissage')} sx={{ minHeight: 48 }}>{`Voir l’atterrissage ${anneeEnCours} mois par mois`}</Button>
              </Box>
            </Stack>
          )}
          {ligne.base && (
            <Stack spacing={3} className={partie('calendrier')} id="partie-calendrier" sx={{ scrollMarginTop: 80 }}>
              {/* Joseph (03/11/2026) : « Évènements & Temps forts », temps forts et clients extérieurs face à l'an passé */}
              <QuestionsCalendrier cibles={brouillon} annee={annee} lectureSeule={!peutAjuster} onChange={setBrouillon} questions={QUESTIONS_CALENDRIER} etat={etatCalendrier(brouillon)} />
              <Box id={ANCRES_QUESTIONS.tempsForts} sx={{ scrollMarginTop: 200 }}>
                <Box id={ANCRES_QUESTIONS.ajustementsCA} sx={{ scrollMarginTop: 200 }} />
                <EvenementsMagasin cibles={brouillon} onChange={setBrouillon} lectureSeule={!peutAjuster} annee={annee} />
              </Box>
            </Stack>
          )}
          {ligne.base && resolu && (
            <Stack spacing={3} className={partie('investissements')} id="partie-investissements" sx={{ scrollMarginTop: 80 }}>
              {/* Joseph (03/11/2026) : travaux, achats et emprunts, et ce qu'il reste de la capacité d'autofinancement */}
              <QuestionsCalendrier cibles={brouillon} annee={annee} lectureSeule={!peutAjuster} onChange={setBrouillon} questions={QUESTIONS_INVESTISSEMENTS} etat={etatInvestissements(brouillon)} />
              <Box id={ANCRES_QUESTIONS.travaux} sx={{ scrollMarginTop: 200 }}>
                <TravauxMagasin
                  key={`${ligne.magasin}-${!!brouillon.travaux}`}
                  travaux={brouillon.travaux} lectureSeule={!peutAjuster}
                  effetCA={sansTravaux ? b.ca - sansTravaux.ca : 0} dotation={effetTravaux(resolu.hypotheses.travaux).dotation}
                  onChange={(t) => setBrouillon(({ travaux: _, ...reste }) => (t ? { ...reste, travaux: t } : reste))}
                />
              </Box>
              <Box id={ANCRES_QUESTIONS.investissements} sx={{ scrollMarginTop: 200 }}>
                <AchatsMagasin cibles={brouillon} onChange={setBrouillon} lectureSeule={!peutAjuster} annee={annee} />
              </Box>
              <Box id={ANCRES_QUESTIONS.emprunts} sx={{ scrollMarginTop: 200 }}>
                <FinancementsMagasin cibles={brouillon} onChange={setBrouillon} lectureSeule={!peutAjuster} annee={annee} enCours={resolu.hypotheses}
                  avecPrets={pretsValides(d.prets?.[ligne.magasin]).length > 0}
                  prets={<PretsMagasin key={ligne.magasin} magasin={ligne.magasin} prets={d.prets?.[ligne.magasin] ?? []} annee={annee} peutSaisir={peutSaisir} apresEnregistrement={rechargerEnGardant} />} />
              </Box>
              <CapaciteAutofinancement budget={b} annee={annee} />
            </Stack>
          )}
          {ligne.base && baseFrais && (
            <Stack spacing={3} className={partie('fraisBudget')}>
              {/* Joseph (03/11/2026) : avec les cartes, l'inflation des frais se règle dans le thème Frais */}
              {communHypotheses && resolu && (
                <Card component="section" aria-label="Hypothèse des frais">
                  <TableauHypotheses titre={`Hypothèses ${annee} : frais`} annee={annee} effet>
                    <HypotheseCle cle="inflationFrais" nom="Inflation des frais" libelle="Inflation des frais" quoi="inflation des frais" aide="inflationFrais"
                      apres={`${milliers(b.chargesExternes + b.impotsTaxes - b.redevance - b.publicite)} de frais`} effet={<Effet ebe={b.ebe - ebeAvec('inflationFrais', 0)} />} {...communHypotheses} />
                  </TableauHypotheses>
                </Card>
              )}
              <FraisBudget base={baseFrais} choix={brouillon.fraisBudget} inflation={inflation} annee={annee} anneeEnCours={anneeEnCours} lectureSeule={!peutAjuster}
                tauxSurCA={{ publicite: parametres.tauxPublicite, redevance: parametres.tauxRedevance }} grille={grilleDe(parametres)}
                prets={pretsDeuxAnnees(d.prets?.[ligne.magasin], anneeEnCours, annee)}
                onChange={(c) => setBrouillon(({ fraisBudget: _, ...reste }) => (c ? { ...reste, fraisBudget: c } : reste))} />
            </Stack>
          )}
          <Stack spacing={3} className={partie('visualiser')} id="partie-resultat" sx={{ scrollMarginTop: 200 }}>
            {/* Joseph (03/11/2026) : le résultat et la trésorerie ont leur étape, « 2 · Visualiser » */}
            <Box className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h2">Résultat et trésorerie {annee}</Typography>
              <BoutonCommenter ancre="visualiser" libelle={`Résultat et trésorerie ${annee}`} />
            </Box>
            {resolu && <CompteResultatMois lignes={compteResultat(b, resolu.hypotheses, parametres)} titre={`Compte de résultat ${annee}`} libelleTableau={`Budget ${annee} mois par mois`} />}
            <CapaciteAutofinancement budget={b} annee={annee} />
            {resolu && b && <EconomieFranchise budget={b} hypotheses={resolu.hypotheses} parametres={parametres} annee={annee} />}
            {/* Lot 41 (proposition 4), puis Joseph (03/11/2026) : un EBE ou une rémunération du gérant visés, et ce qu'il faudrait */}
            {resolu && b && (
              <Box className="pas-a-l-impression">
                <SimulateurObjectif budget={b} economie={economieFranchise(b, resolu.hypotheses, parametres)} lectureSeule={!peutAjuster || ligne.statut === 'valide'}
                  ebeAvec={ebeAvec}
                  onAppliquer={(cle, x) => { setBrouillon((c) => ecrireCible(c, cle, x)); setMessage({ gravite: 'warning', texte: 'Valeur reportée dans les hypothèses. Enregistre les ajustements pour la garder.' }) }}
                />
              </Box>
            )}
            {tresorerie && (
              <TresorerieBudget key={ligne.magasin} tresorerie={tresorerie} annee={annee} depart={brouillon.tresorerieDepart} estimee={estimee} replie={franchise}
                versDepart={() => allerEtape('depart')} />
            )}
          </Stack>
        </>
      )}

      {barreBudget}
      </Stack>)}
      </AvecImpact>
      {piedEtapes}
      </>)}
      </AvecCommentaires>
    </Box>
  )
}

// Panneau Impact et commentaires (Joseph, 03/11/2026) : colonne de droite sur grand écran, l'Impact en haut et les
// commentaires dessous ; sinon les commentaires en fin de page et l'Impact en barre en bas d'écran
function AvecImpact({ panneau, commentaires, cote, children }: { panneau: ReactNode; commentaires: ReactNode; cote: boolean; children: ReactNode }) {
  if (!panneau && !commentaires) return <>{children}</>
  if (!cote) return <>{children}{commentaires && <Box sx={{ mt: 3 }}>{commentaires}</Box>}{panneau}</>
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', columnGap: 3, alignItems: 'start' }}>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
      <Box sx={{ position: 'sticky', top: 84, zIndex: 6, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', display: 'grid', gap: 2, pb: 0.5, px: 0.5, mx: -0.5 }}>
        {panneau}
        {commentaires}
      </Box>
    </Box>
  )
}
