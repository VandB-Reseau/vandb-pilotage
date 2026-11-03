import { useEffect, useState, type ReactNode } from 'react'
import { useSaisieEnCours } from '../components/GardeSaisie'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from '../components/ChampNombre'
import { ChampTaux } from '../components/ChampTaux'
import { ChoixListe } from '../components/ChoixListe'
import { EtatVide } from '../components/EtatVide'
import { Panne } from '../components/Panne'
import { SectionParametres } from '../components/SectionParametres'
import { GrilleFraisParametres } from '../components/GrilleFraisParametres'
import { ReglesCalculParametres } from '../components/ReglesCalculParametres'
import { reglesDe } from '../moteur/regles'
import { useAuth } from '../auth/AuthContext'
import { estDirecteur, peutParametrer } from '../auth/roles'
import {
  ajouterControleGestion, anneeBudget, chargerBudgets, chargerControleGestion, chargerJournal, chargerParametres, consoliderBudgets,
  copierParametres, enregistrerParametres, retirerControleGestion, type ParametresCharges,
} from '../data/pilotage'
import { decrireChangement, libelleRubrique } from '../lib/parametrage'
import { nombre } from '../import/caisse'
import { CATEGORIES, categorieLibelle } from '../moteur/equipe'
import { useChargement } from '../data/useChargement'
import type { ParametresAlertes } from '../moteur/alertes'
import { campagneDe, type Campagne } from '../moteur/campagne'
import { parametresParDefaut } from '../moteur/parametres'
import type { ParametresReseau } from '../moteur/types'
import type { OperationReseau, ParametresTresorerie } from '../moteur/tresorerie'
import { stockParDefaut } from '../moteur/stock'
import { UNIVERS, universLibelle, type Univers } from '../moteur/types'
import { dateHeure, ecartMontant, enChiffres, montant, MOIS_LONGS } from '../lib/format'
import { annees as anneesPilotage, anneeSuivi, changerAnnee, chargerAnnees, lignesAnnees, RefusAnnee } from '../data/annees'
import { etapesAnnees, type EtapeAnnee, type EtatAnnee, type LigneAnnee } from '../moteur/annees'

// Mois de stock affichés à la française (2,5)
const enChiffresMois = (v: number) => String(v).replace('.', ',')

const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const DE_L_UNIVERS: Record<Univers, string> = { cave: 'de la Cave', bar: 'du Bar', exterieur: 'de l’Extérieur' }

const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
type Message = { gravite: 'success' | 'error'; texte: string } | null
const ECHEC = 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.'
type Onglet = 'annees' | 'franchise' | 'equipe' | 'tresorerie' | 'alertes' | 'grille' | 'regles' | 'journal' | 'acces'
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'annees', libelle: 'Années' },
  { cle: 'franchise', libelle: 'Franchise et impôts' }, { cle: 'equipe', libelle: 'Équipe' }, { cle: 'tresorerie', libelle: 'Trésorerie' },
  { cle: 'alertes', libelle: 'Alertes et campagne' }, { cle: 'grille', libelle: 'Grille des frais' }, { cle: 'regles', libelle: 'Règles de calcul' },
  { cle: 'journal', libelle: 'Journal' }, { cle: 'acces', libelle: 'Accès' },
]
// Franchise et impôts (lot 39) : bornes de saisie
type Franchise = Pick<ParametresReseau, 'tauxRedevance' | 'tauxPublicite' | 'impot' | 'tvaPanier'>
const franchiseDe = (p: ParametresReseau): Franchise => ({ tauxRedevance: p.tauxRedevance, tauxPublicite: p.tauxPublicite, impot: p.impot, tvaPanier: p.tvaPanier })
const dans = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max

function Retour({ message, fermer }: { message: Message; fermer: () => void }) {
  return message && <Box sx={{ px: 2, pb: 1 }}><Alert severity={message.gravite} onClose={fermer} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>
}
function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return <TableRow><TableCell>{libelle}</TableCell><TableCell align="right">{children}</TableCell></TableRow>
}

