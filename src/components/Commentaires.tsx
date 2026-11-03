import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddCommentOutlined from '@mui/icons-material/AddCommentOutlined'
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { roleLibelle, type Profil, type Role } from '../auth/roles'
import { chargerCommentaires, envoyerCommentaire, resoudreCommentaire, retirerMessage, type Commentaire } from '../data/pilotage'
import { useChargement } from '../data/useChargement'

// Joseph (03/11/2026) : les échanges deviennent des commentaires comme dans un document partagé. On commente un point
// précis (une carte, une ligne d'hypothèse, un investissement…), on répond dessous, on marque « Résolu ». La liste suit le
// budget sur ses trois étapes, sous le panneau Impact. Ce n'est pas une messagerie : pas de fil général, pas de sujet.

export const ANCRE_BUDGET = { ancre: 'budget', libelle: 'Le budget en général' }
const MAX_TEXTE = 2000
const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const qui = (role: Role | null, nom: string | null) => [nom, role ? roleLibelle[role] : null].filter(Boolean).join(', ') || 'Compte retiré'

interface Contexte { ouverts: (ancre: string) => number; ouvrir: (ancre: string, libelle: string) => void }
const Ctx = createContext<Contexte | null>(null)

// Bouton « Commenter » d'un point : la bulle porte le nombre de commentaires ouverts sur ce point
// Sur une ligne de tableau (« ligne »), le bouton se nomme « cette ligne » : le nom de la ligne est déjà lu avec elle, et
// le champ de saisie garde seul son nom
export function BoutonCommenter({ ancre, libelle, compact, ligne }: { ancre: string; libelle: string; compact?: boolean; ligne?: boolean }) {
  const c = useContext(Ctx)
  if (!c) return null
  const n = c.ouverts(ancre)
  const quoi = ligne ? 'cette ligne' : libelle
  return (
    <Tooltip title={n ? `${n} commentaire${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}` : 'Commenter'}>
      <IconButton className="pas-a-l-impression" aria-label={n ? `Commentaires sur ${quoi} (${n} ouvert${n > 1 ? 's' : ''})` : `Commenter ${ligne ? quoi : `: ${quoi}`}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); c.ouvrir(ancre, libelle) }}
        sx={{ width: { xs: 48, lg: compact ? 28 : 36 }, height: { xs: 48, lg: compact ? 28 : 36 }, flexShrink: 0, color: n ? 'warning.dark' : 'text.secondary', opacity: n ? 1 : 0.6, '&:hover, &:focus-visible': { opacity: 1 } }}>
        <Badge badgeContent={n} color="warning" invisible={!n}><ChatBubbleOutlineOutlined fontSize="small" /></Badge>
      </IconButton>
    </Tooltip>
  )
}

type Fil = Commentaire & { reponses: Commentaire[] }
export function filsDe(l: Commentaire[]): Fil[] {
  const racines = l.filter((c) => c.parent === null)
  return racines.map((r) => ({ ...r, reponses: l.filter((c) => c.parent === r.id) }))
    // Ouverts d'abord, du plus récent échange au plus ancien
    .sort((a, b) => Number(!!a.resoluLe) - Number(!!b.resoluLe) || (dernier(b) > dernier(a) ? 1 : -1))
}
const dernier = (f: Fil) => f.reponses.at(-1)?.creeLe ?? f.creeLe

// Fournit les bulles aux points du budget et affiche le panneau ; « panneau » reçoit le panneau à placer
export function CommentairesBudget({ magasin, annee, moi, children }: {
  magasin: string; annee: number; moi: Profil | null
  children: (panneau: ReactNode, ouverts: number) => ReactNode
}) {
  const { donnees, erreur, recharger } = useChargement(() => chargerCommentaires(magasin, annee), [magasin, annee])
  const [point, setPoint] = useState<{ ancre: string; libelle: string } | null>(null)
  const [demande, setDemande] = useState(0)
  const fils = filsDe(donnees ?? [])
  const ouverts = fils.filter((f) => !f.resoluLe)
  const ctx: Contexte = {
    ouverts: (ancre) => ouverts.filter((f) => f.ancre === ancre).length,
    ouvrir: (ancre, libelle) => { setPoint({ ancre, libelle }); setDemande((n) => n + 1) },
  }
  const panneau = (
    <PanneauCommentaires key={`commentaires-${magasin}`} magasin={magasin} annee={annee} moi={moi} fils={fils} panne={!!erreur && !donnees} recharger={recharger}
      point={point} demande={demande} onPoint={setPoint} />
  )
  return <Ctx.Provider value={ctx}>{children(panneau, ouverts.length)}</Ctx.Provider>
}

function PanneauCommentaires({ magasin, annee, moi, fils, panne, recharger, point, demande, onPoint }: {
  magasin: string; annee: number; moi: Profil | null; fils: Fil[]; panne: boolean; recharger: () => void
  point: { ancre: string; libelle: string } | null; demande: number; onPoint: (p: { ancre: string; libelle: string } | null) => void
}) {
  const [texte, setTexte] = useState('')
  const [reponse, setReponse] = useState<{ id: number; texte: string } | null>(null)
  const [voirResolus, setVoirResolus] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [probleme, setProbleme] = useState<string | null>(null)
  const boite = useRef<HTMLDivElement>(null)
  const champ = useRef<HTMLTextAreaElement>(null)
  const peutEcrire = !!moi && moi.role !== 'aucun'
  // Un point demandé depuis sa bulle : le panneau vient à l'écran, le champ prend la main
  useEffect(() => {
    if (!demande) return
    boite.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    champ.current?.focus({ preventScroll: true })
  }, [demande])

  const agir = async (f: () => Promise<void>, apres?: () => void) => {
    setOccupe(true); setProbleme(null)
    try { await f(); apres?.(); recharger() } catch { setProbleme('Le commentaire n’est pas enregistré. Vérifie ta connexion, puis réessaie.') } finally { setOccupe(false) }
  }
  const sur = point ?? ANCRE_BUDGET
  const visibles = fils.filter((f) => (!point || f.ancre === point.ancre))
  const ouverts = visibles.filter((f) => !f.resoluLe), resolus = visibles.filter((f) => f.resoluLe)
  const total = fils.filter((f) => !f.resoluLe).length

  const carte = (f: Fil) => (
    <Box key={f.id} component="li" aria-label={`Commentaire sur ${f.ancreLibelle ?? ANCRE_BUDGET.libelle}`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25, display: 'grid', gap: 0.75, opacity: f.resoluLe ? 0.75 : 1, bgcolor: 'background.paper' }}>
      {!point && (
        <Button size="small" onClick={() => onPoint({ ancre: f.ancre, libelle: f.ancreLibelle ?? ANCRE_BUDGET.libelle })}
          sx={{ justifyContent: 'flex-start', p: 0, minHeight: { xs: 48, lg: 28 }, fontWeight: 700, color: 'warning.dark', textAlign: 'left' }}>
          {f.ancreLibelle ?? ANCRE_BUDGET.libelle}
        </Button>
      )}
      {[f, ...f.reponses].map((m, i) => (
        <Box key={m.id} sx={{ ...(i ? { ml: 1.5, pl: 1.25, borderLeft: 2, borderColor: 'divider' } : {}), display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{`${qui(m.auteurRole, m.auteurNom)} · ${quand(m.creeLe)}`}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.texte}</Typography>
          </Box>
          {m.auteur === moi?.id && (
            <Tooltip title="Retirer">
              <IconButton aria-label={i ? 'Retirer ma réponse' : 'Retirer mon commentaire'} disabled={occupe} onClick={() => void agir(() => retirerMessage(m.id))} sx={{ width: { xs: 48, lg: 32 }, height: { xs: 48, lg: 32 } }}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}
      {f.resoluLe && <Typography variant="body2" color="text.secondary">{`Résolu par ${qui(f.resoluParRole, f.resoluParNom)} · ${quand(f.resoluLe)}`}</Typography>}
      {peutEcrire && (reponse?.id === f.id ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <TextField size="small" multiline minRows={2} autoFocus label="Ta réponse" value={reponse.texte} onChange={(e) => setReponse({ id: f.id, texte: e.target.value.slice(0, MAX_TEXTE) })} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" size="small" disabled={occupe || !reponse.texte.trim()} sx={{ minHeight: { xs: 48, lg: 36 } }}
              onClick={() => void agir(() => envoyerCommentaire(magasin, annee, { ancre: f.ancre, libelle: f.ancreLibelle ?? '', texte: reponse.texte, parent: f.id }), () => setReponse(null))}>Répondre</Button>
            <Button size="small" onClick={() => setReponse(null)} sx={{ minHeight: { xs: 48, lg: 36 } }}>Annuler</Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {!f.resoluLe && <Button size="small" onClick={() => setReponse({ id: f.id, texte: '' })} sx={{ minHeight: { xs: 48, lg: 32 } }}>Répondre</Button>}
          <Button size="small" startIcon={f.resoluLe ? undefined : <CheckCircleOutlined />} disabled={occupe} sx={{ minHeight: { xs: 48, lg: 32 } }}
            onClick={() => void agir(() => resoudreCommentaire(f.id, !f.resoluLe))}>{f.resoluLe ? 'Rouvrir' : 'Résolu'}</Button>
        </Box>
      ))}
    </Box>
  )

  return (
    <Card ref={boite} component="section" aria-label="Commentaires" className="pas-a-l-impression" sx={{ p: 2, display: 'grid', gap: 1.5, scrollMarginTop: 90 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '1.125rem', flex: 1 }}>Commentaires</Typography>
        {total > 0 && <Chip size="small" color="warning" label={total > 1 ? `${total} ouverts` : '1 ouvert'} />}
      </Box>
      {panne && <Alert severity="warning">Les commentaires ne se chargent pas pour l’instant. Réessaie dans un moment.</Alert>}
      {point && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', flex: 1, minWidth: 0 }}>{`Sur : ${point.libelle}`}</Typography>
          <Button size="small" startIcon={<CloseOutlined />} onClick={() => onPoint(null)} sx={{ minHeight: { xs: 48, lg: 32 } }}>Tout voir</Button>
        </Box>
      )}
      {ouverts.length === 0 && resolus.length === 0 && !panne && (
        <Typography variant="body2" color="text.secondary">
          {point ? 'Aucun commentaire sur ce point.' : 'Aucun commentaire. Pour commenter un point précis, clique sur la bulle à côté de lui.'}
        </Typography>
      )}
      {ouverts.length > 0 && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>{ouverts.map(carte)}</Box>}
      {resolus.length > 0 && (
        <>
          <Button size="small" onClick={() => setVoirResolus((v) => !v)} sx={{ justifySelf: 'start', minHeight: { xs: 48, lg: 32 } }}>
            {voirResolus ? 'Masquer les résolus' : `Voir ${resolus.length > 1 ? `les ${resolus.length} résolus` : 'le résolu'}`}
          </Button>
          {voirResolus && <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>{resolus.map(carte)}</Box>}
        </>
      )}
      {peutEcrire && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {probleme && <Alert severity="error">{probleme}</Alert>}
          <TextField inputRef={champ} size="small" multiline minRows={2} maxRows={6} label={`Commenter : ${sur.libelle}`} value={texte}
            onChange={(e) => setTexte(e.target.value.slice(0, MAX_TEXTE))} />
          <Button variant="contained" startIcon={<AddCommentOutlined />} disabled={occupe || !texte.trim()} sx={{ justifySelf: 'start', minHeight: 48 }}
            onClick={() => void agir(() => envoyerCommentaire(magasin, annee, { ancre: sur.ancre, libelle: sur.libelle, texte }), () => setTexte(''))}>
            Commenter
          </Button>
        </Box>
      )}
    </Card>
  )
}

// Sans budget à commenter (autres espaces, magasin sans base), la page telle quelle
export function AvecCommentaires({ actif, magasin, annee, moi, children }: {
  actif: boolean; magasin: string; annee: number; moi: Profil | null
  children: (panneau: ReactNode, ouverts: number) => ReactNode
}) {
  if (!actif || !moi) return <>{children(null, 0)}</>
  return <CommentairesBudget magasin={magasin} annee={annee} moi={moi}>{children}</CommentairesBudget>
}
