import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import PlaylistAddCheckOutlined from '@mui/icons-material/PlaylistAddCheckOutlined'
import SendOutlined from '@mui/icons-material/SendOutlined'
import { chargerBudgets, chargerParametres, preparerProposition, proposerBudget, type Preparation } from '../data/pilotage'
import { ecartTaux, milliers } from '../lib/format'
import { ebeComplet } from '../moteur/preparation'
import { PastilleStatut } from './PastilleStatut'
import { styleTableau } from '../theme/tableau'
import { anneeSuivi } from '../data/annees'

// Lot 41, proposition 1 (Joseph, 02/11/2026) : proposer et mettre à jour les budgets en série, depuis la Campagne.
// Le Directeur prépare les magasins de la liste affichée (filtres compris) : chaque proposition est calculée comme depuis
// le point de départ du magasin. Cochés d'office : les magasins sans budget dont l'équipe et les frais sont là, et les
// propositions dont l'atterrissage a bougé de plus de 2 %. Les ajustements des magasins restent.
const PAR_PAQUET = 4
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

export function PropositionsSerie({ annee, magasins, apres }: { annee: number; magasins: string[]; apres: () => void }) {
  const anneeEnCours = anneeSuivi()
  const [preparations, setPreparations] = useState<Preparation[] | null>(null)
  const [sansReel, setSansReel] = useState<string[]>([])
  const [coches, setCoches] = useState<Set<string>>(new Set())
  const [avance, setAvance] = useState<{ fait: number; total: number; quoi: string } | null>(null)
  const [message, setMessage] = useState<{ gravite: 'success' | 'error' | 'info'; texte: string } | null>(null)

  const preparer = async () => {
    setMessage(null)
    setPreparations(null)
    setAvance({ fait: 0, total: magasins.length, quoi: 'Préparation' })
    try {
      const [d, { parametres }] = await Promise.all([chargerBudgets(annee), chargerParametres(annee)])
      const lignes = magasins.map((m) => d.magasins.find((l) => l.magasin === m)).filter((l) => !!l)
      const r: Preparation[] = [], vides: string[] = []
      for (let i = 0; i < lignes.length; i += PAR_PAQUET) {
        const paquet = lignes.slice(i, i + PAR_PAQUET)
        const res = await Promise.all(paquet.map((l) => preparerProposition(l, d, anneeEnCours, annee, parametres)))
        res.forEach((p, k) => (p ? r.push(p) : vides.push(paquet[k].magasin)))
        setAvance({ fait: Math.min(i + PAR_PAQUET, lignes.length), total: lignes.length, quoi: 'Préparation' })
      }
      setPreparations(r)
      setSansReel(vides)
      setCoches(new Set(r.filter((p) => p.coche).map((p) => p.magasin)))
    } catch {
      setMessage({ gravite: 'error', texte: 'Les chiffres des magasins ne se sont pas chargés. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setAvance(null)
    }
  }

  const choisis = (preparations ?? []).filter((p) => coches.has(p.magasin) && p.action !== 'aucune')
  const nbProposer = choisis.filter((p) => p.action === 'proposer').length
  const nbMaj = choisis.length - nbProposer
  const libelle = [nbProposer && `Proposer ${pluriel(nbProposer, 'budget', 'budgets')}`, nbMaj && `${nbProposer ? 'mettre' : 'Mettre'} à jour ${pluriel(nbMaj, 'proposition', 'propositions')}`].filter(Boolean).join(' et ')

  const envoyer = async () => {
    setMessage(null)
    let faits = 0
    const echecs: string[] = []
    setAvance({ fait: 0, total: choisis.length, quoi: 'Envoi' })
    for (const p of choisis) {
      try { await proposerBudget(p.magasin, annee, p.base, p.hypotheses); faits++ } catch { echecs.push(p.magasin) }
      setAvance({ fait: faits + echecs.length, total: choisis.length, quoi: 'Envoi' })
    }
    setAvance(null)
    setPreparations(null)
    setMessage(echecs.length
      ? { gravite: 'error', texte: `${pluriel(faits, 'budget envoyé', 'budgets envoyés')} ; l’envoi n’a pas abouti pour ${echecs.join(', ')}. Vérifie ta connexion, puis prépare à nouveau.` }
      : { gravite: 'success', texte: `${pluriel(faits, 'proposition envoyée', 'propositions envoyées')} aux magasins.` })
    apres()
  }

  const basculer = (m: string) => setCoches((c) => { const n = new Set(c); if (n.has(m)) n.delete(m); else n.add(m); return n })
  const possibles = (preparations ?? []).filter((p) => p.action !== 'aucune')
  const tous = possibles.length > 0 && possibles.every((p) => coches.has(p.magasin))

  return (
    <Card component="section" aria-label="Proposer en série" sx={{ p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h2" sx={{ flex: 1, minWidth: 220 }}>Proposer en série</Typography>
        {!preparations && (
          <Button variant="outlined" startIcon={<PlaylistAddCheckOutlined />} disabled={!!avance || magasins.length === 0} onClick={() => void preparer()} sx={{ minHeight: 48 }}>
            {`Préparer les propositions (${pluriel(magasins.length, 'magasin', 'magasins')})`}
          </Button>
        )}
        {preparations && <Button onClick={() => setPreparations(null)} disabled={!!avance} sx={{ minHeight: 48 }}>Fermer</Button>}
      </Box>
      {avance && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>{avance.quoi} : {avance.fait} sur {avance.total}</Typography>
          <LinearProgress variant="determinate" value={avance.total ? (avance.fait / avance.total) * 100 : 0} aria-label={`${avance.quoi} des propositions`} />
        </Box>
      )}
      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }} sx={{ mt: 2 }}>{message.texte}</Alert>}
      {preparations && (
        <>
          {preparations.length === 0 ? (
            <Typography sx={{ mt: 2 }}>Aucun magasin de la liste n’a encore de réel cette année : il n’y a rien à proposer.</Typography>
          ) : (
            <TableContainer sx={{ mt: 2 }}>
              <Table size="small" aria-label="Propositions préparées" sx={styleTableau}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={tous} indeterminate={!tous && choisis.length > 0} onChange={() => setCoches(tous ? new Set() : new Set(possibles.map((p) => p.magasin)))}
                        slotProps={{ input: { 'aria-label': 'Tout cocher' } }} sx={{ width: 48, height: 48 }} />
                    </TableCell>
                    <TableCell>Magasin</TableCell>
                    <TableCell>Budget {annee}</TableCell>
                    <TableCell align="right">CA atterri {anneeEnCours}</TableCell>
                    <TableCell align="right">EBE proposé</TableCell>
                    <TableCell>Depuis la proposition</TableCell>
                    <TableCell>Fiche</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preparations.map((p) => {
                    const manque = [!p.etat.equipe && 'équipe', !p.etat.frais && 'frais', !p.etat.reel && 'réel en retard', !p.etat.ouverture && 'date d’ouverture'].filter(Boolean) as string[]
                    return (
                      <TableRow key={p.magasin}>
                        <TableCell padding="checkbox">
                          <Checkbox checked={coches.has(p.magasin)} disabled={p.action === 'aucune'} onChange={() => basculer(p.magasin)}
                            slotProps={{ input: { 'aria-label': `${p.action === 'proposer' ? 'Proposer' : 'Mettre à jour'} : ${p.magasin}` } }} sx={{ width: 48, height: 48 }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{p.magasin}</TableCell>
                        <TableCell><PastilleStatut statut={p.statut} /></TableCell>
                        <TableCell align="right">{milliers(p.caAtterri)}</TableCell>
                        <TableCell align="right" sx={ebeComplet(p.etat) ? undefined : { color: 'warning.dark' }}>{ebeComplet(p.etat) ? milliers(p.ebe) : 'Incomplet'}</TableCell>
                        <TableCell sx={p.ecart !== null && Math.abs(p.ecart) > 0.02 ? { fontWeight: 700 } : { color: 'text.secondary' }}>
                          {p.action === 'aucune' ? 'Budget validé' : p.ecart === null ? (p.statut ? '–' : 'Pas encore proposé') : `${ecartTaux(p.ecart)} d’atterrissage`}
                        </TableCell>
                        <TableCell sx={manque.length ? { color: 'warning.dark', whiteSpace: 'normal' } : { color: 'success.dark' }}>{manque.length ? manque.join(', ') : 'Complète'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {sansReel.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Sans réel {anneeEnCours}, laissés de côté : {sansReel.join(', ')}.</Typography>}
          {preparations.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <Button variant="contained" startIcon={<SendOutlined />} disabled={!!avance || choisis.length === 0} onClick={() => void envoyer()} sx={{ minHeight: 48 }}>
                {choisis.length ? libelle : 'Coche les magasins à proposer'}
              </Button>
              <Typography variant="body2" color="text.secondary">Les ajustements déjà faits par les magasins sont gardés.</Typography>
            </Box>
          )}
        </>
      )}
    </Card>
  )
}
