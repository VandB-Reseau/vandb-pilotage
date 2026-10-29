import { useEffect, useState } from 'react'
import { useSaisieEnCours } from '../components/GardeSaisie'
import Alert from '@mui/material/Alert'
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
import { Panne } from '../components/Panne'
import { SectionParametres } from '../components/SectionParametres'
import { anneeBudget, chargerParametres, enregistrerParametres, type ParametresCharges } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { CATEGORIES, categorieLibelle } from '../moteur/equipe'
import { useChargement } from '../data/useChargement'
import type { ParametresAlertes } from '../moteur/alertes'
import { campagneDe, type Campagne } from '../moteur/campagne'
import { parametresParDefaut } from '../moteur/parametres'
import type { ParametresReseau } from '../moteur/types'
import type { OperationReseau, ParametresTresorerie } from '../moteur/tresorerie'
import { UNIVERS, universLibelle, type Univers } from '../moteur/types'
import { enChiffres, montant, MOIS_LONGS, taux } from '../lib/format'

const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
const DE_L_UNIVERS: Record<Univers, string> = { cave: 'de la Cave', bar: 'du Bar', exterieur: 'de l’Extérieur' }

// Résumés des sections repliées (lot 30, E4)
const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const pct = (v: number) => taux(v).replace(',0 %', ' %')
const jourMois = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const resumeCharges = (p: ParametresReseau) =>
  `Employé ${pct(p.charges.taux.employe)}, cadre ${pct(p.charges.taux.cadre)}, gérant TNS ${pct(p.charges.taux.gerant_tns)} ; SMIC annuel ${montant(p.charges.reduction.smicAnnuel)}`
const resumeAlertes = (p: ParametresReseau) => [
  `CA ${pct(p.alertes.ecartCA)} sous le budget`, `marge −${String(Math.round(p.alertes.baisseMarge * 1000) / 10).replace('.', ',')} pt`,
  p.alertes.baisseTickets !== undefined ? `tickets −${pct(p.alertes.baisseTickets)}` : '', p.alertes.baissePanier !== undefined ? `panier −${pct(p.alertes.baissePanier)}` : '',
  p.alertes.moisRetard ? `réel en retard de ${p.alertes.moisRetard} mois` : '', `trésorerie sous ${montant(p.alertes.tresorerie)}`,
].filter(Boolean).join(', ')
const resumeCampagne = (c: Campagne) => `Proposition avant le ${jourMois(c.proposition)}, retour avant le ${jourMois(c.retour)}, validation avant le ${jourMois(c.validation)}`
const resumeTreso = (p: ParametresReseau) => {
  const t = p.tresorerie, c = t.consignes
  return [`Fournisseurs à ${t.delaiFournisseurs} mois`, `TVA ${t.tvaTrimestrielle ? 'trimestrielle' : 'mensuelle'}`,
    c ? `consignes Cave ${pct(c.achats.cave)}, Bar ${pct(c.achats.bar)}, démarque ${pct(c.demarque ?? 0)}` : ''].filter(Boolean).join(', ')
}

