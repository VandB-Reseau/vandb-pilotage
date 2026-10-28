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
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ChampNombre } from '../components/ChampNombre'
import { ChampTaux } from '../components/ChampTaux'
import { Panne } from '../components/Panne'
import { anneeBudget, chargerParametres, enregistrerParametres, type ParametresCharges } from '../data/pilotage'
import { nombre } from '../import/caisse'
import { CATEGORIES, categorieLibelle } from '../moteur/equipe'
import { useChargement } from '../data/useChargement'
import type { ParametresTresorerie } from '../moteur/tresorerie'
import { UNIVERS, universLibelle, type Univers } from '../moteur/types'
import { montant, taux } from '../lib/format'

const DE_L_UNIVERS: Record<Univers, string> = { cave: 'de la Cave', bar: 'du Bar', exterieur: 'de l’Extérieur' }

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
  const [delais, setDelais] = useState({ fournisseurs: '', redevance: '', ecoulement: '', remboursement: '' })
  const [messageTreso, setMessageTreso] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  useEffect(() => {
    if (!p) return
    setTreso(p.tresorerie)
    setDelais({
      fournisseurs: String(p.tresorerie.delaiFournisseurs), redevance: String(p.tresorerie.delaiRedevance),
      ecoulement: String(p.tresorerie.consignes?.ecoulement ?? 0), remboursement: String(p.tresorerie.consignes?.remboursement ?? 0),
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
  const delaisLus = { delaiFournisseurs: delai(delais.fournisseurs), delaiRedevance: delai(delais.redevance) }
  const delaisConsignes = { ecoulement: delai(delais.ecoulement, 6), remboursement: delai(delais.remboursement, 6) }
  const tresoValide = Object.values({ ...delaisLus, ...delaisConsignes }).every((v) => v !== null)
  const tresoLue = (t: ParametresTresorerie): ParametresTresorerie => ({
    ...t, delaiFournisseurs: delaisLus.delaiFournisseurs ?? 0, delaiRedevance: delaisLus.delaiRedevance ?? 0,
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
  const consigne = (u: Univers, v: number | undefined) =>
    setTreso((t) => (t?.consignes ? { ...t, consignes: { ...t.consignes, achats: { ...t.consignes.achats, [u]: v ?? 0 } } } : t))
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
          <Card component="section" aria-label="Charges sociales">
            <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h2">Charges sociales {annee}</Typography>
              <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !valides} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
            </Box>
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
          </Card>
        )}

        {treso && (
          <Card component="section" aria-label="Trésorerie">
            <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="h2">Trésorerie {annee}</Typography>
              <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !tresoValide || !tresoModifiee} onClick={() => void enregistrerTreso()} sx={{ minHeight: 48 }}>Enregistrer</Button>
            </Box>
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
                    <TableCell>Temps pour écouler un fût et le rendre au fournisseur, en mois</TableCell>
                    <TableCell align="right"><ChampNombre libelle="Temps pour écouler et rendre un fût" valeur={delais.ecoulement} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, ecoulement: v }))} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Remboursement de la consigne après le retour, en mois (1 = 30 jours fin de mois)</TableCell>
                    <TableCell align="right"><ChampNombre libelle="Délai de remboursement des consignes" valeur={delais.remboursement} unite="mois" largeur={120} onChange={(v) => setDelais((d) => ({ ...d, remboursement: v }))} /></TableCell>
                  </TableRow>
                </>)}
              </TableBody>
            </Table>
          </Card>
        )}
        </Stack>
      )}
    </Box>
  )
}
