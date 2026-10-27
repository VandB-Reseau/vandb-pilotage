import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined'
import { ChampNombre } from './ChampNombre'
import { EtatVide } from './EtatVide'
import { useSaisieEnCours } from './GardeSaisie'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { chargerReel, enregistrerMoisReel } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { milliers, montant, MOIS, MOIS_LONGS, taux } from '../lib/format'
import { syntheseReel } from '../moteur/reel'
import { cleVente, famillesASaisir, lireSaisie, saisieDepuisReel, UNIVERS_TICKETS, type ChampsVente, type SaisieMois } from '../moteur/saisieReel'
import { universLibelle } from '../moteur/types'

const VIDE: ChampsVente = { caHT: '', caTTC: '', margeHT: '' }
const nombreEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const panier = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Réel d'une année d'un magasin : indicateurs, CA par famille et par mois, saisie d'un mois
export function ReelAnnee({ magasin, annee, peutSaisir, apresEnregistrement }: { magasin: string; annee: number; peutSaisir: boolean; apresEnregistrement?: () => void }) {
  const { donnees, erreur, chargement, recharger } = useChargement(() => chargerReel(magasin, annee), [magasin, annee])
  const [mois, setMois] = useState<number | null>(null)
  const [saisie, setSaisie] = useState<SaisieMois>({ ventes: {}, tickets: {} })
  const [erreursSaisie, setErreursSaisie] = useState<string[]>([])
  const [message, setMessage] = useState<{ gravite: 'success' | 'error'; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  // Saisie dans la page, sans fenêtre : le panneau s'ouvre en tête et la page y remonte
  const [initiale, setInitiale] = useState('')
  const panneau = useRef<HTMLElement>(null)
  useEffect(() => { if (mois !== null) panneau.current?.scrollIntoView?.({ block: 'start' }) }, [mois])
  useSaisieEnCours(mois !== null && JSON.stringify(saisie) !== initiale)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={240} />
  if (erreur || !donnees) return <Panne quoi={`Les chiffres réels ${annee}`} recharger={recharger} />

  const s = syntheseReel(donnees.lignes, donnees.tickets)
  const ouvrir = (m: number) => {
    setMois(m)
    const depart = saisieDepuisReel(donnees.lignes, donnees.tickets, m)
    setSaisie(depart)
    setInitiale(JSON.stringify(depart))
    setErreursSaisie([])
  }
  const changerVente = (cle: string, champ: keyof ChampsVente, v: string) =>
    setSaisie((x) => ({ ...x, ventes: { ...x.ventes, [cle]: { ...(x.ventes[cle] ?? VIDE), [champ]: v } } }))

  const enregistrer = async () => {
    if (mois === null) return
    const lu = lireSaisie(saisie)
    setErreursSaisie(lu.erreurs)
    if (lu.erreurs.length) return
    setOccupe(true)
    try {
      await enregistrerMoisReel(magasin, annee, mois, lu.lignes, lu.tickets)
      setMessage({ gravite: 'success', texte: `Réel de ${MOIS_LONGS[mois - 1]} ${annee} enregistré.` })
      setMois(null)
      recharger()
      apresEnregistrement?.()
    } catch {
      setErreursSaisie(['L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.'])
    } finally {
      setOccupe(false)
    }
  }

  const boutonSaisie = peutSaisir && (
    <Button variant={s.moisRenseignes ? 'outlined' : 'contained'} startIcon={<EditCalendarOutlined />} sx={{ minHeight: 48 }}
      onClick={() => ouvrir(Math.min(12, s.moisRenseignes + 1))}>
      Saisir un mois
    </Button>
  )

  return (
    <Stack spacing={3}>
      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert>}

      {s.moisRenseignes === 0 ? (
        <EtatVide
          titre={`Pas encore de chiffres réels ${annee}`}
          texte={peutSaisir
            ? `Le CA, la marge et les tickets de ${annee} arrivent chaque mois par les fichiers de caisse. Tu peux aussi saisir un mois à la main.`
            : `Le CA, la marge et les tickets de ${annee} arrivent chaque mois par les fichiers de caisse.`}
          action={boutonSaisie || undefined}
        />
      ) : (
        <>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Réel ${annee} en chiffres`}>
            <Indicateur libelle={`CA HT ${annee}`} valeur={milliers(s.caHT)} detail={s.moisRenseignes === 12 ? 'Année complète' : `De janvier à fin ${MOIS_LONGS[s.moisRenseignes - 1]}`} />
            <Indicateur libelle="Marge théorique" valeur={taux(s.tauxMarge)} detail={milliers(s.margeHT)} />
            <Indicateur libelle="Tickets" valeur={nombreEntier.format(s.tickets)} detail="Cave et Bar" />
            <Indicateur libelle="Panier moyen TTC" valeur={s.panierTTC === null ? 'Non connu' : panier.format(s.panierTTC)} detail={s.panierTTC === null ? 'Il faut le CA TTC et les tickets' : undefined} />
          </Stack>
          {boutonSaisie && <Box>{boutonSaisie}</Box>}

          <Card component="section" aria-label={`CA par famille ${annee}`}>
            <Typography variant="h2" sx={{ p: 2, pb: 0 }}>CA HT par famille</Typography>
            <TableContainer>
              <Table className="colonne-fixe" size="small" aria-label={`Réel ${annee} par famille et par mois`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Famille</TableCell>
                    {MOIS.map((m, i) => (
                      <TableCell key={m} align="right">
                        {peutSaisir
                          ? <Button size="small" onClick={() => ouvrir(i + 1)} aria-label={`Saisir ${MOIS_LONGS[i]} ${annee}`} sx={{ minHeight: 48, minWidth: 0, px: 1 }}>{m}</Button>
                          : m}
                      </TableCell>
                    ))}
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Part</TableCell>
                    <TableCell align="right">Marge</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.familles.map((f) => (
                    <TableRow key={`${f.univers}/${f.famille}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.famille} ({universLibelle[f.univers]})</TableCell>
                      {f.parMois.map((v, i) => <TableCell key={i} align="right" sx={{ whiteSpace: 'nowrap' }}>{v ? montant(v) : ''}</TableCell>)}
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{montant(f.caHT)}</TableCell>
                      <TableCell align="right">{taux(f.part)}</TableCell>
                      <TableCell align="right">{taux(f.tauxMarge)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total CA HT</TableCell>
                    {s.parMois.map((m) => <TableCell key={m.mois} align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{m.caHT ? montant(m.caHT) : ''}</TableCell>)}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{montant(s.caHT)}</TableCell>
                    <TableCell />
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{taux(s.tauxMarge)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tickets</TableCell>
                    {s.parMois.map((m) => <TableCell key={m.mois} align="right">{m.tickets ? nombreEntier.format(m.tickets) : ''}</TableCell>)}
                    <TableCell align="right">{nombreEntier.format(s.tickets)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Panier moyen TTC</TableCell>
                    {s.parMois.map((m) => <TableCell key={m.mois} align="right" sx={{ whiteSpace: 'nowrap' }}>{m.panierTTC === null ? '' : panier.format(m.panierTTC)}</TableCell>)}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{s.panierTTC === null ? '' : panier.format(s.panierTTC)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}

      {mois !== null && (
      <Card component="section" ref={panneau} aria-labelledby="titre-saisie" sx={{ p: { xs: 2, md: 3 }, order: -1, scrollMarginTop: 96 }}>
        <Typography variant="h2" id="titre-saisie" sx={{ mb: 2 }}>Réel du mois · {magasin}</Typography>
        <Box>
          <TextField select label="Mois" value={mois ?? 1} onChange={(e) => ouvrir(Number(e.target.value))} sx={{ minWidth: 200, mb: 2, '& .MuiSelect-select': { minHeight: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center' }, '& .MuiSelect-nativeInput': { height: 48 } }}>
            {MOIS_LONGS.map((m, i) => <MenuItem key={m} value={i + 1} sx={{ minHeight: 48 }}>{m} {annee}</MenuItem>)}
          </TextField>
          {erreursSaisie.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erreursSaisie.length === 1 ? erreursSaisie[0] : <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{erreursSaisie.map((t) => <li key={t}>{t}</li>)}</Box>}
            </Alert>
          )}
          <Typography variant="h4" component="h3" sx={{ mb: 1 }}>Tickets</Typography>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', mb: 3 }}>
            {UNIVERS_TICKETS.map((u) => (
              <Box key={u} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ minWidth: 48 }}>{universLibelle[u]}</Typography>
                <ChampNombre libelle={`Tickets ${universLibelle[u]}`} valeur={saisie.tickets[u] ?? ''} unite="" largeur={120}
                  onChange={(v) => setSaisie((x) => ({ ...x, tickets: { ...x.tickets, [u]: v } }))} />
              </Box>
            ))}
          </Stack>
          {famillesASaisir(saisie).map(({ univers, familles }) => (
            <Box key={univers} sx={{ mb: 3 }}>
              <Typography variant="h4" component="h3" sx={{ mb: 1 }}>{universLibelle[univers]}</Typography>
              <TableContainer sx={{ maxHeight: 'none' }}>
                <Table size="small" className="colonne-fixe" aria-label={`Ventes ${universLibelle[univers]}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Famille</TableCell>
                      <TableCell align="right">CA HT</TableCell>
                      <TableCell align="right">CA TTC</TableCell>
                      <TableCell align="right">Marge HT</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {familles.map((famille) => {
                      const cle = cleVente(univers, famille)
                      const c = saisie.ventes[cle] ?? VIDE
                      const nom = `${famille} (${universLibelle[univers]})`
                      return (
                        <TableRow key={cle}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{famille}</TableCell>
                          <TableCell align="right"><ChampNombre libelle={`CA HT : ${nom}`} valeur={c.caHT} onChange={(v) => changerVente(cle, 'caHT', v)} /></TableCell>
                          <TableCell align="right"><ChampNombre libelle={`CA TTC : ${nom}`} valeur={c.caTTC} onChange={(v) => changerVente(cle, 'caTTC', v)} /></TableCell>
                          <TableCell align="right"><ChampNombre libelle={`Marge HT : ${nom}`} valeur={c.margeHT} onChange={(v) => changerVente(cle, 'margeHT', v)} /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button onClick={() => setMois(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
          <Button variant="contained" onClick={() => void enregistrer()} disabled={occupe} sx={{ minHeight: 48 }}>Enregistrer le mois</Button>
        </Box>
      </Card>
      )}
    </Stack>
  )
}
