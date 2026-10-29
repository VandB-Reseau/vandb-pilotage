import { Fragment, useEffect, useRef, useState } from 'react'
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
import { ecartTaux, enChiffres, milliers, montant, MOIS, MOIS_LONGS, taux } from '../lib/format'
import { cumulUnivers, syntheseReel } from '../moteur/reel'
import { cleVente, famillesASaisir, lireSaisie, saisieDepuisReel, UNIVERS_TICKETS, type ChampsVente, type SaisieMois } from '../moteur/saisieReel'
import { UNIVERS, universLibelle } from '../moteur/types'

// Texte lu par les lecteurs d'écran seulement
const visuellementCache = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
const VIDE: ChampsVente = { caHT: '', caTTC: '', margeHT: '' }
const nombreEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const panier = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Réel d'une année d'un magasin : indicateurs, CA par famille et par mois, saisie d'un mois
export function ReelAnnee({ magasin, annee, peutSaisir, apresEnregistrement }: { magasin: string; annee: number; peutSaisir: boolean; apresEnregistrement?: () => void }) {
  const { donnees: tout, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerReel(magasin, annee), chargerReel(magasin, annee - 1).catch(() => null)]), [magasin, annee])
  const donnees = tout?.[0]
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
  const avant = tout?.[1] ? syntheseReel(tout[1].lignes, tout[1].tickets) : null
  // Cave et Bar séparés, comparés à l'an dernier sur les mêmes mois
  const parUnivers = (['cave', 'bar'] as const).filter((u) => s.parUnivers[u].tickets > 0).map((u) => {
    const n = s.parUnivers[u]
    const n1 = avant ? cumulUnivers(avant.parUnivers[u], s.moisRenseignes) : null
    const evo = (a: number | null, b: number | null | undefined) => (a !== null && b ? a / b - 1 : null)
    return { u, n, evoTickets: evo(n.tickets, n1?.tickets), evoPanier: evo(n.panierTTC, n1?.panierTTC) }
  })
  const surAvant = (e: number | null) => (e === null ? undefined : `${ecartTaux(e)} sur ${annee - 1}`)
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
            <Indicateur libelle="Marge théorique" aide="margeTheorique" valeur={taux(s.tauxMarge)} detail={milliers(s.margeHT)} />
            {parUnivers.map(({ u, n, evoTickets, evoPanier }) => (
              <Fragment key={u}>
                <Indicateur libelle={`Tickets ${universLibelle[u]}`} aide="ticketsPanier" valeur={nombreEntier.format(n.tickets)} detail={surAvant(evoTickets)} />
                <Indicateur libelle={`Panier ${universLibelle[u]} TTC`} aide="ticketsPanier" valeur={n.panierTTC === null ? 'Non connu' : panier.format(n.panierTTC)}
                  detail={n.panierTTC === null ? 'Il faut le CA TTC et les tickets' : surAvant(evoPanier)} />
              </Fragment>
            ))}
          </Stack>
          {boutonSaisie && <Box>{boutonSaisie}</Box>}

          <Card component="section" aria-label={`CA par famille ${annee}`}>
            <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>CA HT par famille</Typography>
            <TableContainer>
              <Table className="colonne-fixe" size="small" aria-label={`Réel ${annee} par famille et par mois`}
                sx={{ '& td, & th': { py: 0.75, px: 1, fontSize: '0.8125rem', whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 200 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros</Box></TableCell>
                    {MOIS.map((m, i) => (
                      <TableCell key={m} align="right">
                        {peutSaisir
                          ? <Button size="small" onClick={() => ouvrir(i + 1)} aria-label={`Saisir ${MOIS_LONGS[i]} ${annee}`} sx={{ minHeight: { xs: 48, md: 28 }, minWidth: 0, px: 0.5, fontSize: 'inherit' }}>{m}</Button>
                          : m}
                      </TableCell>
                    ))}
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">% du CA</TableCell>
                    <TableCell align="right">Marge</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {UNIVERS.filter((u) => s.familles.some((f) => f.univers === u)).map((u) => {
                    const familles = s.familles.filter((f) => f.univers === u)
                    const parMois = MOIS.map((_, i) => familles.reduce((a, f) => a + f.parMois[i], 0))
                    const ca = familles.reduce((a, f) => a + f.caHT, 0), marge = familles.reduce((a, f) => a + f.margeHT, 0)
                    const fond = { bgcolor: 'background.default' }
                    return (
                      <Fragment key={u}>
                        <TableRow sx={fond}>
                          <TableCell sx={{ ...fond, fontWeight: 700 }}>{universLibelle[u]}</TableCell>
                          {parMois.map((v, i) => <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>{v ? enChiffres(Math.round(v)) : ''}</TableCell>)}
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{montant(ca)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{taux(s.caHT ? ca / s.caHT : 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{taux(ca ? marge / ca : 0)}</TableCell>
                        </TableRow>
                        {familles.map((f) => (
                          <TableRow key={`${f.univers}/${f.famille}`}>
                            <TableCell sx={{ pl: '40px !important', color: 'text.secondary' }}>{f.famille}<Box component="span" sx={visuellementCache}> ({universLibelle[f.univers]})</Box></TableCell>
                            {f.parMois.map((v, i) => <TableCell key={i} align="right" sx={{ color: 'text.secondary' }}>{v ? enChiffres(Math.round(v)) : ''}</TableCell>)}
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{montant(f.caHT)}</TableCell>
                            <TableCell align="right" sx={{ color: 'text.secondary' }}>{taux(f.part)}</TableCell>
                            <TableCell align="right">{taux(f.tauxMarge)}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    )
                  })}
                  <TableRow sx={{ bgcolor: 'background.default', '& td': { fontWeight: 700, bgcolor: 'background.default' } }}>
                    <TableCell>Chiffre d’affaires HT</TableCell>
                    {s.parMois.map((m) => <TableCell key={m.mois} align="right">{m.caHT ? enChiffres(Math.round(m.caHT)) : ''}</TableCell>)}
                    <TableCell align="right">{montant(s.caHT)}</TableCell>
                    <TableCell align="right">{taux(1)}</TableCell>
                    <TableCell align="right">{taux(s.tauxMarge)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'background.default', '& td': { fontWeight: 700, bgcolor: 'background.default' } }}>
                    <TableCell>Marge théorique</TableCell>
                    {s.parMois.map((m) => <TableCell key={m.mois} align="right">{m.caHT ? enChiffres(Math.round(m.margeHT)) : ''}</TableCell>)}
                    <TableCell align="right">{montant(s.margeHT)}</TableCell>
                    <TableCell align="right">{taux(s.tauxMarge)}</TableCell>
                    <TableCell />
                  </TableRow>
                  {parUnivers.map(({ u, n }) => (
                    <Fragment key={u}>
                      <TableRow>
                        <TableCell>Tickets {universLibelle[u]}</TableCell>
                        {n.parMois.map((m, i) => <TableCell key={i} align="right">{m.tickets ? nombreEntier.format(m.tickets) : ''}</TableCell>)}
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{nombreEntier.format(n.tickets)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                      <TableRow>
                        <TableCell>Panier {universLibelle[u]} TTC</TableCell>
                        {n.parMois.map((m, i) => <TableCell key={i} align="right">{m.panierTTC === null ? '' : panier.format(m.panierTTC)}</TableCell>)}
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{n.panierTTC === null ? '' : panier.format(n.panierTTC)}</TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </Fragment>
                  ))}
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
