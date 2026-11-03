import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddOutlined from '@mui/icons-material/AddOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { MOIS_LONGS, montant, milliers, taux } from '../lib/format'
import type { Cibles } from '../moteur/cibles'
import { dotationInvestissement, echeanceMensuelle, echeancier } from '../moteur/financement'
import type { Budget, Emprunt, Hypotheses, Investissement, TypeInvestissement } from '../moteur/types'
import { ChampMontant } from './ChampMontant'
import { ChampTaux } from './ChampTaux'
import { ChoixListe } from './ChoixListe'
import { Aide } from './Aide'
import { styleTableau } from '../theme/tableau'

const MOIS_OPTIONS = MOIS_LONGS.map((m, i) => ({ valeur: i + 1, libelle: m.charAt(0).toUpperCase() + m.slice(1) }))
export const typeInvestissementLibelle: Record<TypeInvestissement, string> = { equipement: 'Équipement', mobilier: 'Mobilier', informatique: 'Informatique', autre: 'Autre' }
const somme = (l: number[]) => l.reduce((a, b) => a + b, 0)
const sx = { ...styleTableau, '& td, & th': { px: 0.75, whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }
const champTexte = { width: 200, '& input': { height: 48, boxSizing: 'border-box', py: 0 } }

function Retirer({ nom, onClick }: { nom: string; onClick: () => void }) {
  return (
    <Tooltip title="Retirer">
      <IconButton aria-label={`Retirer ${nom}`} onClick={onClick} sx={{ width: 48, height: 48 }}><DeleteOutlined /></IconButton>
    </Tooltip>
  )
}

// Joseph (03/11/2026) : achats amortis de l'année (hors travaux, qui ont leur bloc), un par ligne
export function AchatsMagasin({ cibles, onChange, lectureSeule, annee }: { cibles: Cibles; onChange: (c: Cibles) => void; lectureSeule: boolean; annee: number }) {
  const liste = cibles.investissements ?? []
  const ecrire = (l: Investissement[]) => onChange((({ investissements: _, ...reste }) => (l.length ? { ...reste, investissements: l } : reste))(cibles))
  const changer = (i: number, x: Partial<Investissement>) => ecrire(liste.map((y, j) => (j === i ? { ...y, ...x } : y)))
  const ajouter = () => ecrire([...liste, { libelle: '', type: 'equipement', montant: 0, mois: 1, duree: 5 }])
  return (
    <Card component="section" aria-label="Achats d’équipement">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Achats d’équipement</Typography><Aide sujet="investissements" /></Box>
        {liste.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {`${milliers(somme(liste.map((x) => x.montant || 0)))} HT · Dotation ${annee} : ${milliers(somme(liste.map(dotationInvestissement)))}`}
          </Typography>
        )}
      </Box>
      {liste.length === 0 ? (
        <Typography color="text.secondary" sx={{ px: 2.5, pb: 1 }}>{`Aucun achat prévu en ${annee}.`}</Typography>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={`Achats ${annee}`} sx={sx}>
            <TableHead>
              <TableRow>
                <TableCell>Achat</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Montant HT</TableCell>
                <TableCell>Mis en service en</TableCell>
                <TableCell align="right">Amorti sur</TableCell>
                <TableCell align="right">{`Dotation ${annee}`}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {liste.map((x, i) => {
                const nom = x.libelle.trim() || `achat ${i + 1}`
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <TextField size="small" value={x.libelle} disabled={lectureSeule} placeholder="Tireuse 6 becs" onChange={(e) => changer(i, { libelle: e.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': `Nom de l’achat ${i + 1}`, maxLength: 60 } }} sx={champTexte} />
                    </TableCell>
                    <TableCell>
                      <ChoixListe libelle={`Type : ${nom}`} valeur={x.type} desactive={lectureSeule} largeur={150}
                        options={(Object.keys(typeInvestissementLibelle) as TypeInvestissement[]).map((k) => ({ valeur: k, libelle: typeInvestissementLibelle[k] }))}
                        onChange={(v) => changer(i, { type: v })} />
                    </TableCell>
                    <TableCell align="right"><ChampMontant libelle={`Montant HT : ${nom}`} valeur={x.montant} desactive={lectureSeule} onChange={(v) => changer(i, { montant: Math.max(0, v) })} /></TableCell>
                    <TableCell><ChoixListe libelle={`Mis en service en : ${nom}`} valeur={x.mois} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { mois: v })} /></TableCell>
                    <TableCell align="right"><ChampMontant libelle={`Durée d’amortissement : ${nom}`} valeur={x.duree} unite="ans" largeur={100} desactive={lectureSeule} onChange={(v) => changer(i, { duree: Math.max(0, v) })} /></TableCell>
                    <TableCell align="right">{montant(dotationInvestissement(x))}</TableCell>
                    <TableCell>{!lectureSeule && <Retirer nom={nom} onClick={() => ecrire(liste.filter((_, j) => j !== i))} />}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!lectureSeule && (
        <Box sx={{ px: 2.5, py: 1.5 }} className="pas-a-l-impression">
          <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter un achat</Button>
        </Box>
      )}
    </Card>
  )
}

// Prêts du magasin (saisis une fois, avec leur date), apport de l'année ; sans prêt saisi, les emprunts en cours repris
// des frais avec leur dernier mois. Les emprunts de l'année saisis dans le budget avant les prêts restent lus.
export function FinancementsMagasin({ cibles, onChange, lectureSeule, annee, enCours, prets, avecPrets = false }: {
  cibles: Cibles; onChange: (c: Cibles) => void; lectureSeule: boolean; annee: number
  enCours: Pick<Hypotheses, 'interets' | 'remboursementCapital'>
  prets?: ReactNode     // carte des prêts du magasin (PretsMagasin)
  avecPrets?: boolean   // des prêts sont saisis : leur échéancier remplace les emprunts en cours des frais
}) {
  const liste = cibles.emprunts ?? []
  const ecrire = <K extends 'emprunts' | 'apport' | 'finEmpruntsEnCours'>(k: K, v: Cibles[K] | undefined) => {
    const { [k]: _, ...reste } = cibles
    onChange(v === undefined || (Array.isArray(v) && !v.length) ? reste : { ...reste, [k]: v })
  }
  const changer = (i: number, x: Partial<Emprunt>) => ecrire('emprunts', liste.map((y, j) => (j === i ? { ...y, ...x } : y)))
  const ajouter = () => ecrire('emprunts', [...liste, { libelle: '', montant: 0, taux: 0.04, duree: 7, premiereEcheance: 2 }])
  const aEnCours = !avecPrets && (enCours.interets > 0 || enCours.remboursementCapital > 0)
  const tableau = !prets || liste.length > 0 || !!cibles.apport || aEnCours
  const fin = cibles.finEmpruntsEnCours ?? 12
  return (
    <Card component="section" aria-label="Financements">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Financements</Typography><Aide sujet="emprunts" /></Box>
      </Box>
      {prets}
      {tableau && <TableContainer>
        <Table size="small" aria-label={`Financements ${annee}`} sx={sx}>
          <TableHead>
            <TableRow>
              <TableCell>Financement</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell align="right">Taux</TableCell>
              <TableCell align="right">Durée</TableCell>
              <TableCell>1re échéance</TableCell>
              <TableCell align="right">Échéance</TableCell>
              <TableCell align="right">{`Intérêts ${annee}`}</TableCell>
              <TableCell align="right">{`Capital ${annee}`}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {liste.map((e, i) => {
              const nom = e.libelle.trim() || `emprunt ${i + 1}`
              const x = echeancier(e)
              return (
                <TableRow key={i}>
                  <TableCell>
                    <TextField size="small" value={e.libelle} disabled={lectureSeule} placeholder="Prêt bancaire travaux" onChange={(ev) => changer(i, { libelle: ev.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Nom de l’emprunt ${i + 1}`, maxLength: 60 } }} sx={champTexte} />
                  </TableCell>
                  <TableCell align="right"><ChampMontant libelle={`Montant emprunté : ${nom}`} valeur={e.montant} desactive={lectureSeule} onChange={(v) => changer(i, { montant: Math.max(0, v) })} /></TableCell>
                  <TableCell align="right"><ChampTaux libelle={`Taux annuel : ${nom}`} valeur={e.taux} heritee={0} desactive={lectureSeule} largeur={100} onChange={(v) => changer(i, { taux: Math.max(0, v ?? 0) })} /></TableCell>
                  <TableCell align="right"><ChampMontant libelle={`Durée : ${nom}`} valeur={e.duree} unite="ans" largeur={100} desactive={lectureSeule} onChange={(v) => changer(i, { duree: Math.max(0, v) })} /></TableCell>
                  <TableCell><ChoixListe libelle={`Première échéance : ${nom}`} valeur={e.premiereEcheance} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => changer(i, { premiereEcheance: v })} /></TableCell>
                  <TableCell align="right">{`${montant(echeanceMensuelle(e))} / mois`}</TableCell>
                  <TableCell align="right">{montant(somme(x.interets))}</TableCell>
                  <TableCell align="right">{montant(somme(x.capital))}</TableCell>
                  <TableCell>{!lectureSeule && <Retirer nom={nom} onClick={() => ecrire('emprunts', liste.filter((_, j) => j !== i))} />}</TableCell>
                </TableRow>
              )
            })}
            {cibles.apport && (
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Apport ou compte courant</TableCell>
                <TableCell align="right"><ChampMontant libelle="Montant de l’apport" valeur={cibles.apport.montant} desactive={lectureSeule} onChange={(v) => ecrire('apport', { ...cibles.apport!, montant: Math.max(0, v) })} /></TableCell>
                <TableCell colSpan={2} sx={{ color: 'text.secondary' }}>Entre en trésorerie en</TableCell>
                <TableCell><ChoixListe libelle="Mois de l’apport" valeur={cibles.apport.mois} options={MOIS_OPTIONS} desactive={lectureSeule} largeur={130} onChange={(v) => ecrire('apport', { ...cibles.apport!, mois: v })} /></TableCell>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>Sans effet sur le résultat</TableCell>
                <TableCell>{!lectureSeule && <Retirer nom="l’apport" onClick={() => ecrire('apport', undefined)} />}</TableCell>
              </TableRow>
            )}
            {aEnCours && (
              <TableRow>
                <TableCell sx={{ whiteSpace: 'normal' }}>
                  <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>Emprunts en cours</Box>
                  <Box component="span" sx={{ display: 'block', fontSize: '0.8125rem', color: 'text.secondary' }}>Repris des frais, modifiables dans le thème Frais</Box>
                </TableCell>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>Dernière échéance</TableCell>
                <TableCell>
                  <ChoixListe libelle="Dernier mois des emprunts en cours" valeur={fin} desactive={lectureSeule} largeur={130}
                    options={MOIS_OPTIONS} onChange={(v) => ecrire('finEmpruntsEnCours', v === 12 ? undefined : v)} />
                </TableCell>
                <TableCell />
                <TableCell align="right">{montant(enCours.interets * fin / 12)}</TableCell>
                <TableCell align="right">{montant(enCours.remboursementCapital * fin / 12)}</TableCell>
                <TableCell />
              </TableRow>
            )}
            {!liste.length && !cibles.apport && !aEnCours && (
              <TableRow><TableCell colSpan={9} sx={{ color: 'text.secondary' }}>{`Aucun emprunt en cours ni prévu en ${annee}.`}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>}
      {!lectureSeule && (!prets || !cibles.apport) && (
        <Box sx={{ px: 2.5, pt: prets && !tableau ? 0.5 : 1.5, pb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }} className="pas-a-l-impression">
          {!prets && <Button startIcon={<AddOutlined />} onClick={ajouter} sx={{ minHeight: 48 }}>Ajouter un emprunt</Button>}
          {!cibles.apport && <Button startIcon={<AddOutlined />} onClick={() => ecrire('apport', { montant: 0, mois: 1 })} sx={{ minHeight: 48 }}>Prévoir un apport</Button>}
        </Box>
      )}
    </Card>
  )
}

// Capacité d'autofinancement de l'année et ce qu'il reste une fois investissements et emprunts passés (moteur/financement)
export function CapaciteAutofinancement({ budget: b, annee, titre = true }: { budget: Budget; annee: number; titre?: boolean }) {
  const f = b.financement
  const lignes: { libelle: string; valeur: number; fort?: boolean; detail?: boolean }[] = [
    { libelle: 'Excédent brut d’exploitation', valeur: b.ebe },
    { libelle: f.dotationsNouvelles ? `Dotations aux amortissements (${milliers(f.dotationsEnCours)} en cours, ${milliers(f.dotationsNouvelles)} nouvelles)` : 'Dotations aux amortissements', valeur: -b.amortissements, detail: true },
    { libelle: 'Intérêts', valeur: -(f.interetsEnCours + f.interetsNouveaux), detail: true },
    { libelle: 'Impôt sur les sociétés', valeur: -b.impot, detail: true },
    { libelle: 'Résultat net', valeur: b.resultatNet },
    { libelle: 'Dotations réintégrées', valeur: b.amortissements, detail: true },
    { libelle: 'Capacité d’autofinancement', valeur: b.capaciteAutofinancement, fort: true },
    { libelle: 'Capital des emprunts remboursé', valeur: -(f.capitalEnCours + f.capitalNouveau), detail: true },
    { libelle: 'Trésorerie dégagée après emprunts', valeur: b.tresorerieDegagee },
    { libelle: 'Investissements HT', valeur: -f.investissements, detail: true },
    { libelle: 'Nouveaux emprunts et apport', valeur: f.nouveauxEmprunts + f.apport, detail: true },
    { libelle: 'Variation de trésorerie de l’année (hors stock et TVA)', valeur: f.variation, fort: true },
  ]
  const autofinance = f.investissements > 0 ? Math.max(0, f.investissements - f.nouveauxEmprunts - f.apport) / f.investissements : null
  return (
    <Card component="section" aria-label={`Capacité d’autofinancement ${annee}`}>
      {titre && (
        <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="h2">{`Capacité d’autofinancement ${annee}`}</Typography><Aide sujet="caf" />
        </Box>
      )}
      <TableContainer>
        <Table size="small" aria-label={`CAF ${annee}`} sx={styleTableau}>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.libelle} className={l.fort ? 'ligne-cle' : undefined}>
                <TableCell sx={{ whiteSpace: 'normal', fontWeight: l.fort ? 700 : 400, color: l.detail ? 'text.secondary' : 'text.primary', pl: l.detail ? 4 : undefined }}>{l.libelle}</TableCell>
                <TableCell align="right" sx={{ fontWeight: l.fort ? 700 : 400 }}>{montant(l.valeur)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', px: 2.5, py: 1.5 }}>
        <Indice libelle="Échéances ÷ CAF" valeur={f.echeancesSurCAF === null ? 'CAF négative' : taux(f.echeancesSurCAF)} detail={`${milliers(f.echeances)} d’échéances (intérêts et capital)`} />
        {autofinance !== null && <Indice libelle="Investissements autofinancés" valeur={taux(autofinance)} detail="part payée sans emprunt ni apport" />}
      </Box>
    </Card>
  )
}

function Indice({ libelle, valeur, detail }: { libelle: string; valeur: ReactNode; detail: string }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">{libelle}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums' }}>{valeur}</Typography>
      <Typography variant="body2" color="text.secondary">{detail}</Typography>
    </Box>
  )
}
