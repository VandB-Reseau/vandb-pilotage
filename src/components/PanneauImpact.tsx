import { useEffect, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import ExpandLessOutlined from '@mui/icons-material/ExpandLessOutlined'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import SaveOutlined from '@mui/icons-material/SaveOutlined'
import { ecartMilliers, ecartPts, milliers, MOIS_LONGS, taux } from '../lib/format'
import type { SujetAide } from '../lib/aide'
import type { CleImpact, Indicateur } from '../moteur/impact'
import { Aide } from './Aide'

// Proposition 1 (Joseph, 03/11/2026) : le panneau « Impact » de l'étape Construire. Sur grand écran, collé à droite pendant
// qu'on change les hypothèses ; sinon, barre en bas d'écran repliée sur l'EBE. Il remplace la bande des indicateurs et la
// barre d'enregistrement : on voit l'effet, on annule ou on enregistre au même endroit.
export interface DernierChangement { libelle: string; ca: number; ebe: number }
type Reference = 'enregistre' | 'siege'

const LIBELLES: Record<CleImpact, string> = {
  // Courts pour tenir sur une ligne (Joseph, 03/11/2026) ; le CA est nommé ainsi partout dans l'outil
  ca: 'CA HT', marge: 'Marge', personnel: 'Masse salariale', ebe: 'EBE', resultatNet: 'Résultat net', pointBas: 'Trésorerie, point bas',
}
const COURTS: Record<CleImpact, string> = { ca: 'CA HT', marge: 'Marge', personnel: 'Masse salariale', ebe: 'EBE', resultatNet: 'Résultat net', pointBas: 'Tréso, point bas' }
const AIDES: Partial<Record<CleImpact, SujetAide>> = { personnel: 'pctFP', resultatNet: 'resultatNet' }
const nul = (v: number) => Math.round(v / 100) === 0
const couleur = (i: Indicateur) => (nul(i.ecart) ? 'text.secondary' : (i.ecart > 0) === i.hausseFavorable ? 'success.dark' : 'error.main')
const ecartTexte = (i: Indicateur) => (nul(i.ecart) ? 'inchangé' : ecartMilliers(i.ecart))

function sousTexte(i: Indicateur): string {
  const pts = i.ecartTaux !== undefined && Math.abs(i.ecartTaux) >= 0.0005 ? ` (${ecartPts(i.ecartTaux)})` : ''
  if (i.cle === 'marge') return `${taux(i.taux ?? 0)}${pts}`
  if (i.cle === 'personnel') return `% FP ${taux(i.taux ?? 0)}${pts}`
  if (i.cle === 'ebe') return `${taux(i.taux ?? 0)} du CA`
  if (i.cle === 'pointBas') return `fin ${MOIS_LONGS[i.mois ?? 0]}`
  return ''
}

export function PanneauImpact({
  cote, enregistre, siege, referenceParDefaut, dernier, onAnnulerDernier, changements, onAnnuler, onEnregistrer, occupe, desactive, avertissement, infos = {},
}: {
  cote: boolean                      // grand écran : colonne de droite ; sinon barre en bas d'écran
  enregistre: Indicateur[]           // face à ce qui est enregistré
  siege: Indicateur[] | null         // face à la proposition du siège
  referenceParDefaut: Reference
  dernier: DernierChangement | null
  onAnnulerDernier?: () => void
  changements: number                // changements non enregistrés
  onAnnuler?: () => void             // absents en lecture seule
  onEnregistrer?: () => void
  occupe?: boolean
  desactive?: boolean
  avertissement?: ReactNode
  infos?: Partial<Record<CleImpact, ReactNode>> // calcul détaillé derrière l'icône (i)
}) {
  const [reference, setReference] = useState<Reference>(referenceParDefaut)
  const [deplie, setDeplie] = useState(false)
  const ref = reference === 'siege' && siege ? 'siege' : 'enregistre'
  const lignes = ref === 'siege' ? siege! : enregistre
  const ebe = lignes.find((i) => i.cle === 'ebe')!

  // Barre basse : ce qu'on fait défiler jusqu'à l'écran ne se cache pas dessous (comme la barre d'enregistrement)
  const boite = useRef<HTMLElement>(null)
  useEffect(() => {
    const html = document.documentElement
    const el = boite.current
    if (cote || !el || typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver(() => { html.style.scrollPaddingBottom = `calc(var(--barre-basse, 0px) + ${el.offsetHeight + 24}px)` })
    observateur.observe(el)
    return () => { observateur.disconnect(); html.style.scrollPaddingBottom = '' }
  }, [cote])

  const bascule = { minHeight: { xs: 48, lg: 32 }, py: { lg: 0.25 }, px: 0.75, lineHeight: 1.15, textTransform: 'none', fontWeight: 700, fontSize: '0.8125rem' } as const
  const choix = siege ? (
    <ToggleButtonGroup exclusive fullWidth size="small" value={ref} onChange={(_, v: Reference | null) => v && setReference(v)} aria-label="Comparer à">
      <ToggleButton value="enregistre" sx={bascule}>Ce qui est enregistré</ToggleButton>
      <ToggleButton value="siege" sx={bascule}>Proposition du siège</ToggleButton>
    </ToggleButtonGroup>
  ) : <Typography variant="body2" color="text.secondary">Face à ce qui est enregistré</Typography>

  const blocDernier = dernier && (
    // Raccourci (Joseph, 03/11/2026) : le dernier changement tient en une ou deux lignes, « Annuler » à droite
    <Box aria-label="Dernier changement" role="group" sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.16), borderRadius: 2, pl: 1.25, pr: 0.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}>
        <Box component="span" sx={{ fontWeight: 700 }}>{dernier.libelle}</Box>{' : '}
        <Box component="span" sx={{ color: nul(dernier.ca) ? 'text.secondary' : dernier.ca > 0 ? 'success.dark' : 'error.main' }}>{nul(dernier.ca) ? 'CA inchangé' : `${ecartMilliers(dernier.ca)} de CA`}</Box>
        {' · '}
        <Box component="span" sx={{ fontWeight: 700, color: nul(dernier.ebe) ? 'text.secondary' : dernier.ebe > 0 ? 'success.dark' : 'error.main' }}>{nul(dernier.ebe) ? 'EBE inchangé' : `${ecartMilliers(dernier.ebe)} d’EBE`}</Box>
      </Typography>
      {onAnnulerDernier && (
        <Button size="small" onClick={onAnnulerDernier} aria-label={`Annuler le dernier changement : ${dernier.libelle}`}
          sx={{ flex: 'none', minWidth: 0, minHeight: { xs: 48, lg: 32 }, px: 1, py: 0, textDecoration: 'underline', fontWeight: 700 }}>Annuler</Button>
      )}
    </Box>
  )

  const boutons = onEnregistrer && changements > 0 && (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {cote ? (
        // Grand écran : « Tout annuler » discret à côté du compte, « Enregistrer » sur toute la largeur
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{changements <= 1 ? '1 changement non enregistré' : `${changements} changements non enregistrés`}</Typography>
            {onAnnuler && <Button size="small" onClick={onAnnuler} disabled={occupe} aria-label="Annuler les changements" sx={{ flex: 'none', minWidth: 0, minHeight: 32, px: 1, py: 0, textDecoration: 'underline', fontWeight: 700 }}>Tout annuler</Button>}
          </Box>
          {avertissement && <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 700 }}>{avertissement}</Typography>}
          <Button variant="contained" startIcon={<SaveOutlined />} onClick={onEnregistrer} disabled={occupe || desactive} sx={{ minHeight: 44, whiteSpace: 'nowrap' }}>Enregistrer les ajustements</Button>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">{changements <= 1 ? '1 changement non enregistré' : `${changements} changements non enregistrés`}</Typography>
          {avertissement && <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 700 }}>{avertissement}</Typography>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {onAnnuler && <Button variant="outlined" onClick={onAnnuler} disabled={occupe} aria-label="Annuler les changements" sx={{ minHeight: 48 }}>Tout annuler</Button>}
            <Button variant="contained" startIcon={<SaveOutlined />} onClick={onEnregistrer} disabled={occupe || desactive} sx={{ minHeight: 48, flex: 1, whiteSpace: 'nowrap' }}>Enregistrer les ajustements</Button>
          </Box>
        </>
      )}
    </Box>
  )

  const ligne = (i: Indicateur) => (
    <Box key={i.cle} data-impact={i.cle} sx={{
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto 4.25rem', columnGap: 1, alignItems: 'baseline', py: 0.5, borderTop: 1, borderColor: 'divider',
      '&:first-of-type': { borderTop: 0 },
      ...(i.cle === 'ebe' ? { bgcolor: 'action.hover', mx: -2, px: 2, borderTop: 0 } : {}),
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0, minHeight: 28 }}>
          <Typography component="span" sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.2 }}>{LIBELLES[i.cle]}</Typography>
          {AIDES[i.cle] && <Aide sujet={AIDES[i.cle]!} compact />}
          {infos[i.cle]}
        </Box>
        {sousTexte(i) && <Typography component="span" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.2 }}>{sousTexte(i)}</Typography>}
      </Box>
      <Typography component="span" sx={{ textAlign: 'right', fontWeight: 900, fontSize: i.cle === 'ebe' ? '1.1875rem' : '1rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: i.cle === 'pointBas' && i.valeur < 0 ? 'error.main' : 'text.primary' }}>
        {milliers(i.valeur)}
      </Typography>
      <Typography component="span" sx={{ textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: couleur(i), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{ecartTexte(i)}</Typography>
    </Box>
  )

  if (cote) {
    return (
      // Raccourci (Joseph, 03/11/2026) : « Enregistrer les ajustements » juste sous le titre, visible dès que le panneau
      // l'est ; une ligne par indicateur ; si l'écran est trop bas, seule la liste des indicateurs défile
      <Card component="aside" aria-label="Impact des changements" className="pas-a-l-impression"
        sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1, boxShadow: 3, maxHeight: '100%', minHeight: 0, flexShrink: 0 }}>
        <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>Impact</Typography>
        {boutons}
        {choix}
        {blocDernier}
        <Box data-liste-impact sx={{ minHeight: 0, overflowY: 'auto', mx: -2, px: 2 }}>{lignes.map(ligne)}</Box>
      </Card>
    )
  }

  // Barre basse (téléphone et écrans étroits) : l'EBE et son écart ; un appui déplie le reste
  return (
    <Box ref={boite} component="aside" aria-label="Impact des changements" className="pas-a-l-impression" sx={{
      position: 'sticky', bottom: { xs: 'calc(var(--barre-basse, 0px) + 8px)', md: 16 }, zIndex: 6, mt: 3,
      bgcolor: 'background.paper', borderRadius: 3, px: 2, py: 1, boxShadow: '0 -4px 18px rgba(0, 0, 0, 0.18)', display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" sx={{ fontSize: '0.8125rem', color: 'text.secondary', display: 'block' }}>EBE</Typography>
          <Typography component="span" sx={{ fontWeight: 900, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>{milliers(ebe.valeur)}</Typography>{' '}
          <Typography component="span" sx={{ fontWeight: 700, fontSize: '0.875rem', color: couleur(ebe), fontVariantNumeric: 'tabular-nums' }}>{ecartTexte(ebe)}</Typography>
        </Box>
        <Button onClick={() => setDeplie(!deplie)} aria-expanded={deplie} endIcon={deplie ? <ExpandMoreOutlined /> : <ExpandLessOutlined />} sx={{ minHeight: 48 }}>
          {deplie ? 'Replier' : 'Voir l’impact'}
        </Button>
      </Box>
      {deplie && (
        <>
          {choix}
          {blocDernier}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 2, rowGap: 1 }}>
            {lignes.map((i) => (
              <Box key={i.cle} data-impact={i.cle} sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                  <Typography component="span" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>{COURTS[i.cle]}</Typography>
                  {AIDES[i.cle] && <Aide sujet={AIDES[i.cle]!} compact />}
                  {infos[i.cle]}
                </Box>
                <Typography component="span" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: i.cle === 'pointBas' && i.valeur < 0 ? 'error.main' : 'text.primary' }}>{milliers(i.valeur)}</Typography>{' '}
                <Typography component="span" sx={{ fontSize: '0.8125rem', fontWeight: 700, color: couleur(i), fontVariantNumeric: 'tabular-nums' }}>{ecartTexte(i)}</Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
      {boutons}
    </Box>
  )
}
