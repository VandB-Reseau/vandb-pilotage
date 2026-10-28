import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined'
import { BarreEnregistrement } from './BarreEnregistrement'
import { ChampNombre } from './ChampNombre'
import { useSaisieEnCours } from './GardeSaisie'
import { ImportFEC, type FichierFEC } from './ImportFEC'
import { Indicateur } from './Indicateur'
import { Panne } from './Panne'
import { atterrissageDe, chargerBudgets, chargerParametres, chargerQuadrimestres, chargerReel, chargerSecours, enregistrerQuadrimestres, hypothesesDe } from '../data/pilotage'
import { useChargement } from '../data/useChargement'
import { nombreChangements } from '../lib/aFaire'
import { nombre } from '../import/caisse'
import { lireFEC, texteDuFEC } from '../import/fec'
import { ecartMontant, ecartPts, ecartTaux, enChiffres, milliers, montant, MOIS, MOIS_LONGS, taux } from '../lib/format'
import { tresorerieBudget, tresorerieGlissante } from '../moteur/tresorerie'
import { calculerBudget } from '../moteur/budget'
import { comparaisonPeriode, memePeriode, moisDuQuadrimestre, QUADRIMESTRES, quadrimestreLibelle, resultatsQuadrimestres, type Quadrimestre, type ResultatQuadrimestre, type SaisieQuadrimestre } from '../moteur/quadrimestre'
import { moisDuReel } from '../moteur/suivi'

type Champ = keyof SaisieQuadrimestre
type Textes = Record<Quadrimestre, Record<Champ, string>>
const CHAMPS: Champ[] = ['achats', 'variationStock', 'chargesExternes', 'impotsTaxes', 'personnel', 'tresorerie']
const LIBELLES: Record<Champ, string> = {
  achats: 'Achats de marchandises HT',
  variationStock: 'Variation de stock (fin − début)',
  chargesExternes: 'Charges externes (redevance et publicité comprises)',
  impotsTaxes: 'Impôts et taxes',
  personnel: 'Frais de personnel',
  tresorerie: 'Trésorerie en fin de période',
}
const COURT: Record<Quadrimestre, string> = { 1: 'Janv. à avr.', 2: 'Mai à août', 3: 'Sept. à déc.' }
const vers = (saisies: Partial<Record<Quadrimestre, SaisieQuadrimestre>>): Textes =>
  Object.fromEntries(QUADRIMESTRES.map((q) => [q, Object.fromEntries(CHAMPS.map((c) => [c, saisies[q]?.[c] == null ? '' : enChiffres(saisies[q]![c]!)]))])) as Textes