export function Parametres() {
  const { profil } = useAuth()
  const lecture = !peutParametrer(profil)
  const directeur = estDirecteur(profil)
  const aujourdhui = anneeSuivi(), aB = anneeBudget()
  const annees = [...new Set([aujourdhui, aB, aB + 1])]
  const [annee, setAnnee] = useState(aB)
  const [onglet, setOnglet] = useState<Onglet>('franchise')
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerParametres(annee), [annee])
  const p = donnees?.parametres
  // Budgets de l'année, pour montrer l'effet d'un changement de redevance sur l'EBE des budgets pas encore validés
  const { donnees: budgets } = useChargement(() => (lecture ? Promise.resolve(null) : chargerBudgets(annee).catch(() => null)), [annee, lecture])
  // Franchise et impôts (lot 39)
  const [franchise, setFranchise] = useState<Franchise | null>(null)
  const [plafond, setPlafond] = useState('')
  const [messageFranchise, setMessageFranchise] = useState<Message>(null)
  const [charges, setCharges] = useState<ParametresCharges | null>(null)
  const [smic, setSmic] = useState('')
  const [puissance, setPuissance] = useState('')
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // Trésorerie : délais en mois gardés en texte pendant la frappe
  const [treso, setTreso] = useState<ParametresTresorerie | null>(null)
  const [delais, setDelais] = useState({ fournisseurs: '', livraison: '', redevance: '', ecoulement: '', remboursement: '', exterieur: '', stockCave: '', stockBar: '' })
  const [messageTreso, setMessageTreso] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  // Seuils des alertes : textes pendant la frappe, sauf l'écart de CA (pourcentage)
  const [ecartCA, setEcartCA] = useState<number | undefined>(undefined)
  const [baisseTickets, setBaisseTickets] = useState<number | undefined>(undefined)
  const [baissePanier, setBaissePanier] = useState<number | undefined>(undefined)
  const [seuils, setSeuils] = useState({ marge: '', retard: '', tresorerie: '' })
  const [messageAlertes, setMessageAlertes] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  // Campagne des budgets (lot 28) : trois dates
  const [campagne, setCampagne] = useState<Campagne | null>(null)
  const [messageCampagne, setMessageCampagne] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  useEffect(() => {
    if (!p) return
    setFranchise(franchiseDe(p))
    setPlafond(enChiffres(p.impot.plafondTauxReduit))
    setEcartCA(p.alertes.ecartCA)
    setCampagne(campagneDe(p, annee))
    setBaisseTickets(p.alertes.baisseTickets)
    setBaissePanier(p.alertes.baissePanier)
    setSeuils({ marge: String(Math.round(p.alertes.baisseMarge * 1000) / 10).replace('.', ','), retard: String(p.alertes.moisRetard), tresorerie: enChiffres(p.alertes.tresorerie) })
    setTreso(p.tresorerie)
    setDelais({
      fournisseurs: String(p.tresorerie.delaiFournisseurs), livraison: String(p.tresorerie.avanceLivraison ?? 1), redevance: String(p.tresorerie.delaiRedevance),
      ecoulement: String(p.tresorerie.consignes?.ecoulement ?? 0), remboursement: String(p.tresorerie.consignes?.remboursement ?? 0),
      exterieur: String(p.tresorerie.avanceExterieur ?? 0), stockCave: enChiffresMois((p.tresorerie.stock ?? stockParDefaut).mois.cave), stockBar: enChiffresMois((p.tresorerie.stock ?? stockParDefaut).mois.bar),
    })
    setCharges(p.charges)
    setSmic(String(p.charges.reduction.smicAnnuel).replace('.', ','))
    setPuissance(String(p.charges.reduction.puissance).replace('.', ','))
  }, [p])
  const plafondLu = nombre(plafond)
  const franchiseLue: Franchise | null = franchise && plafondLu !== null && dans(plafondLu, 0, 10_000_000)
    && dans(franchise.tauxRedevance, 0, 0.1) && dans(franchise.tauxPublicite, 0, 0.1)
    && dans(franchise.impot.tauxReduit, 0, 0.5) && dans(franchise.impot.tauxNormal, 0, 0.5)
    && dans(franchise.tvaPanier.cave, 0, 0.3) && dans(franchise.tvaPanier.bar, 0, 0.3)
    ? { ...franchise, impot: { ...franchise.impot, plafondTauxReduit: plafondLu } } : null
  const franchiseModifiee = !!p && !!franchise && !egal(franchiseLue ?? franchise, franchiseDe(p))
  useSaisieEnCours(franchiseModifiee)
  const champFranchise = <K extends keyof Franchise>(k: K, v: Franchise[K]) => setFranchise((f) => (f ? { ...f, [k]: v } : f))
  // Effet sur l'EBE des budgets pas encore validés (les budgets validés gardent les paramètres de leur validation)
  const nonValides = budgets?.magasins.filter((l) => l.statut && l.statut !== 'valide').map((l) => l.magasin) ?? []
  const effet = p && budgets && franchiseLue && franchiseModifiee && nonValides.length > 0
    ? { avant: consoliderBudgets(budgets, p, nonValides), apres: consoliderBudgets(budgets, { ...p, ...franchiseLue }, nonValides) } : null
  const enregistrerFranchise = async () => {
    if (!p || !franchiseLue) return
    setOccupe(true)
    setMessageFranchise(null)
    try {
      await enregistrerParametres(annee, { ...p, ...franchiseLue })
      setMessageFranchise({ gravite: 'success', texte: `Franchise et impôts ${annee} enregistrés.` })
      recharger()
    } catch {
      setMessageFranchise({ gravite: 'error', texte: ECHEC })
    } finally {
      setOccupe(false)
    }
  }
  const taux_ = (k: keyof ParametresCharges['taux'], v: number | undefined) => setCharges((c) => (c ? { ...c, taux: { ...c.taux, [k]: v ?? 0 } } : c))
  const reduction = (k: keyof ParametresCharges['reduction'], v: number | undefined) => setCharges((c) => (c ? { ...c, reduction: { ...c.reduction, [k]: v ?? 0 } } : c))
  const smicLu = nombre(smic), puissanceLue = nombre(puissance)
  const chargesModifiees = !!p && !!charges && (JSON.stringify(charges) !== JSON.stringify(p.charges) || smicLu !== p.charges.reduction.smicAnnuel || puissanceLue !== p.charges.reduction.puissance)
  useSaisieEnCours(chargesModifiees)
  const valides = smicLu !== null && !Number.isNaN(smicLu) && smicLu > 0 && puissanceLue !== null && !Number.isNaN(puissanceLue) && puissanceLue > 0
  const enregistrer = async () => {
    if (!p || !charges || !valides) return
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerParametres(annee, { ...p, charges: { ...charges, reduction: { ...charges.reduction, smicAnnuel: smicLu!, puissance: puissanceLue! } } })
      setMessage({ gravite: 'success', texte: `Charges sociales ${annee} enregistrées.` })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const delai = (t: string, max = 3) => { const n = nombre(t); return n !== null && Number.isInteger(n) && n >= 0 && n <= max ? n : null }
  const delaisLus = { delaiFournisseurs: delai(delais.fournisseurs), avanceLivraison: delai(delais.livraison), delaiRedevance: delai(delais.redevance), avanceExterieur: delai(delais.exterieur) }
  const delaisConsignes = { ecoulement: delai(delais.ecoulement, 6), remboursement: delai(delais.remboursement, 6) }
  // Stock cible en mois d'achats à venir (03/11/2026) : décimales permises (2,5), 12 mois au plus
  const moisStock = (t: string) => { const n = nombre(t); return n !== null && n >= 0 && n <= 12 ? n : null }
  const stockLu = { cave: moisStock(delais.stockCave), bar: moisStock(delais.stockBar) }
  const tresoValide = Object.values({ ...delaisLus, ...delaisConsignes, ...stockLu }).every((v) => v !== null)
  const tresoLue = (t: ParametresTresorerie): ParametresTresorerie => ({
    ...t, delaiFournisseurs: delaisLus.delaiFournisseurs ?? 0, avanceLivraison: delaisLus.avanceLivraison ?? 0, delaiRedevance: delaisLus.delaiRedevance ?? 0, avanceExterieur: delaisLus.avanceExterieur ?? 0,
    stock: { ...(t.stock ?? stockParDefaut), mois: { ...(t.stock ?? stockParDefaut).mois, cave: stockLu.cave ?? 0, bar: stockLu.bar ?? 0 } },
    consignes: t.consignes && { ...t.consignes, ecoulement: delaisConsignes.ecoulement ?? 0, remboursement: delaisConsignes.remboursement ?? 0 },
  })
  const tresoModifiee = !!p && !!treso && JSON.stringify(tresoLue(treso)) !== JSON.stringify(p.tresorerie)
  useSaisieEnCours(tresoModifiee)
  const enregistrerTreso = async () => {
    if (!p || !treso || !tresoValide) return
    setOccupe(true)
    setMessageTreso(null)
    try {
      await enregistrerParametres(annee, { ...p, tresorerie: tresoLue(treso) })
      setMessageTreso({ gravite: 'success', texte: `Paramètres de trésorerie ${annee} enregistrés.` })
      recharger()
    } catch {
      setMessageTreso({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const margeLue = nombre(seuils.marge), retardLu = nombre(seuils.retard), tresorerieLue = nombre(seuils.tresorerie)
  const alertesLues: ParametresAlertes | null = ecartCA !== undefined && ecartCA >= 0
    && margeLue !== null && !Number.isNaN(margeLue) && margeLue >= 0
    && retardLu !== null && Number.isInteger(retardLu) && retardLu >= 0 && retardLu <= 12
    && tresorerieLue !== null && !Number.isNaN(tresorerieLue)
    && baisseTickets !== undefined && baisseTickets >= 0 && baissePanier !== undefined && baissePanier >= 0
    ? { ecartCA, baisseMarge: margeLue / 100, moisRetard: retardLu, tresorerie: tresorerieLue, baisseTickets, baissePanier } : null
  const alertesModifiees = !!p && seuils.retard !== '' && JSON.stringify(alertesLues) !== JSON.stringify(p.alertes)
  useSaisieEnCours(alertesModifiees)
  const campagneValide = !!campagne && !!campagne.proposition && campagne.proposition <= campagne.retour && campagne.retour <= campagne.validation
  const campagneModifiee = !!p && !!campagne && JSON.stringify(campagne) !== JSON.stringify(campagneDe(p, annee))
  useSaisieEnCours(campagneModifiee)
  const enregistrerCampagne = async () => {
    if (!p || !campagne || !campagneValide) return
    setOccupe(true)
    setMessageCampagne(null)
    try {
      await enregistrerParametres(annee, { ...p, campagne })
      setMessageCampagne({ gravite: 'success', texte: `Dates de la campagne des budgets ${annee} enregistrées.` })
      recharger()
    } catch {
      setMessageCampagne({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const enregistrerAlertes = async () => {
    if (!p || !alertesLues) return
    setOccupe(true)
    setMessageAlertes(null)
    try {
      await enregistrerParametres(annee, { ...p, alertes: alertesLues })
      setMessageAlertes({ gravite: 'success', texte: 'Seuils des alertes enregistrés.' })
      recharger()
    } catch {
      setMessageAlertes({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  const consigne = (u: Univers, v: number | undefined) =>
    setTreso((t) => (t?.consignes ? { ...t, consignes: { ...t.consignes, achats: { ...t.consignes.achats, [u]: v ?? 0 } } } : t))
  const operation = (i: number, o: Partial<OperationReseau> | null) => setTreso((t) => {
    if (!t) return t
    const l = t.operations ?? []
    return { ...t, operations: o ? l.map((x, j) => (j === i ? { ...x, ...o } : x)) : l.filter((_, j) => j !== i) }
  })
  const tvaTreso = (k: 'tvaVentes' | 'tvaAchats' | 'tvaFrais' | 'partCotisations', v: number | undefined) => setTreso((t) => (t ? { ...t, [k]: v ?? 0 } : t))

  // Copie vers l'année suivante (lot 39)
  const [copie, setCopie] = useState(false)
  const [messageCopie, setMessageCopie] = useState<Message>(null)
  const { donnees: copieCible } = useChargement(() => (copie ? chargerParametres(annee + 1) : Promise.resolve(null)), [copie, annee])
  const copier = async () => {
    setOccupe(true)
    setMessageCopie(null)
    try {
      await copierParametres(annee, annee + 1)
      setCopie(false)
      setAnnee(annee + 1)
      setMessageCopie({ gravite: 'success', texte: `Paramètres ${annee} copiés vers ${annee + 1}.` })
    } catch {
      setCopie(false)
      setMessageCopie({ gravite: 'error', texte: 'La copie n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }
  // Lot 40 : grille des frais et règles de calcul, saisies dans leurs propres composants
  const [grilleModifiee, setGrilleModifiee] = useState(false)
  const [reglesModifiees, setReglesModifiees] = useState(false)
  const enCours = franchiseModifiee || chargesModifiees || tresoModifiee || alertesModifiees || campagneModifiee || grilleModifiee || reglesModifiees
  const onglets = ONGLETS.filter((o) => o.cle !== 'acces' || directeur)
  const enregistrerBouton = (desactive: boolean, faire: () => Promise<void>) =>
    lecture ? undefined : <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || desactive} onClick={() => void faire()} sx={{ minHeight: 48 }}>Enregistrer</Button>

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography variant="h1">Paramètres réseau</Typography>
          {(lecture || (donnees && !donnees.enregistres)) && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {[lecture ? 'Consultation seule' : '', donnees && !donnees.enregistres ? `${annee} : valeurs par défaut, pas encore enregistrées` : ''].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
        <ToggleButtonGroup exclusive size="small" value={annee} onChange={(_, v: number | null) => v && setAnnee(v)} aria-label="Année des paramètres" disabled={enCours}>
          {annees.map((a) => <ToggleButton key={a} value={a} sx={{ minHeight: 48, minWidth: 72 }}>{a}</ToggleButton>)}
        </ToggleButtonGroup>
        {!lecture && donnees && (
          <Button variant="outlined" startIcon={<ContentCopyOutlined />} disabled={occupe || enCours} onClick={() => setCopie(true)} sx={{ minHeight: 48 }}>
            Copier vers {annee + 1}
          </Button>
        )}
      </Box>
      <Retour message={messageCopie} fermer={() => setMessageCopie(null)} />
      <Tabs value={onglet} onChange={(_, v: Onglet) => setOnglet(v)} variant="scrollable" scrollButtons="auto" aria-label="Rubriques des paramètres"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 48 } }}>
        {onglets.map((o) => <Tab key={o.cle} value={o.cle} label={o.libelle} />)}
      </Tabs>
      {erreur && <Panne quoi="Les paramètres" recharger={recharger} />}
      {chargement && <Skeleton variant="rounded" height={240} />}
      {onglet === 'journal' && <JournalParametres annee={annee} version={donnees} />}
      {onglet === 'acces' && directeur && <AccesParametres />}
      {onglet === 'annees' && <AnneesParametres directeur={directeur} />}
      {p && onglet !== 'journal' && onglet !== 'acces' && onglet !== 'annees' && (
        <Box component="fieldset" disabled={lecture} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Stack spacing={3}>
        {onglet === 'franchise' && franchise && (
          <SectionParametres nom="Franchise et impôts" titre={`Franchise et impôts ${annee}`}
            parDefaut={egal(franchiseDe(p), franchiseDe(parametresParDefaut))} action={enregistrerBouton(!franchiseLue || !franchiseModifiee, enregistrerFranchise)}>
            <Retour message={messageFranchise} fermer={() => setMessageFranchise(null)} />
            {franchise && !franchiseLue && <Box sx={{ px: 2, pb: 1 }}><Alert severity="warning">Redevance et publicité : entre 0 et 10 % du CA. Impôt : entre 0 et 50 %. TVA du panier : entre 0 et 30 %.</Alert></Box>}
            {effet && (
              <Box sx={{ px: 2, pb: 1 }}>
                <Alert severity="info" role="status" aria-label="Effet sur les budgets">
                  {effet.avant.n > 1 ? `EBE des ${effet.avant.n} budgets ${annee} pas encore validés` : `EBE du budget ${annee} pas encore validé`} : {montant(effet.avant.ebe)} → {montant(effet.apres.ebe)} ({ecartMontant(effet.apres.ebe - effet.avant.ebe)}). Les budgets validés ne bougent pas.
                </Alert>
              </Box>
            )}
            <Table aria-label={`Franchise et impôts ${annee}`}>
              <TableBody>
                <Ligne libelle="Redevance franchise, en part du CA HT"><ChampTaux libelle="Redevance franchise" valeur={franchise.tauxRedevance} onChange={(v) => champFranchise('tauxRedevance', v ?? 0)} /></Ligne>
                <Ligne libelle="Publicité franchise, en part du CA HT"><ChampTaux libelle="Publicité franchise" valeur={franchise.tauxPublicite} onChange={(v) => champFranchise('tauxPublicite', v ?? 0)} /></Ligne>
                <Ligne libelle="Impôt sur les sociétés : taux réduit"><ChampTaux libelle="Impôt : taux réduit" valeur={franchise.impot.tauxReduit} onChange={(v) => champFranchise('impot', { ...franchise.impot, tauxReduit: v ?? 0 })} /></Ligne>
                <Ligne libelle="Impôt sur les sociétés : taux réduit jusqu’à ce bénéfice"><ChampNombre libelle="Plafond du taux réduit" valeur={plafond} largeur={160} onChange={setPlafond} /></Ligne>
                <Ligne libelle="Impôt sur les sociétés : taux normal"><ChampTaux libelle="Impôt : taux normal" valeur={franchise.impot.tauxNormal} onChange={(v) => champFranchise('impot', { ...franchise.impot, tauxNormal: v ?? 0 })} /></Ligne>
                <Ligne libelle="TVA moyenne du panier Cave"><ChampTaux libelle="TVA moyenne du panier Cave" valeur={franchise.tvaPanier.cave} onChange={(v) => champFranchise('tvaPanier', { ...franchise.tvaPanier, cave: v ?? 0 })} /></Ligne>
                <Ligne libelle="TVA moyenne du panier Bar"><ChampTaux libelle="TVA moyenne du panier Bar" valeur={franchise.tvaPanier.bar} onChange={(v) => champFranchise('tvaPanier', { ...franchise.tvaPanier, bar: v ?? 0 })} /></Ligne>
              </TableBody>
            </Table>
          </SectionParametres>
        )}

        {onglet === 'equipe' && charges && (
          <SectionParametres nom="Charges sociales" titre={`Charges sociales ${annee}`} parDefaut={egal(p.charges, parametresParDefaut.charges)}
            action={enregistrerBouton(!valides || !chargesModifiees, enregistrer)}>
            <Retour message={message} fermer={() => setMessage(null)} />
            <Table aria-label={`Charges sociales ${annee}`}>
              <TableBody>
                {CATEGORIES.map((c) => (
                  <TableRow key={c}>
                    <TableCell>Charges patronales : {categorieLibelle[c]}</TableCell>
                    <TableCell align="right"><ChampTaux libelle={`Charges patronales : ${categorieLibelle[c]}`} valeur={charges.taux[c]} onChange={(v) => taux_(c, v)} /></TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Réduction générale : SMIC annuel brut (35 heures)</TableCell>
                  <TableCell align="right"><ChampNombre libelle="SMIC annuel brut" valeur={smic} onChange={setSmic} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : taux minimal</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Réduction générale : taux minimal" valeur={charges.reduction.tmin} onChange={(v) => reduction('tmin', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : taux dégressif</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Réduction générale : taux dégressif" valeur={charges.reduction.tdelta} onChange={(v) => reduction('tdelta', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Réduction générale : puissance</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Réduction générale : puissance" valeur={puissance} unite="" largeur={120} onChange={setPuissance} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Part des charges hors réduction (formation, taxe d’apprentissage)</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Part des charges hors réduction" valeur={charges.reduction.horsReduction} onChange={(v) => reduction('horsReduction', v)} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionParametres>
        )}

        {onglet === 'alertes' && (
        <SectionParametres nom="Alertes" titre="Alertes" parDefaut={egal(p.alertes, parametresParDefaut.alertes)}
          action={enregistrerBouton(!alertesLues || !alertesModifiees, enregistrerAlertes)}>
          <Retour message={messageAlertes} fermer={() => setMessageAlertes(null)} />
          <Table aria-label="Seuils des alertes">
            <TableBody>
              <TableRow>
                <TableCell>CA cumulé sous le budget des mêmes mois, de plus de</TableCell>
                <TableCell align="right"><ChampTaux libelle="Écart de CA au budget" valeur={ecartCA} onChange={setEcartCA} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Taux de marge sous celui de l’an dernier, mêmes mois, de plus de</TableCell>
                <TableCell align="right"><ChampNombre libelle="Baisse du taux de marge" valeur={seuils.marge} unite="pt" largeur={120} onChange={(v) => setSeuils((x) => ({ ...x, marge: v }))} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Tickets des {reglesDe(p).moisCommerciaux} derniers mois sous ceux de l’an dernier, Cave ou Bar, de plus de</TableCell>
                <TableCell align="right"><ChampTaux libelle="Baisse des tickets" valeur={baisseTickets} onChange={setBaisseTickets} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Panier moyen TTC des {reglesDe(p).moisCommerciaux} derniers mois sous celui de l’an dernier, Cave ou Bar, de plus de</TableCell>
                <TableCell align="right"><ChampTaux libelle="Baisse du panier moyen" valeur={baissePanier} onChange={setBaissePanier} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Mois terminés absents du réel, à partir de (0 : pas d’alerte)</TableCell>
                <TableCell align="right"><ChampNombre libelle="Mois de réel manquants" valeur={seuils.retard} unite="mois" largeur={120} onChange={(v) => setSeuils((x) => ({ ...x, retard: v }))} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Trésorerie sous ce montant (fin du dernier quadrimestre, point bas du budget)</TableCell>
                <TableCell align="right"><ChampNombre libelle="Seuil de trésorerie" valeur={seuils.tresorerie} largeur={160} onChange={(v) => setSeuils((x) => ({ ...x, tresorerie: v }))} /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </SectionParametres>
        )}

        {onglet === 'grille' && <GrilleFraisParametres annee={annee} parametres={p} lecture={lecture} onEnregistre={recharger} onModifie={setGrilleModifiee} />}
        {onglet === 'regles' && <ReglesCalculParametres annee={annee} parametres={p} lecture={lecture} onEnregistre={recharger} onModifie={setReglesModifiees} />}

        {onglet === 'alertes' && campagne && (
          <SectionParametres nom="Campagne des budgets" titre={`Campagne des budgets ${annee}`} parDefaut={!p.campagne}
            action={enregistrerBouton(!campagneValide || !campagneModifiee, enregistrerCampagne)}>
            <Retour message={messageCampagne} fermer={() => setMessageCampagne(null)} />
            {!campagneValide && <Box sx={{ px: 2 }}><Alert severity="warning">Les trois dates se suivent : proposition, puis retour des franchisés, puis validation.</Alert></Box>}
            <Table aria-label={`Dates de la campagne des budgets ${annee}`}>
              <TableBody>
                {([
                  ['proposition', 'Budgets proposés par le siège avant le'],
                  ['retour', 'Retour des franchisés avant le'],
                  ['validation', 'Budgets validés avant le'],
                ] as const).map(([cle, libelle]) => (
                  <TableRow key={cle}>
                    <TableCell>{libelle}</TableCell>
                    <TableCell align="right">
                      <TextField type="date" size="small" value={campagne[cle]} onChange={(e) => setCampagne((c) => (c ? { ...c, [cle]: e.target.value } : c))}
                        slotProps={{ htmlInput: { 'aria-label': libelle } }} sx={{ width: 190, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionParametres>
        )}

        {onglet === 'tresorerie' && treso && (
          <SectionParametres nom="Trésorerie" titre={`Trésorerie ${annee}`} parDefaut={egal(p.tresorerie, parametresParDefaut.tresorerie)}
            action={enregistrerBouton(!tresoValide || !tresoModifiee, enregistrerTreso)}>
            <Retour message={messageTreso} fermer={() => setMessageTreso(null)} />
            <Table aria-label={`Paramètres de trésorerie ${annee}`}>
              <TableBody>
                <TableRow>
                  <TableCell>Livraison et facturation des marchandises Cave et Bar, en mois avant le mois de la vente</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Avance de livraison des marchandises" valeur={delais.livraison} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, livraison: v }))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Paiement des fournisseurs de marchandises, en mois après la livraison (1 = 30 jours fin de mois)</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Délai de paiement des fournisseurs" valeur={delais.fournisseurs} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, fournisseurs: v }))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Paiement de la redevance et de la publicité, en mois après le CA</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Délai de paiement de la redevance" valeur={delais.redevance} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, redevance: v }))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>TVA moyenne sur les ventes</TableCell>
                  <TableCell align="right"><ChampTaux libelle="TVA moyenne sur les ventes" valeur={treso.tvaVentes} onChange={(v) => tvaTreso('tvaVentes', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>TVA sur les achats de marchandises</TableCell>
                  <TableCell align="right"><ChampTaux libelle="TVA sur les achats de marchandises" valeur={treso.tvaAchats} onChange={(v) => tvaTreso('tvaAchats', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>TVA sur les frais, la redevance et les travaux (hors banque, assurances, impôts et taxes)</TableCell>
                  <TableCell align="right"><ChampTaux libelle="TVA sur les frais" valeur={treso.tvaFrais} onChange={(v) => tvaTreso('tvaFrais', v)} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Déclaration de TVA</TableCell>
                  <TableCell align="right">
                    <ToggleButtonGroup exclusive size="small" value={treso.tvaTrimestrielle ? 'trimestre' : 'mois'} onChange={(_, v: string | null) => v && setTreso((t) => (t ? { ...t, tvaTrimestrielle: v === 'trimestre' } : t))} aria-label="Déclaration de TVA">
                      <ToggleButton value="mois" sx={{ minHeight: 48 }}>Chaque mois</ToggleButton>
                      <ToggleButton value="trimestre" sx={{ minHeight: 48 }}>Chaque trimestre</ToggleButton>
                    </ToggleButtonGroup>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Stock cible de la Cave en fin de mois, en mois d’achats des ventes à venir, au prix d’achat (graphique du stock, fonds de roulement)</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Stock cible de la Cave en mois" valeur={delais.stockCave} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, stockCave: v }))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Stock cible du Bar en fin de mois, en mois d’achats des ventes à venir, au prix d’achat</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Stock cible du Bar en mois" valeur={delais.stockBar} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, stockBar: v }))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Écart toléré autour du stock cible avant de le signaler</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Écart toléré autour du stock cible" valeur={(treso.stock ?? stockParDefaut).tolerance} onChange={(v) => setTreso((t) => (t ? { ...t, stock: { ...(t.stock ?? stockParDefaut), tolerance: v ?? 0 } } : t))} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Part du coût du personnel payée le mois suivant (cotisations salariales et patronales)</TableCell>
                  <TableCell align="right"><ChampTaux libelle="Part du coût du personnel payée le mois suivant" valeur={treso.partCotisations} onChange={(v) => tvaTreso('partCotisations', v)} /></TableCell>
                </TableRow>
                {treso.consignes && (<>
                  {UNIVERS.map((u) => (
                    <TableRow key={u}>
                      <TableCell>Consignes payées aux fournisseurs (fûts, caisses, gaz), en part des achats {DE_L_UNIVERS[u]}</TableCell>
                      <TableCell align="right"><ChampTaux libelle={`Consignes sur les achats : ${universLibelle[u]}`} valeur={treso.consignes!.achats[u]} onChange={(v) => consigne(u, v)} /></TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>Démarque de consignes : part des consignes jamais remboursée (vides perdus ou cassés), en charge du compte de résultat</TableCell>
                    <TableCell align="right"><ChampTaux libelle="Démarque de consignes" valeur={treso.consignes!.demarque ?? 0} onChange={(v) => setTreso((t) => (t?.consignes ? { ...t, consignes: { ...t.consignes, demarque: v ?? 0 } } : t))} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Temps pour écouler un fût et le rendre au fournisseur, en mois</TableCell>
                    <TableCell align="right"><ChampNombre libelle="Temps pour écouler et rendre un fût" valeur={delais.ecoulement} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, ecoulement: v }))} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Remboursement de la consigne après le retour, en mois (1 = 30 jours fin de mois)</TableCell>
                    <TableCell align="right"><ChampNombre libelle="Délai de remboursement des consignes" valeur={delais.remboursement} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, remboursement: v }))} /></TableCell>
                  </TableRow>
                </>)}
                <TableRow>
                  <TableCell>Achats de l’Extérieur (fûts, tireuses) payés avant la vente, en mois</TableCell>
                  <TableCell align="right"><ChampNombre libelle="Avance des achats de l’Extérieur" valeur={delais.exterieur} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, exterieur: v }))} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography variant="h3" sx={{ px: 2, pt: 3, pb: 1 }}>Opérations du réseau</Typography>
            {(treso.operations ?? []).length > 0 && (
              <TableContainer>
                <Table size="small" aria-label="Opérations du réseau" sx={{ '& td, & th': { px: 1, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Opération</TableCell>
                      <TableCell>Mois de vente</TableCell>
                      <TableCell>Achats payés en</TableCell>
                      <TableCell align="right">Part des achats du mois payée à l’avance</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(treso.operations ?? []).map((o, i) => {
                      const nom = o.nom.trim() || `opération ${i + 1}`
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <TextField size="small" value={o.nom} placeholder="Foire aux vins" onChange={(e) => operation(i, { nom: e.target.value })}
                              slotProps={{ htmlInput: { 'aria-label': `Nom de l’opération ${i + 1}`, maxLength: 60 } }} sx={{ width: 200, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
                          </TableCell>
                          <TableCell><ChoixListe libelle={`Mois de vente : ${nom}`} valeur={o.mois} options={MOIS_OPTIONS} largeur={140} onChange={(v) => operation(i, { mois: v })} /></TableCell>
                          <TableCell><ChoixListe libelle={`Achats payés en : ${nom}`} valeur={o.moisPaiement} options={MOIS_OPTIONS} largeur={140} onChange={(v) => operation(i, { moisPaiement: v })} /></TableCell>
                          <TableCell align="right"><ChampTaux libelle={`Part des achats payée à l’avance : ${nom}`} valeur={o.part} onChange={(v) => operation(i, { part: Math.min(1, Math.max(0, v ?? 0)) })} /></TableCell>
                          <TableCell>
                            {!lecture && <IconButton aria-label={`Retirer ${nom}`} onClick={() => operation(i, null)} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {!lecture && <Box sx={{ px: 2, py: 1.5 }}>
              <Button startIcon={<AddOutlined />} sx={{ minHeight: 48 }}
                onClick={() => setTreso((t) => (t ? { ...t, operations: [...(t.operations ?? []), { nom: '', mois: 9, moisPaiement: 8, part: 0.3 }] } : t))}>
                Ajouter une opération
              </Button>
            </Box>}
          </SectionParametres>
        )}
        </Stack>
        </Box>
      )}
      <Dialog open={copie} onClose={() => setCopie(false)} aria-labelledby="titre-copie">
        <DialogTitle id="titre-copie">Copier les paramètres {annee} vers {annee + 1} ?</DialogTitle>
        <DialogContent>
          <Typography>
            {copieCible?.enregistres ? `Les paramètres ${annee + 1} déjà enregistrés seront remplacés.` : `Les paramètres ${annee + 1} partiront de ceux de ${annee}.`} Les dates de la campagne des budgets ne sont pas copiées.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopie(false)} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" disabled={occupe} onClick={() => void copier()} sx={{ minHeight: 48 }}>Copier</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// Années du pilotage (0027, Joseph 03/11/2026) : le Directeur ouvre la campagne, démarre le suivi et clôt l'année
const ETATS_ANNEE: Record<EtatAnnee, string> = { campagne: 'Campagne des budgets', suivi: 'Suivie', close: 'Close' }
function AnneesParametres({ directeur }: { directeur: boolean }) {
  const [lignes, setLignes] = useState<LigneAnnee[]>(lignesAnnees())
  const [message, setMessage] = useState<Message>(null)
  const [occupe, setOccupe] = useState(false)
  const [demande, setDemande] = useState<EtapeAnnee | null>(null)
  const a = anneesPilotage()
  const etapes = etapesAnnees(a)
  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '')
  const textes = (e: EtapeAnnee) => e.quoi === 'ouvrir'
    ? { bouton: `Ouvrir la campagne ${e.annee}`, titre: `Ouvrir la campagne des budgets ${e.annee} ?`,
        detail: `L’onglet Budget ${e.annee} apparaît pour tous les comptes. Les paramètres, les hypothèses du réseau et des groupes ${e.annee - 1} sont repris pour ${e.annee} quand ils n’existent pas encore : revois ensuite les taux de l’année.`,
        fait: `Campagne ${e.annee} ouverte : l’onglet Budget ${e.annee} est visible de tous.` }
    : e.quoi === 'demarrer'
      ? { bouton: `Démarrer le suivi ${e.annee}`, titre: `Démarrer le suivi ${e.annee} ?`,
          detail: `Le Suivi passe à ${e.annee} et compare le réel au budget ${e.annee} de chaque magasin (sa dernière version tant qu’il n’est pas validé). ${e.annee - 1} reste ouvert à la saisie jusqu’à sa clôture. Les frais ${e.annee - 1} des magasins sont gardés en archive.`,
          fait: `Suivi ${e.annee} démarré. ${e.annee - 1} reste à clore une fois décembre et le 3e quadrimestre saisis.` }
      : { bouton: `Clore ${e.annee}`, titre: `Clore ${e.annee} ?`,
          detail: `${e.annee} passe dans les années closes : son suivi reste consultable dans la fiche de chaque magasin, mais ne se propose plus à la saisie.`,
          fait: `${e.annee} est close.` }
  const confirmer = async () => {
    if (!demande) return
    setOccupe(true)
    setMessage(null)
    try {
      await changerAnnee(demande.quoi, demande.annee)
      await chargerAnnees()
      setLignes(lignesAnnees())
      setMessage({ gravite: 'success', texte: textes(demande).fait })
    } catch (e) {
      setMessage({ gravite: 'error', texte: e instanceof RefusAnnee
        ? 'Cette étape n’est pas possible maintenant : recharge la page, l’année a peut-être déjà changé.' : ECHEC })
    } finally {
      setOccupe(false)
      setDemande(null)
    }
  }
  if (!a.pilotees) {
    return <EtatVide titre="Les années suivent encore le calendrier" texte="Elles se piloteront ici dès que la mise à jour 0027 de la base sera passée : ouverture de la campagne, démarrage du suivi, clôture de l’année." />
  }
  return (
    <Stack spacing={3}>
      <Card component="section" aria-label="Années du pilotage">
        <Box sx={{ p: 2.5, pb: 1 }}>
          <Typography variant="h2">Années du pilotage</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Suivi {a.suivi}{a.campagne ? ` · campagne ${a.budget} ouverte` : ''}{a.aClore.length ? ` · ${a.aClore.join(', ')} à clore` : ''}
          </Typography>
        </Box>
        <Retour message={message} fermer={() => setMessage(null)} />
        <TableContainer>
          <Table size="small" aria-label="États des années">
            <TableHead><TableRow><TableCell>Année</TableCell><TableCell>État</TableCell><TableCell>Depuis le</TableCell></TableRow></TableHead>
            <TableBody>
              {[...lignes].sort((x, y) => y.annee - x.annee).map((l) => (
                <TableRow key={l.annee}>
                  <TableCell sx={{ fontWeight: 700 }}>{l.annee}</TableCell>
                  <TableCell>{a.aClore.includes(l.annee) ? 'Suivie, à clore' : ETATS_ANNEE[l.etat]}</TableCell>
                  <TableCell>{date(l.etat === 'campagne' ? l.campagne_le : l.etat === 'suivi' ? l.suivi_le : l.close_le)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {directeur && etapes.length > 0 && (
          <Stack direction="row" useFlexGap spacing={1.5} sx={{ p: 2.5, flexWrap: 'wrap' }} aria-label="Étapes de l’année">
            {etapes.map((e, i) => (
              <Button key={`${e.quoi}-${e.annee}`} variant={i === 0 ? 'contained' : 'outlined'} disabled={occupe} onClick={() => setDemande(e)} sx={{ minHeight: 48 }}>
                {textes(e).bouton}
              </Button>
            ))}
          </Stack>
        )}
      </Card>
      <Dialog open={!!demande} onClose={() => setDemande(null)} aria-labelledby="titre-annee">
        {demande && <>
          <DialogTitle id="titre-annee">{textes(demande).titre}</DialogTitle>
          <DialogContent><Typography>{textes(demande).detail}</Typography></DialogContent>
          <DialogActions>
            <Button onClick={() => setDemande(null)} sx={{ minHeight: 48 }}>Annuler</Button>
            <Button variant="contained" disabled={occupe} onClick={() => void confirmer()} sx={{ minHeight: 48 }}>{textes(demande).bouton}</Button>
          </DialogActions>
        </>}
      </Dialog>
    </Stack>
  )
}

// Journal des changements de l'année : qui, quand, avant → après (lot 39). version : relu après chaque enregistrement.
function JournalParametres({ annee, version }: { annee: number; version: unknown }) {
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerJournal(annee), [annee, version])
  if (erreur) return <Panne quoi="Le journal des paramètres" recharger={recharger} />
  if (chargement && !donnees) return <Skeleton variant="rounded" height={160} />
  if (!donnees?.length) {
    return <Card><EtatVide titre={`Aucun changement en ${annee}`} texte="Chaque paramètre modifié apparaîtra ici, avec la date, la personne et l’ancienne valeur." /></Card>
  }
  return (
    <Card>
      <TableContainer>
        <Table aria-label={`Journal des paramètres ${annee}`} sx={{ '& td': { verticalAlign: 'top' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Rubrique</TableCell>
              <TableCell>Changement</TableCell>
              <TableCell>Par</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {donnees.map((c) => (
              <TableRow key={c.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateHeure(c.le)}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{libelleRubrique(c.rubrique)}</TableCell>
                <TableCell sx={{ minWidth: 220 }}>{decrireChangement(c.rubrique, c.avant, c.apres)}</TableCell>
                <TableCell>{c.par ?? 'Base de données'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

// Accès (Directeur seul) : les comptes du contrôle de gestion, qui modifient les paramètres avec lui
function AccesParametres() {
  const [version, setVersion] = useState(0)
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerControleGestion(), [version])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<Message>(null)
  const [occupe, setOccupe] = useState(false)
  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const ajouter = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      const ok = await ajouterControleGestion(email.trim())
      setMessage(ok
        ? { gravite: 'success', texte: `${email.trim().toLowerCase()} peut maintenant modifier les paramètres réseau.` }
        : { gravite: 'error', texte: 'Aucun compte avec cet email. La personne doit d’abord avoir un compte de connexion, le même que pour l’app réseau.' })
      if (ok) { setEmail(''); setVersion((v) => v + 1) }
    } catch {
      setMessage({ gravite: 'error', texte: ECHEC })
    } finally {
      setOccupe(false)
    }
  }
  const retirer = async (userId: string, adresse: string) => {
    setOccupe(true)
    setMessage(null)
    try {
      await retirerControleGestion(userId)
      setMessage({ gravite: 'success', texte: `${adresse} ne modifie plus les paramètres réseau.` })
      setVersion((v) => v + 1)
    } catch {
      setMessage({ gravite: 'error', texte: ECHEC })
    } finally {
      setOccupe(false)
    }
  }
  return (
    <SectionParametres nom="Contrôle de gestion" titre="Contrôle de gestion" parDefaut={false}>
      <Retour message={message} fermer={() => setMessage(null)} />
      {erreur && <Box sx={{ px: 2 }}><Panne quoi="La liste du contrôle de gestion" recharger={recharger} /></Box>}
      {chargement && !donnees && <Box sx={{ px: 2 }}><Skeleton variant="rounded" height={96} /></Box>}
      {donnees && (donnees.length === 0
        ? <Typography color="text.secondary" sx={{ px: 2, pb: 1 }}>Aucun compte pour l’instant : toi seul modifies les paramètres réseau.</Typography>
        : (
          <Table aria-label="Comptes du contrôle de gestion">
            <TableBody>
              {donnees.map((c) => (
                <TableRow key={c.userId}>
                  <TableCell>{c.email}</TableCell>
                  <TableCell align="right">
                    <Button color="error" startIcon={<DeleteOutlined />} disabled={occupe} onClick={() => void retirer(c.userId, c.email)} sx={{ minHeight: 48 }} aria-label={`Retirer ${c.email}`}>Retirer</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
      <Box component="form" onSubmit={(e) => { e.preventDefault(); if (emailValide) void ajouter() }} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', p: 2 }}>
        <TextField size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@exemple.fr"
          slotProps={{ htmlInput: { 'aria-label': 'Email du compte à ajouter' } }} sx={{ flex: 1, minWidth: 220, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
        <Button type="submit" variant="contained" startIcon={<PersonAddOutlined />} disabled={occupe || !emailValide} sx={{ minHeight: 48 }}>Ajouter</Button>
      </Box>
    </SectionParametres>
  )
}