export function Parametres() {
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerParametres(annee), [annee])
  const p = donnees?.parametres
  const [charges, setCharges] = useState<ParametresCharges | null>(null)
  const [smic, setSmic] = useState('')
  const [puissance, setPuissance] = useState('')
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // Trésorerie : délais en mois gardés en texte pendant la frappe
  const [treso, setTreso] = useState<ParametresTresorerie | null>(null)
  const [delais, setDelais] = useState({ fournisseurs: '', redevance: '', ecoulement: '', remboursement: '', exterieur: '' })
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
    setEcartCA(p.alertes.ecartCA)
    setCampagne(campagneDe(p, annee))
    setBaisseTickets(p.alertes.baisseTickets)
    setBaissePanier(p.alertes.baissePanier)
    setSeuils({ marge: String(Math.round(p.alertes.baisseMarge * 1000) / 10).replace('.', ','), retard: String(p.alertes.moisRetard), tresorerie: enChiffres(p.alertes.tresorerie) })
    setTreso(p.tresorerie)
    setDelais({
      fournisseurs: String(p.tresorerie.delaiFournisseurs), redevance: String(p.tresorerie.delaiRedevance),
      ecoulement: String(p.tresorerie.consignes?.ecoulement ?? 0), remboursement: String(p.tresorerie.consignes?.remboursement ?? 0),
      exterieur: String(p.tresorerie.avanceExterieur ?? 0),
    })
    setCharges(p.charges)
    setSmic(String(p.charges.reduction.smicAnnuel).replace('.', ','))
    setPuissance(String(p.charges.reduction.puissance).replace('.', ','))
  }, [p])
  const taux_ = (k: keyof ParametresCharges['taux'], v: number | undefined) => setCharges((c) => (c ? { ...c, taux: { ...c.taux, [k]: v ?? 0 } } : c))
  const reduction = (k: keyof ParametresCharges['reduction'], v: number | undefined) => setCharges((c) => (c ? { ...c, reduction: { ...c.reduction, [k]: v ?? 0 } } : c))
  const smicLu = nombre(smic), puissanceLue = nombre(puissance)
  useSaisieEnCours(!!p && !!charges && (JSON.stringify(charges) !== JSON.stringify(p.charges) || smicLu !== p.charges.reduction.smicAnnuel || puissanceLue !== p.charges.reduction.puissance))
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
  const delaisLus = { delaiFournisseurs: delai(delais.fournisseurs), delaiRedevance: delai(delais.redevance), avanceExterieur: delai(delais.exterieur) }
  const delaisConsignes = { ecoulement: delai(delais.ecoulement, 6), remboursement: delai(delais.remboursement, 6) }
  const tresoValide = Object.values({ ...delaisLus, ...delaisConsignes }).every((v) => v !== null)
  const tresoLue = (t: ParametresTresorerie): ParametresTresorerie => ({
    ...t, delaiFournisseurs: delaisLus.delaiFournisseurs ?? 0, delaiRedevance: delaisLus.delaiRedevance ?? 0, avanceExterieur: delaisLus.avanceExterieur ?? 0,
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
        <Stack spacing={3}>
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

        {charges && (
          <SectionParametres nom="Charges sociales" titre={`Charges sociales ${annee}`} resume={resumeCharges(p)} parDefaut={egal(p.charges, parametresParDefaut.charges)}
            action={<Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !valides} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>}>
            {message && <Box sx={{ px: 2 }}><Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>}
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

        <SectionParametres nom="Alertes" titre={'Alertes'} resume={resumeAlertes(p)} parDefaut={egal(p.alertes, parametresParDefaut.alertes)}
          action={<Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !alertesLues || !alertesModifiees} onClick={() => void enregistrerAlertes()} sx={{ minHeight: 48 }}>Enregistrer</Button>}>
          {messageAlertes && <Box sx={{ px: 2 }}><Alert severity={messageAlertes.gravite} onClose={() => setMessageAlertes(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{messageAlertes.texte}</Alert></Box>}
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
                <TableCell>Tickets des 3 derniers mois sous ceux de l’an dernier, Cave ou Bar, de plus de</TableCell>
                <TableCell align="right"><ChampTaux libelle="Baisse des tickets" valeur={baisseTickets} onChange={setBaisseTickets} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Panier moyen TTC des 3 derniers mois sous celui de l’an dernier, Cave ou Bar, de plus de</TableCell>
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

        {campagne && (
          <SectionParametres nom="Campagne des budgets" titre={`Campagne des budgets ${annee}`} resume={resumeCampagne(campagneDe(p, annee))} parDefaut={!p.campagne}
            action={<Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !campagneValide || !campagneModifiee} onClick={() => void enregistrerCampagne()} sx={{ minHeight: 48 }}>Enregistrer</Button>}>
            {messageCampagne && <Box sx={{ px: 2 }}><Alert severity={messageCampagne.gravite} onClose={() => setMessageCampagne(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{messageCampagne.texte}</Alert></Box>}
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

        {treso && (
          <SectionParametres nom="Trésorerie" titre={`Trésorerie ${annee}`} resume={resumeTreso(p)} parDefaut={egal(p.tresorerie, parametresParDefaut.tresorerie)}
            action={<Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !tresoValide || !tresoModifiee} onClick={() => void enregistrerTreso()} sx={{ minHeight: 48 }}>Enregistrer</Button>}>
            {messageTreso && <Box sx={{ px: 2 }}><Alert severity={messageTreso.gravite} onClose={() => setMessageTreso(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{messageTreso.texte}</Alert></Box>}
            <Table aria-label={`Paramètres de trésorerie ${annee}`}>
              <TableBody>
                <TableRow>
                  <TableCell>Paiement des fournisseurs de marchandises, en mois après l’achat (1 = 30 jours fin de mois)</TableCell>
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
                            <IconButton aria-label={`Retirer ${nom}`} onClick={() => operation(i, null)} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Button startIcon={<AddOutlined />} sx={{ minHeight: 48 }}
                onClick={() => setTreso((t) => (t ? { ...t, operations: [...(t.operations ?? []), { nom: '', mois: 9, moisPaiement: 8, part: 0.3 }] } : t))}>
                Ajouter une opération
              </Button>
            </Box>
          </SectionParametres>
        )}
        </Stack>
      )}
    </Box>
  )
}