// Résultat réel tous les 4 mois : quelques montants comptables saisis, le reste calculé (CA de la caisse, marge, EBE)
export function QuadrimestresMagasin({ magasin, annee, peutSaisir }: { magasin: string; annee: number; peutSaisir: boolean }) {
  const { donnees, erreur, chargement, recharger } = useChargement(
    () => Promise.all([chargerBudgets(annee), chargerParametres(annee), chargerReel(magasin, annee), chargerQuadrimestres(annee), chargerReel(magasin, annee - 1), chargerSecours(magasin, annee),
      chargerQuadrimestres(annee - 1).catch(() => ({}) as Awaited<ReturnType<typeof chargerQuadrimestres>>)])
      .then(([d, p, reel, q, reelN1, secours, qN1]) => ({ d, parametres: p.parametres, reel, saisies: q[magasin] ?? {}, reelN1, secours, saisiesN1: qN1[magasin] ?? {} })),
    [magasin, annee])
  const [textes, setTextes] = useState<Textes>(vers({}))
  const [message, setMessage] = useState<{ gravite: 'success' | 'error' | 'warning'; texte: string } | null>(null)
  const [fec, setFec] = useState<FichierFEC | null>(null)
  const entreeFEC = useRef<HTMLInputElement>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => { if (donnees) setTextes(vers(donnees.saisies)) }, [donnees])

  // Saisies lues depuis les champs : un quadrimestre sans aucun montant n'existe pas
  const lues: Partial<Record<Quadrimestre, SaisieQuadrimestre>> = {}
  let lisible = true
  for (const q of QUADRIMESTRES) {
    const s = Object.fromEntries(CHAMPS.map((c) => { const n = nombre(textes[q][c]); if (Number.isNaN(n)) lisible = false; return [c, Number.isNaN(n) ? null : n] })) as unknown as SaisieQuadrimestre
    if (CHAMPS.some((c) => s[c] !== null) || donnees?.saisies[q]) lues[q] = s
  }
  const negatif = QUADRIMESTRES.some((q) => (['achats', 'chargesExternes', 'impotsTaxes', 'personnel'] as Champ[]).some((c) => (lues[q]?.[c] ?? 0) < 0))
  const modifie = !!donnees && JSON.stringify(vers(lues)) !== JSON.stringify(vers(donnees.saisies))
  useSaisieEnCours(modifie)

  if (chargement && !donnees) return <Skeleton variant="rounded" height={320} />
  if (erreur || !donnees) return <Panne quoi={`Les quadrimestres ${annee}`} recharger={recharger} />

  const ligne = donnees.d.magasins.find((l) => l.magasin === magasin)
  const h = ligne?.statut ? hypothesesDe(ligne, donnees.d) : null
  const budget = h ? calculerBudget(h.hypotheses, donnees.parametres) : null
  const moisCaisse = moisDuReel(donnees.reel.lignes, donnees.reel.tickets)
  const { parQuadrimestre, cumul, dernier, moisCumul } = resultatsQuadrimestres(moisCaisse, lues, budget)
  // Cumul face au budget et à la même période de l'an passé
  const comparaison = cumul ? comparaisonPeriode(cumul, memePeriode(moisCumul, moisDuReel(donnees.reelN1.lignes, donnees.reelN1.tickets), donnees.saisiesN1)) : null
  const caCaisse = Object.fromEntries(QUADRIMESTRES.map((q) => [q, moisDuQuadrimestre(q).reduce((a, m) => a + (moisCaisse[m]?.caHT ?? 0), 0)])) as Record<Quadrimestre, number>
  const colonnes: (ResultatQuadrimestre | null)[] = [...parQuadrimestre, cumul]
  // Barre d'enregistrement (lot 28) : EBE et trésorerie du cumul enregistré, puis avec la saisie
  const avant = resultatsQuadrimestres(moisCaisse, donnees.saisies, budget)
  const finDe = (q: Quadrimestre | null) => (q ? quadrimestreLibelle[q].split(' à ')[1] : '')
  const effets = [
    ...(avant.cumul?.ebe != null || cumul?.ebe != null ? [{
      libelle: `EBE réel à fin ${finDe(dernier)}`, avant: avant.cumul?.ebe == null ? '–' : milliers(avant.cumul.ebe), apres: cumul?.ebe == null ? '–' : milliers(cumul.ebe),
    }] : []),
    ...(avant.cumul?.tresorerie != null || cumul?.tresorerie != null ? [{
      libelle: 'Trésorerie', avant: avant.cumul?.tresorerie == null ? '–' : milliers(avant.cumul.tresorerie), apres: cumul?.tresorerie == null ? '–' : milliers(cumul.tresorerie),
    }] : []),
  ]
  // Trésorerie glissante : dernière trésorerie saisie, puis les flux de l'atterrissage jusqu'à décembre
  const qTreso = [...QUADRIMESTRES].reverse().find((q) => lues[q]?.tresorerie != null)
  const atterri = qTreso && qTreso < 3 ? atterrissageDe({ n: donnees.reel, n1: donnees.reelN1 }, annee, donnees.d.equipes[magasin], donnees.d.frais[magasin], donnees.parametres, donnees.secours) : null
  const glissante = atterri && qTreso
    ? tresorerieGlissante(tresorerieBudget(atterri.budget, atterri.hypotheses, donnees.parametres, donnees.parametres.tresorerie), { montant: lues[qTreso]!.tresorerie!, mois: qTreso * 4 - 1 })
    : null

  const lireFichierFEC = async (f: File) => {
    setMessage(null)
    try {
      const l = lireFEC(texteDuFEC(await f.arrayBuffer()))
      setFec({ nom: f.name, ecritures: l.ecritures, erreurs: l.erreurs })
    } catch {
      setFec({ nom: f.name, ecritures: [], erreurs: ['Ce fichier n’a pas les colonnes d’un FEC (CompteNum, EcritureDate, Debit et Credit). Demande au cabinet l’export FEC du magasin.'] })
    }
  }
  const reprendreFEC = (q: Quadrimestre, m: SaisieQuadrimestre, avertissement: string | null) => {
    setTextes((t) => ({ ...t, [q]: Object.fromEntries(CHAMPS.map((c) => [c, m[c] === null ? t[q][c] : enChiffres(m[c]!)])) as Record<Champ, string> }))
    setFec(null)
    setMessage(avertissement
      ? { gravite: 'warning', texte: `Montants du FEC repris : ${quadrimestreLibelle[q].toLowerCase()}. ${avertissement}` }
      : { gravite: 'success', texte: `Montants du FEC repris : ${quadrimestreLibelle[q].toLowerCase()}.` })
  }

  const enregistrer = async () => {
    setOccupe(true)
    setMessage(null)
    try {
      await enregistrerQuadrimestres(magasin, annee, lues)
      setMessage({ gravite: 'success', texte: 'Quadrimestres enregistrés.' })
      recharger()
    } catch {
      setMessage({ gravite: 'error', texte: 'L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.' })
    } finally {
      setOccupe(false)
    }
  }

  const vide = <TableCell align="right" sx={{ color: 'text.disabled' }}>–</TableCell>
  const calcul = (libelle: string, f: (r: ResultatQuadrimestre) => number | null, texte: (v: number) => string, o: { fort?: boolean; rouge?: boolean } = {}) => (
    <TableRow sx={o.fort ? { bgcolor: 'background.default', '& td': { bgcolor: 'background.default', fontWeight: 700 } } : undefined}>
      <TableCell>{libelle}</TableCell>
      {colonnes.map((r, i) => {
        const v = r ? f(r) : null
        return v === null ? <TableCell key={i} align="right" sx={{ color: 'text.disabled' }}>–</TableCell>
          : <TableCell key={i} align="right" sx={o.rouge && v < 0 ? { color: 'error.main' } : undefined}>{texte(v)}</TableCell>
      })}
    </TableRow>
  )
  const saisie = (c: Champ) => (
    <TableRow key={c}>
      <TableCell>{LIBELLES[c]}</TableCell>
      {QUADRIMESTRES.map((q) => (
        <TableCell key={q} align="right" sx={{ py: 0.5 }}>
          <ChampNombre libelle={`${LIBELLES[c]} : ${quadrimestreLibelle[q].toLowerCase()}`} valeur={textes[q][c]} desactive={!peutSaisir} largeur={150}
            onChange={(v) => setTextes((t) => ({ ...t, [q]: { ...t[q], [c]: v } }))} />
        </TableCell>
      ))}
      {c === 'tresorerie' ? (cumul?.tresorerie == null ? vide : <TableCell align="right">{enChiffres(Math.round(cumul.tresorerie))}</TableCell>)
        : (() => { const v = cumul ? QUADRIMESTRES.filter((q) => dernier && q <= dernier).map((q) => lues[q]?.[c]) : []
          return v.length && v.every((x) => x != null) ? <TableCell align="right">{enChiffres(Math.round(v.reduce((a, b) => a! + b!, 0)!))}</TableCell> : vide })()}
    </TableRow>
  )
  const euros = (v: number) => enChiffres(Math.round(v) || 0)
  const fin = dernier ? quadrimestreLibelle[dernier].split(' à ')[1] : ''

  return (
    <Stack spacing={3}>
      {cumul?.ebe != null && (
        <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap' }} component="section" aria-label={`Résultat réel à fin ${fin}`}>
          <Indicateur
            libelle={`EBE réel à fin ${fin}`} valeur={milliers(cumul.ebe)}
            ecart={cumul.ecartEBE === null ? undefined : { texte: `${ecartMontant(cumul.ecartEBE)} sur le budget`, hausse: cumul.ecartEBE >= 0, favorable: cumul.ecartEBE >= 0 }}
            detail={cumul.ebeSurCA === null ? undefined : `${taux(cumul.ebeSurCA)} du CA`}
          />
          <Indicateur
            libelle="Taux de marge réel" valeur={cumul.tauxMarge === null ? '–' : taux(cumul.tauxMarge)}
            detail={cumul.ecartMargeCaisse === null ? undefined : `${ecartPts(cumul.ecartMargeCaisse)} face à la marge de la caisse`}
          />
          <Indicateur libelle="Masse salariale / marge" valeur={cumul.personnelSurMarge === null ? '–' : taux(cumul.personnelSurMarge)} />
        </Stack>
      )}

      <Card component="section" aria-label={`Quadrimestres ${annee}`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Quadrimestres {annee}</Typography>
          {peutSaisir && (
            <>
              <Button variant="outlined" startIcon={<UploadFileOutlined />} disabled={occupe} onClick={() => entreeFEC.current?.click()} sx={{ minHeight: 48 }}>
                Importer le FEC
              </Button>
              <input ref={entreeFEC} type="file" accept=".txt,.csv,.fec,text/plain" hidden aria-label="FEC du comptable"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void lireFichierFEC(f) }} />
            </>
          )}
        </Box>
        {message && <Box sx={{ px: 2.5, pb: 1 }}><Alert severity={message.gravite} onClose={() => setMessage(null)} closeText="Fermer" slotProps={{ closeButton: { sx: { width: 48, height: 48 } } }}>{message.texte}</Alert></Box>}
        {fec && (
          <ImportFEC key={fec.nom} magasin={magasin} annee={annee} fichier={fec} caCaisse={caCaisse} libelles={LIBELLES} peutGarder={peutSaisir}
            reprendre={reprendreFEC} fermer={() => setFec(null)} />
        )}
        {negatif && <Box sx={{ px: 2.5, pb: 1 }}><Alert severity="warning">Les achats et les charges se saisissent en positif.</Alert></Box>}
        <TableContainer>
          <Table size="small" className="colonne-fixe" aria-label={`Résultat réel ${annee} par quadrimestre`} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 240 } }}>
            <TableHead>
              <TableRow>
                <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros HT</Box></TableCell>
                {QUADRIMESTRES.map((q) => <TableCell key={q} align="right">{COURT[q]}</TableCell>)}
                <TableCell align="right">{dernier ? `Cumul à fin ${fin}` : 'Cumul'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calcul('CA HT de la caisse', (r) => r.ca, euros, { fort: true })}
              {saisie('achats')}
              {saisie('variationStock')}
              {calcul('Marge réelle', (r) => r.marge, euros, { fort: true })}
              {calcul('Taux de marge réel', (r) => r.tauxMarge, taux)}
              {calcul('Taux de marge théorique de la caisse', (r) => r.tauxMargeCaisse, taux)}
              {calcul('Écart à la marge de la caisse (démarque)', (r) => r.ecartMargeCaisse, ecartPts, { rouge: true })}
              {calcul('Taux de marge du budget', (r) => r.tauxMargeBudget, taux)}
              {saisie('chargesExternes')}
              {saisie('impotsTaxes')}
              {saisie('personnel')}
              {calcul('EBE réel', (r) => r.ebe, euros, { fort: true, rouge: true })}
              {calcul('EBE / CA', (r) => r.ebeSurCA, taux)}
              {calcul('EBE du budget', (r) => r.budget?.ebe ?? null, euros)}
              {calcul('Écart d’EBE au budget', (r) => r.ecartEBE, ecartMontant, { rouge: true })}
              {saisie('tresorerie')}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {comparaison && (
        <Card component="section" aria-label={`Cumul à fin ${fin} face au budget et à ${annee - 1}`}>
          <Typography variant="h2" sx={{ px: 2.5, pt: 2, pb: 1 }}>Cumul à fin {fin} : budget et {annee - 1}</Typography>
          <TableContainer>
            <Table size="small" className="colonne-fixe" aria-label={`Cumul ${annee} face au budget et à ${annee - 1}`} sx={{ '& td, & th': { px: 1.25, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5, minWidth: 200 } }}>
              <TableHead>
                <TableRow>
                  <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros HT</Box></TableCell>
                  <TableCell align="right">Réel {annee}</TableCell>
                  <TableCell align="right">Budget</TableCell>
                  <TableCell align="right">Écart au budget</TableCell>
                  <TableCell align="right">{annee - 1}, même période</TableCell>
                  <TableCell align="right">Évolution</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparaison.map((l) => {
                  const fort = l.cle === 'ca' || l.cle === 'marge' || l.cle === 'ebe'
                  const favorable = (v: number) => (l.charge ? v <= 0 : v >= 0)
                  const tiret = <Box component="span" sx={{ color: 'text.disabled' }}>–</Box>
                  return (
                    <TableRow key={l.cle} sx={fort ? { bgcolor: 'background.default', '& td': { bgcolor: 'background.default', fontWeight: 700 } } : undefined}>
                      <TableCell>{l.libelle}</TableCell>
                      <TableCell align="right">{l.reel === null ? tiret : montant(l.reel)}</TableCell>
                      <TableCell align="right">{l.budget === null ? tiret : montant(l.budget)}</TableCell>
                      <TableCell align="right" sx={l.ecartBudget === null ? undefined : { color: favorable(l.ecartBudget) ? 'success.dark' : 'error.main' }}>{l.ecartBudget === null ? tiret : ecartMontant(l.ecartBudget)}</TableCell>
                      <TableCell align="right">{l.n1 === null ? tiret : montant(l.n1)}</TableCell>
                      <TableCell align="right" sx={l.evolution === null ? undefined : { color: favorable(l.evolution) ? 'success.dark' : 'error.main' }}>{l.evolution === null ? tiret : ecartTaux(l.evolution)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {glissante && (
        <Card component="section" aria-label="Trésorerie prévue jusqu’à décembre">
          <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <Typography variant="h2">Trésorerie prévue jusqu’à décembre</Typography>
          </Box>
          <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', px: 2.5, pb: 1.5 }}>
            <Indicateur libelle={`Trésorerie fin ${MOIS_LONGS[glissante.depart.mois]}`} valeur={milliers(glissante.depart.montant)} detail="Saisie au quadrimestre" />
            <Indicateur libelle="Point bas prévu" valeur={milliers(glissante.pointBas.montant)}
              detail={`${MOIS_LONGS[glissante.pointBas.mois].charAt(0).toUpperCase()}${MOIS_LONGS[glissante.pointBas.mois].slice(1)}${glissante.moisNegatifs ? `, ${glissante.moisNegatifs} mois à découvert` : ''}`} />
            <Indicateur libelle="Trésorerie fin décembre prévue" valeur={milliers(glissante.fin)} detail="Selon l’atterrissage de l’année" />
          </Stack>
          <TableContainer>
            <Table size="small" aria-label={`Trésorerie prévue ${annee} mois par mois`} sx={{ '& td, & th': { whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
              <TableHead>
                <TableRow>
                  <TableCell><Box component="span" sx={{ fontWeight: 400 }}>En euros</Box></TableCell>
                  {glissante.mois.map((m) => <TableCell key={m.mois} align="right">{MOIS[m.mois]}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Variation du mois</TableCell>
                  {glissante.mois.map((m) => <TableCell key={m.mois} align="right">{ecartMontant(m.flux)}</TableCell>)}
                </TableRow>
                <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: 'background.default' } }}>
                  <TableCell>Trésorerie en fin de mois</TableCell>
                  {glissante.mois.map((m) => <TableCell key={m.mois} align="right" sx={m.fin < 0 ? { color: 'error.main' } : undefined}>{enChiffres(Math.round(m.fin))}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
      {peutSaisir && modifie && (
        <BarreEnregistrement
          changements={nombreChangements(vers(donnees.saisies), textes)} occupe={occupe} desactive={!lisible || negatif}
          libelle="Enregistrer les quadrimestres" effets={effets}
          avertissement={!lisible ? 'Un montant est illisible.' : undefined}
          onAnnuler={() => { setTextes(vers(donnees.saisies)); setMessage(null) }} onEnregistrer={() => void enregistrer()}
        />
      )}
    </Stack>
  )
}
