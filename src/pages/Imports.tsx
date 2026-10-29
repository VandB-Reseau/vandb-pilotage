import { useRef, useState } from 'react'
import { useSaisieEnCours } from '../components/GardeSaisie'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
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
import AddOutlined from '@mui/icons-material/AddOutlined'
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import { BoutonModele } from '../components/BoutonModele'
import { ChoixMagasin } from '../components/ChoixMagasin'
import { MODELES } from '../lib/modeles'
import { Panne } from '../components/Panne'
import { anneeBudget, chargerBudgets, chargerCodes, enregistrerCode, importerQuadrimestres, importerReel, supprimerCode } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { apercuImport, FichierInattendu, lireQuadrimestres, lireTickets, lireVentes, type QuadrimestreLu, type TicketsMois, type VenteMois } from '../import/caisse'
import { montant, MOIS_LONGS, taux } from '../lib/format'

interface Lus { fichiers: string[]; ventes: VenteMois[]; tickets: TicketsMois[]; erreurs: string[]; alertes: string[] }
type Message = { gravite: 'success' | 'error'; texte: string }

const nomMois = (m: string) => `${MOIS_LONGS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const MAX_DETAILS = 8

// Lit chaque fichier choisi : ventes ou tickets, reconnus à leurs colonnes
async function lireFichiers(fichiers: File[]): Promise<Lus> {
  const lus: Lus = { fichiers: [], ventes: [], tickets: [], erreurs: [], alertes: [] }
  for (const f of fichiers) {
    const texte = await f.text()
    try {
      const v = lireVentes(texte)
      lus.ventes.push(...v.lignes)
      lus.erreurs.push(...v.erreurs.map((e) => `${f.name}, ${e.charAt(0).toLowerCase()}${e.slice(1)}`))
      lus.alertes.push(...v.alertes)
      lus.fichiers.push(f.name)
      continue
    } catch (e) {
      if (!(e instanceof FichierInattendu)) { lus.erreurs.push(`${f.name} : fichier illisible.`); continue }
    }
    try {
      const t = lireTickets(texte)
      lus.tickets.push(...t.lignes)
      lus.erreurs.push(...t.erreurs.map((e) => `${f.name}, ${e.charAt(0).toLowerCase()}${e.slice(1)}`))
      lus.fichiers.push(f.name)
    } catch {
      lus.erreurs.push(`${f.name} : ce n’est ni un fichier de ventes ni un fichier de tickets (colonnes attendues : code_magasin, date, univers, puis famille, ca_ht, ca_ttc, marge_ht ou tickets).`)
    }
  }
  lus.alertes = [...new Set(lus.alertes)]
  return lus
}

export function Imports() {
  const annee = anneeBudget()
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerCodes(), chargerBudgets(annee)]).then(([codes, d]) => ({ codes, magasins: d.magasins.map((l) => l.magasin) })), [annee])
  const entree = useRef<HTMLInputElement>(null)
  const [lus, setLus] = useState<Lus | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [occupe, setOccupe] = useState(false)
  const entreeQuadri = useRef<HTMLInputElement>(null)
  const [quadri, setQuadri] = useState<{ fichier: string; lignes: QuadrimestreLu[]; erreurs: string[] } | null>(null)
  const [nouveauCode, setNouveauCode] = useState('')
  const [nouveauMagasin, setNouveauMagasin] = useState<string | null>(null)
  useSaisieEnCours(!!lus || !!quadri)

  if (chargement && !donnees) return <Box><Typography variant="h1">Imports de caisse</Typography><Skeleton variant="rounded" height={240} sx={{ mt: 3 }} /></Box>
  if (erreur || !donnees) return <Box><Typography variant="h1" sx={{ mb: 3 }}>Imports de caisse</Typography><Panne quoi="Les codes caisse" recharger={recharger} /></Box>

  const { codes, magasins } = donnees
  const magasinDuCode = new Map(codes.map((c) => [c.code, c.magasin]))
  const apercu = lus ? apercuImport(lus.ventes, lus.tickets, magasinDuCode) : null
  // Quadrimestres : le code caisse ou le nom du magasin
  const magasinQuadri = (code: string) => magasinDuCode.get(code) ?? magasins.find((m) => m.toLowerCase() === code.toLowerCase()) ?? null
  const quadriRetenus = quadri?.lignes.filter((l) => magasinQuadri(l.code)) ?? []
  const quadriInconnus = [...new Set(quadri?.lignes.filter((l) => !magasinQuadri(l.code)).map((l) => l.code) ?? [])]
  const sansCode = magasins.filter((m) => !codes.some((c) => c.magasin === m))

  const agir = async (action: () => Promise<string>) => {
    setOccupe(true)
    setMessage(null)
    try {
      setMessage({ gravite: 'success', texte: await action() })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  const rattacher = (code: string, magasin: string | null) => {
    if (!magasin) return
    void agir(async () => { await enregistrerCode(code, magasin); return `Code ${code} rattaché à ${magasin}.` })
  }

  return (
    <Box>
      <Typography variant="h1">Imports de caisse</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>Ventes et tickets mensuels de la DSI</Typography>

      {message && <Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }} sx={{ mb: 3 }}>{message.texte}</Alert>}

      <Stack spacing={3}>
        <Card component="section" aria-label="Fichiers de la DSI" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h2" sx={{ flex: 1 }}>Fichiers du mois</Typography>
            <BoutonModele modele={MODELES.ventes} libelle="Modèle des ventes" />
            <BoutonModele modele={MODELES.tickets} libelle="Modèle des tickets" />
            <Button variant={lus ? 'outlined' : 'contained'} startIcon={<UploadFileOutlined />} disabled={occupe} onClick={() => entree.current?.click()} sx={{ minHeight: 48 }}>
              Choisir les fichiers
            </Button>
            <input ref={entree} type="file" accept=".csv,.txt,text/csv" multiple hidden aria-label="Fichiers de ventes et de tickets"
              onChange={async (e) => {
                const choisis = [...(e.target.files ?? [])]
                e.target.value = ''
                if (!choisis.length) return
                setMessage(null)
                setLus(await lireFichiers(choisis))
              }} />
          </Box>

          {lus && apercu && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Typography>
                {lus.fichiers.length ? `${lus.fichiers.join(', ')} : ` : ''}
                {apercu.mois.length ? apercu.mois.map(nomMois).join(', ') : 'aucune ligne lisible'}
              </Typography>
              {lus.erreurs.length > 0 && (
                <Alert severity="error">
                  {lus.erreurs.length === 1 ? 'Une ligne est écartée :' : `${lus.erreurs.length} lignes sont écartées :`}
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {lus.erreurs.slice(0, MAX_DETAILS).map((t) => <li key={t}>{t}</li>)}
                    {lus.erreurs.length > MAX_DETAILS && <li>et {lus.erreurs.length - MAX_DETAILS} autres.</li>}
                  </Box>
                </Alert>
              )}
              {lus.alertes.length > 0 && (
                <Alert severity="warning">
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>{lus.alertes.map((t) => <li key={t}>{t}</li>)}</Box>
                </Alert>
              )}
              {apercu.codesInconnus.length > 0 && (
                <Box component="section" aria-label="Codes caisse inconnus"><Alert severity="warning">
                  {apercu.codesInconnus.length === 1 ? 'Un code caisse n’est rattaché à aucun magasin : ses lignes ne seront pas importées.' : `${apercu.codesInconnus.length} codes caisse ne sont rattachés à aucun magasin : leurs lignes ne seront pas importées.`}
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {apercu.codesInconnus.map((code) => (
                      <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography sx={{ minWidth: 64, fontWeight: 700 }}>{code}</Typography>
                        <ChoixMagasin libelle={`Magasin du code ${code}`} options={sansCode} desactive={occupe} onChange={(m) => rattacher(code, m)} />
                      </Box>
                    ))}
                  </Stack>
                </Alert></Box>
              )}
              {apercu.lignes.length > 0 && (
                <TableContainer>
                  <Table size="small" className="colonne-fixe" aria-label="Aperçu de l’import">
                    <TableHead>
                      <TableRow>
                        <TableCell>Magasin</TableCell>
                        <TableCell>Mois</TableCell>
                        <TableCell align="right">CA HT</TableCell>
                        <TableCell align="right">Marge</TableCell>
                        <TableCell align="right">Tickets</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apercu.lignes.map((l) => (
                        <TableRow key={`${l.magasin}|${l.mois}`}>
                          <TableCell>{l.magasin}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{nomMois(l.mois)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{montant(l.caHT)}</TableCell>
                          <TableCell align="right">{taux(l.tauxMarge)}</TableCell>
                          <TableCell align="right">{l.tickets || ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" startIcon={<CloudUploadOutlined />} disabled={occupe || apercu.lignes.length === 0} sx={{ minHeight: 48 }}
                  onClick={() => void agir(async () => {
                    const r = await importerReel(lus.ventes, lus.tickets, codes)
                    setLus(null)
                    return `Réel importé : ${r.mois.map(nomMois).join(', ')}, ${r.magasins} magasin${r.magasins > 1 ? 's' : ''}. Les mois reçus remplacent ceux déjà enregistrés.`
                  })}>
                  Importer
                </Button>
                <Button onClick={() => setLus(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
              </Box>
            </Stack>
          )}
        </Card>

        <Card component="section" aria-label="Quadrimestres des comptables" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h2" sx={{ flex: 1 }}>Quadrimestres des comptables</Typography>
            <BoutonModele modele={MODELES.quadrimestres} />
            <Button variant="outlined" startIcon={<UploadFileOutlined />} disabled={occupe} onClick={() => entreeQuadri.current?.click()} sx={{ minHeight: 48 }}>
              Choisir le fichier
            </Button>
            <input ref={entreeQuadri} type="file" accept=".csv,.txt,text/csv" hidden aria-label="Fichier des quadrimestres"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setMessage(null)
                try {
                  const l = lireQuadrimestres(await f.text())
                  setQuadri({ fichier: f.name, lignes: l.lignes, erreurs: l.erreurs })
                } catch {
                  setQuadri({ fichier: f.name, lignes: [], erreurs: ['Colonnes attendues : code_magasin, annee, quadrimestre, achats, variation_stock, charges_externes, impots_taxes, personnel, tresorerie.'] })
                }
              }} />
          </Box>
          {quadri && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Typography>
                {quadri.fichier} : {quadriRetenus.length === 0 ? 'aucune ligne à importer' : (() => { const m = new Set(quadriRetenus.map((l) => magasinQuadri(l.code))).size; return `${quadriRetenus.length === 1 ? '1 quadrimestre' : `${quadriRetenus.length} quadrimestres`}, ${m === 1 ? '1 magasin' : `${m} magasins`}` })()}
              </Typography>
              {quadri.erreurs.length > 0 && (
                <Alert severity="error">
                  {quadri.erreurs.length === 1 ? 'Une ligne est écartée :' : `${quadri.erreurs.length} lignes sont écartées :`}
                  <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                    {quadri.erreurs.slice(0, MAX_DETAILS).map((t) => <li key={t}>{t}</li>)}
                    {quadri.erreurs.length > MAX_DETAILS && <li>et {quadri.erreurs.length - MAX_DETAILS} autres.</li>}
                  </Box>
                </Alert>
              )}
              {quadriInconnus.length > 0 && <Alert severity="warning">Magasin introuvable pour : {quadriInconnus.slice(0, MAX_DETAILS).join(', ')}{quadriInconnus.length > MAX_DETAILS ? '…' : '.'} Ces lignes ne seront pas importées.</Alert>}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" startIcon={<CloudUploadOutlined />} disabled={occupe || quadriRetenus.length === 0} sx={{ minHeight: 48 }}
                  onClick={() => void agir(async () => {
                    await importerQuadrimestres(quadriRetenus.map(({ code, annee, quadrimestre, ...saisie }) => ({ magasin: magasinQuadri(code)!, annee, quadrimestre, saisie })))
                    const n = quadriRetenus.length
                    setQuadri(null)
                    return `${n === 1 ? 'Quadrimestre importé' : `${n} quadrimestres importés`}.`
                  })}>
                  Importer
                </Button>
                <Button onClick={() => setQuadri(null)} disabled={occupe} sx={{ minHeight: 48 }}>Annuler</Button>
              </Box>
            </Stack>
          )}
        </Card>

        <Card component="section" aria-label="Codes caisse">
          <Typography variant="h2" sx={{ p: 2, pb: 1 }}>Codes caisse</Typography>
          <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="Code caisse" value={nouveauCode} onChange={(e) => setNouveauCode(e.target.value)} sx={{ width: 140 }} />
            <ChoixMagasin libelle="Magasin" options={sansCode} valeur={nouveauMagasin} onChange={setNouveauMagasin} />
            <Button startIcon={<AddOutlined />} disabled={occupe || !nouveauCode.trim() || !nouveauMagasin} sx={{ minHeight: 48 }}
              onClick={() => {
                const code = nouveauCode.trim(), magasin = nouveauMagasin
                setNouveauCode('')
                setNouveauMagasin(null)
                rattacher(code, magasin)
              }}>
              Rattacher
            </Button>
          </Box>
          {codes.length === 0 ? (
            <Box sx={{ px: 2, pb: 2 }}><Alert severity="info">Aucun code caisse rattaché pour l’instant. Chaque magasin doit avoir le sien pour que ses ventes soient importées.</Alert></Box>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Codes caisse rattachés">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Magasin</TableCell>
                    <TableCell align="right"><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</Box></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {codes.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell>{c.code}</TableCell>
                      <TableCell>{c.magasin}</TableCell>
                      <TableCell align="right">
                        <IconButton aria-label={`Retirer le code ${c.code}`} disabled={occupe} sx={{ width: 48, height: 48 }}
                          onClick={() => void agir(async () => { await supprimerCode(c.code); return `Code ${c.code} retiré.` })}>
                          <DeleteOutlined />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {codes.length > 0 && sansCode.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {sansCode.length === 1 ? `1 magasin sans code caisse : ${sansCode[0]}.` : `${sansCode.length} magasins sans code caisse : ${sansCode.slice(0, 5).join(', ')}${sansCode.length > 5 ? '…' : '.'}`}
            </Typography>
          )}
        </Card>
      </Stack>
    </Box>
  )
}
