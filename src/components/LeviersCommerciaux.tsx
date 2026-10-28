import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined'
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined'
import { Aide } from './Aide'
import { ChampNombre } from './ChampNombre'
import { ChampTaux } from './ChampTaux'
import { nombre } from '../import/caisse'
import { ecartPts, milliers, panier as prixPanier, taux } from '../lib/format'
import { baseLeviers, effetLeviers, type Leviers } from '../moteur/leviers'
import type { UniversTickets } from '../moteur/suivi'
import { universLibelle, type Budget } from '../moteur/types'

type Saisie = { tickets: number | undefined; panier: string; mix: number | undefined }
const vide: Saisie = { tickets: undefined, panier: '', mix: undefined }
const lire = (s: Saisie): Leviers => {
  const p = nombre(s.panier)
  return { tickets: s.tickets ?? 0, panier: p === null || Number.isNaN(p) ? 0 : p, mix: s.mix ?? 0 }
}
const signe = (v: number) => `${v >= 0 ? '+' : '−'}${milliers(Math.abs(v))}`

// Leviers commerciaux chiffrés (lot 28) : un simulateur sur un an, Cave et Bar séparés, rien n'est enregistré ;
// « En faire une action » ouvre le plan d'action avec le levier écrit
export function LeviersCommerciaux({ budget, annee, parametres, proposerAction }: {
  budget: Budget
  annee: number
  parametres: { tauxRedevance: number; tauxPublicite: number }
  proposerAction?: (intitule: string) => void
}) {
  const base = baseLeviers(budget)
  const univers = (['cave', 'bar'] as UniversTickets[]).filter((u) => base[u])
  const [saisie, setSaisie] = useState<Partial<Record<UniversTickets, Saisie>>>({})
  if (!univers.length) return null
  const leviers = Object.fromEntries(univers.map((u) => [u, lire(saisie[u] ?? vide)])) as Partial<Record<UniversTickets, Leviers>>
  const effet = effetLeviers(base, leviers, parametres)
  const actif = univers.some((u) => { const l = leviers[u]!; return l.tickets || l.panier || l.mix })
  const changer = (u: UniversTickets, x: Partial<Saisie>) => setSaisie((s) => ({ ...s, [u]: { ...(s[u] ?? vide), ...x } }))
  // Intitulé de l'action : les leviers retenus, univers par univers, et ce qu'ils rapportent
  const intitule = () => univers.flatMap((u) => {
    const l = leviers[u]!
    const parts = [
      l.tickets ? `${l.tickets > 0 ? '+' : ''}${taux(l.tickets)} de tickets` : '',
      l.panier ? `${l.panier > 0 ? '+' : ''}${prixPanier(l.panier)} de panier` : '',
      l.mix ? `${ecartPts(l.mix)} de marge par le mix` : '',
    ].filter(Boolean)
    return parts.length ? [`${universLibelle[u]} : ${parts.join(', ')}`] : []
  }).join(' ; ') + ` (${signe(effet.marge)} de marge sur un an)`

  return (
    <Card component="section" aria-label="Leviers commerciaux" className="pas-a-l-impression" sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 200 }}>Leviers commerciaux <Aide sujet="leviers" /></Typography>
        {actif && <Button startIcon={<RestartAltOutlined />} onClick={() => setSaisie({})} sx={{ minHeight: 48 }}>Remettre à zéro</Button>}
      </Box>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: `repeat(${univers.length}, 1fr)` } }}>
        {univers.map((u) => {
          const b = base[u]!, s = saisie[u] ?? vide, e = effet.univers[u]!
          return (
            <Box key={u} component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
              <Typography component="legend" variant="h3" sx={{ mb: 0.5 }}>{universLibelle[u]}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {milliers(b.ca)} de CA {annee} · marge {taux(b.tauxMarge)}{b.panierTTC ? ` · panier ${prixPanier(b.panierTTC)} TTC` : ''}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Tickets en plus</Typography>
                  <ChampTaux libelle={`Tickets en plus : ${universLibelle[u]}`} valeur={s.tickets} onChange={(v) => changer(u, { tickets: v })} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Panier en plus, TTC</Typography>
                  <ChampNombre libelle={`Panier en plus : ${universLibelle[u]}`} valeur={s.panier} largeur={120} unite="€" desactive={!b.panierTTC} onChange={(v) => changer(u, { panier: v })} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Mix mieux margé</Typography>
                  <ChampTaux libelle={`Points de marge par le mix : ${universLibelle[u]}`} valeur={s.mix} onChange={(v) => changer(u, { mix: v })} />
                </Box>
              </Box>
              <Typography sx={{ mt: 1.5, fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
                CA <b>{signe(e.ca)}</b> · marge <b>{signe(e.marge)}</b>
              </Typography>
            </Box>
          )
        })}
      </Box>
      <Box sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography component="p" sx={{ flex: 1, minWidth: 220, fontSize: '1.0625rem', fontVariantNumeric: 'tabular-nums' }} aria-label="Effet sur un an">
          Sur un an : CA <b>{signe(effet.ca)}</b> · marge <b>{signe(effet.marge)}</b> · EBE <b>{signe(effet.ebe)}</b>
        </Typography>
        {proposerAction && actif && (
          <Button variant="outlined" startIcon={<PlaylistAddOutlined />} onClick={() => proposerAction(intitule())} sx={{ minHeight: 48 }}>En faire une action</Button>
        )}
      </Box>
    </Card>
  )
}
