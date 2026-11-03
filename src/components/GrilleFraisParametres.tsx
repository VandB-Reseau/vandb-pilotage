import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import { ChoixListe } from './ChoixListe'
import { useSaisieEnCours } from './GardeSaisie'
import { SectionParametres } from './SectionParametres'
import { enregistrerParametres } from '../data/pilotage'
import {
  BLOCS_FRAIS, controlerGrille, grilleDe, lignesFrais, lireComptes, nouvelleLigneGrille, rubriqueLibelle, THEMES_FRAIS,
} from '../moteur/parametres'
import type { LigneGrille, ParametresReseau, Rubrique } from '../moteur/types'

// Lot 40 : grille des frais du réseau (lignes de l'onglet FFBUD) modifiable depuis Paramètres réseau : renommer une
// ligne, changer son thème, ses comptes du plan comptable (import FEC), la cocher « courante », la masquer, en ajouter.
// Une ligne ne se supprime pas (des magasins l'ont peut-être) : masquée, elle n'est plus proposée.
const THEMES_EXTERNES = THEMES_FRAIS.filter((r) => r !== 'impots_taxes')
const comptesEnTexte = (g: LigneGrille[]) => Object.fromEntries(g.map((l) => [l.code, l.racines.join(', ')]))

export function GrilleFraisParametres({ annee, parametres, lecture, onEnregistre, onModifie }: {
  annee: number
  parametres: ParametresReseau
  lecture: boolean
  onEnregistre: () => void
  onModifie: (m: boolean) => void
}) {
  const enregistree = grilleDe(parametres)
  const empreinte = JSON.stringify(enregistree)
  const [lignes, setLignes] = useState<LigneGrille[]>(enregistree)
  const [comptes, setComptes] = useState<Record<string, string>>(() => comptesEnTexte(enregistree))
  const [nouvelle, setNouvelle] = useState<{ libelle: string; rubrique: Rubrique }>({ libelle: '', rubrique: 'autres' })
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLignes(enregistree); setComptes(comptesEnTexte(enregistree)) }, [empreinte])

  const lue = lignes.map((l) => ({ ...l, racines: lireComptes(comptes[l.code] ?? '') }))
  const modifiee = JSON.stringify(lue) !== empreinte
  const erreurs = controlerGrille(lue)
  useSaisieEnCours(!lecture && modifiee)
  useEffect(() => { onModifie(!lecture && modifiee) }, [lecture, modifiee, onModifie])

  const changer = (code: string, l: Partial<LigneGrille>) => setLignes((g) => g.map((x) => (x.code === code ? { ...x, ...l } : x)))
  const ajouter = () => {
    if (!nouvelle.libelle.trim()) return
    const l = nouvelleLigneGrille(lignes, nouvelle.libelle, nouvelle.rubrique)
    // Rangée après la dernière ligne de son thème (dans son bloc), sinon en fin de grille
    const i = lignes.map((x) => x.rubrique === l.rubrique && x.bloc === l.bloc).lastIndexOf(true)
    setLignes((g) => (i < 0 ? [...g, l] : [...g.slice(0, i + 1), l, ...g.slice(i + 1)]))
    setComptes((c) => ({ ...c, [l.code]: '' }))
    setNouvelle((n) => ({ ...n, libelle: '' }))
  }
  const enregistrer = async () => {
    if (erreurs.length) return
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerParametres(annee, { ...parametres, grilleFrais: lue })
      setMessage({ gravite: 'success', texte: `Grille des frais ${annee} enregistrée.` })
      onEnregistre()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  // Groupes : un par thème des charges externes, puis impôts et taxes, puis autres charges (blocs de l'onglet FFBUD)
  const groupes = [
    ...THEMES_EXTERNES.map((r) => ({ cle: r as string, titre: rubriqueLibelle[r], dans: lue.filter((l) => l.bloc === 'charges_externes' && l.rubrique === r) })),
    ...BLOCS_FRAIS.filter((b) => b.cle !== 'charges_externes').map((b) => ({ cle: b.cle as string, titre: b.libelle, dans: lue.filter((l) => l.bloc === b.cle) })),
  ].filter((g) => g.dans.length)
  const masquees = lue.filter((l) => l.masquee).length

  // Libellé enregistré : nom stable des champs pendant la frappe (la ligne ajoutée prend le sien)
  const nomDe = (l: LigneGrille) => enregistree.find((x) => x.code === l.code)?.libelle ?? l.libelle
  const ligne = (l: LigneGrille) => { const nom = nomDe(l); return (
    <Box key={l.code} role="group" aria-label={`Ligne de frais : ${nom}`}
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: 1, borderTop: 1, borderColor: 'divider', opacity: l.masquee ? 0.6 : 1 }}>
      <TextField size="small" value={l.libelle} onChange={(e) => changer(l.code, { libelle: e.target.value })} error={!l.libelle.trim()}
        slotProps={{ htmlInput: { 'aria-label': `Libellé : ${nom}` } }}
        sx={{ flex: '1 1 240px', minWidth: 0, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
      <ChoixListe libelle={`Thème : ${nom}`} valeur={l.rubrique} largeur={220} desactive={l.bloc !== 'charges_externes'}
        options={(l.bloc === 'charges_externes' ? THEMES_EXTERNES : [l.rubrique]).map((r) => ({ valeur: r, libelle: rubriqueLibelle[r] }))}
        onChange={(r) => changer(l.code, { rubrique: r })} />
      <TextField size="small" value={comptes[l.code] ?? ''} placeholder="Comptes"
        onChange={(e) => setComptes((c) => ({ ...c, [l.code]: e.target.value }))}
        slotProps={{ htmlInput: { 'aria-label': `Comptes du plan comptable : ${nom}`, inputMode: 'numeric' } }}
        sx={{ width: 170, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
      <FormControlLabel label="Courante" sx={{ mr: 0, minHeight: 48 }}
        control={<Checkbox checked={!!l.courante} onChange={(e) => changer(l.code, { courante: e.target.checked || undefined })} slotProps={{ input: { 'aria-label': `Ligne courante : ${nom}` } }} sx={{ width: 48, height: 48 }} />} />
      <Tooltip title={l.masquee ? 'Réafficher' : 'Masquer'}>
        <IconButton aria-label={`${l.masquee ? 'Réafficher' : 'Masquer'} la ligne : ${nom}`} onClick={() => changer(l.code, { masquee: l.masquee ? undefined : true })} sx={{ width: 48, height: 48 }}>
          {l.masquee ? <VisibilityOutlined /> : <VisibilityOffOutlined />}
        </IconButton>
      </Tooltip>
    </Box>
  ) }

  return (
    <SectionParametres nom="Grille des frais" titre={`Grille des frais ${annee}`} parDefaut={empreinte === JSON.stringify(lignesFrais)}
      action={lecture ? undefined : (
        <Button variant="contained" startIcon={<SaveOutlined />} disabled={occupe || !modifiee || erreurs.length > 0} onClick={() => void enregistrer()} sx={{ minHeight: 48 }}>Enregistrer</Button>
      )}>
      {message && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>
        </Box>
      )}
      {erreurs.length > 0 && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="warning">{erreurs.length === 1 ? erreurs[0] : <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{erreurs.map((e) => <li key={e}>{e}</li>)}</Box>}</Alert>
        </Box>
      )}
      <Typography color="text.secondary" sx={{ px: 2, pb: 1 }}>
        {lue.length} lignes{masquees ? `, dont ${masquees} masquée${masquees > 1 ? 's' : ''}` : ''}
      </Typography>
      {/* En-tête des colonnes, sur PC seulement (sur téléphone, chaque champ dit ce qu'il est) */}
      <Box aria-hidden sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, px: 2, pb: 0.5, color: 'text.secondary', fontSize: '0.8125rem', fontWeight: 700 }}>
        <Box sx={{ flex: '1 1 240px' }}>Libellé</Box><Box sx={{ width: 220 }}>Thème</Box><Box sx={{ width: 170 }}>Comptes du plan comptable</Box><Box sx={{ width: 168 }} />
      </Box>
      {groupes.map((g) => (
        <Box key={g.cle} component="section" aria-label={`Thème : ${g.titre}`}>
          <Typography component="h3" sx={{ fontWeight: 700, px: 2, py: 1, bgcolor: 'action.hover' }}>{g.titre}</Typography>
          {g.dans.map(ligne)}
        </Box>
      ))}
      {!lecture && (
        <Box component="section" aria-label="Ajouter une ligne de frais" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <TextField size="small" value={nouvelle.libelle} placeholder="Nouvelle ligne" onChange={(e) => setNouvelle((n) => ({ ...n, libelle: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') ajouter() }}
            slotProps={{ htmlInput: { 'aria-label': 'Libellé de la nouvelle ligne' } }}
            sx={{ flex: '1 1 240px', minWidth: 0, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }} />
          <ChoixListe libelle="Thème de la nouvelle ligne" valeur={nouvelle.rubrique} largeur={220}
            options={THEMES_FRAIS.map((r) => ({ valeur: r, libelle: rubriqueLibelle[r] }))} onChange={(r) => setNouvelle((n) => ({ ...n, rubrique: r }))} />
          <Button variant="outlined" startIcon={<AddOutlined />} disabled={!nouvelle.libelle.trim()} onClick={ajouter} sx={{ minHeight: 48 }}>
            Ajouter
          </Button>
        </Box>
      )}
    </SectionParametres>
  )
}
