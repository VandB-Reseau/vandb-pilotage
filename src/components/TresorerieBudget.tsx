import type { DepartEstime } from '../moteur/reprise'
import { useState } from 'react'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { enChiffres, enMilliers, milliers, MOIS, MOIS_LONGS, QUADRIMESTRES_COURTS } from '../lib/format'
import { COLONNES, regrouper } from '../moteur/periodes'
import type { MoisTresorerie, Tresorerie } from '../moteur/tresorerie'
import { ChoixPeriode, usePeriode } from './ChoixPeriode'
import { GraphiqueTresorerie } from './GraphiqueTresorerie'
import { texteEstimee } from './TresorerieDepart'
import { Indicateur } from './Indicateur'
import { Aide } from './Aide'
import { styleTableau } from '../theme/tableau'
import type { SujetAide } from '../lib/aide'

// Trésorerie du budget mois par mois : encaissements, décaissements (montants TTC, délais de paiement compris), solde
// « facultative » : ligne masquée quand elle est nulle toute l'année
export const LIGNES_TRESORERIE: { cle: keyof MoisTresorerie; libelle: string; sortie?: boolean; fort?: boolean; facultative?: boolean; aide?: SujetAide }[] = [
  { cle: 'encaissements', libelle: 'Encaissements des ventes TTC', fort: true, aide: 'encaissements' },
  { cle: 'consignesRemboursees', libelle: 'Consignes remboursées par les fournisseurs', facultative: true, aide: 'consignesTreso' },
  { cle: 'financements', libelle: 'Nouveaux emprunts et apport', facultative: true, aide: 'emprunts' },
  { cle: 'fournisseurs', libelle: 'Fournisseurs de marchandises', sortie: true, aide: 'fournisseurs' },
  { cle: 'frais', libelle: 'Frais, redevance et publicité', sortie: true, aide: 'fraisTreso' },
  { cle: 'personnel', libelle: 'Salaires et cotisations', sortie: true, aide: 'salairesTreso' },
  { cle: 'tva', libelle: 'TVA reversée', sortie: true, aide: 'tvaTreso' },
  { cle: 'emprunts', libelle: 'Emprunts (intérêts et capital)', sortie: true, aide: 'empruntsTreso' },
  { cle: 'impot', libelle: 'Impôt sur les sociétés', sortie: true, facultative: true, aide: 'impotSocietes' },
  { cle: 'travaux', libelle: 'Investissements et travaux', sortie: true, facultative: true, aide: 'travauxTreso' },
  { cle: 'consignesVersees', libelle: 'Consignes versées aux fournisseurs', sortie: true, facultative: true, aide: 'consignesTreso' },
  { cle: 'decaissements', libelle: 'Total des décaissements', sortie: true, fort: true, aide: 'decaissements' },
  { cle: 'flux', libelle: 'Variation du mois', fort: true, aide: 'fluxMois' },
]

// Lot 27 : le solde de fin de mois en barres au-dessus du tableau ; tableau par mois, quadrimestre ou année, en € ou k€,
// replié d'office pour le franchisé (« replie »). Lot 43 : la trésorerie au 1er janvier se règle au point de départ,
// elle se lit seulement ici
export function TresorerieBudget({ tresorerie: t, annee, depart, replie = false, estimee, versDepart }: {
  tresorerie: Tresorerie
  annee: number
  depart: number | undefined
  estimee?: DepartEstime | null // lot 42 : trésorerie au 1er janvier estimée depuis les comptes, tant qu'elle n'est pas saisie
  replie?: boolean
  versDepart?: () => void
}) {
  const [detail, setDetail] = useState(!replie)
  const choix = usePeriode('tresorerie')
  const { periode, unite } = choix
  const colonnes = COLONNES[periode]
  const affiche = (v: number) => (unite === 'milliers' ? enMilliers(v) : enChiffres(Math.round(v) || 0))
  const enTete = (c: number[]) => (periode === 'mois' ? MOIS[c[0]] : QUADRIMESTRES_COURTS[c[0] / 4])
  const somme = (cle: keyof MoisTresorerie) => t.mois.reduce((a, m) => a + m[cle], 0)
  const rouge = (v: number) => (Math.round(v) < 0 ? { color: 'error.main' } : {})
  const lignes = LIGNES_TRESORERIE.filter((l) => !l.facultative || t.mois.some((m) => Math.round(m[l.cle]) !== 0))
  const plusHaut = t.mois.reduce((m, x, i) => (x.consignesEnAttente > t.mois[m].consignesEnAttente ? i : m), 0)

  return (
    <Card component="section" aria-label={`Trésorerie ${annee}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Trésorerie {annee}</Typography><Aide sujet="tresorerie" /></Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }} aria-label="Trésorerie de départ">
          <Typography variant="body2" color="text.secondary">
            {`Au 1er janvier : ${milliers(depart ?? estimee?.montant ?? 0)}${depart === undefined ? (estimee ? ', estimée' : ', pas encore connue') : ''}`}
          </Typography>
          {versDepart && <Link component="button" type="button" onClick={versDepart} sx={{ minHeight: 48, fontSize: '0.875rem' }}>Modifier au point de départ</Link>}
        </Box>
      </Box>
      {depart === undefined && estimee && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 1 }}>{texteEstimee(estimee)}</Typography>
      )}
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', px: 2.5, py: 1.5 }} aria-label="Trésorerie en bref">
        <Indicateur libelle="Fin décembre" aide="tresorerieFin" valeur={milliers(t.fin)} detail={`${t.fin >= t.debut ? '+' : ''}${milliers(t.fin - t.debut)} sur l’année`} />
        <Indicateur libelle="Point bas" aide="pointBas" valeur={milliers(t.pointBas.montant)} detail={`Fin ${MOIS_LONGS[t.pointBas.mois]}`} />
        <Indicateur
          libelle="Mois à découvert" valeur={t.moisNegatifs === 0 ? 'Aucun' : `${t.moisNegatifs} mois`}
          detail={t.moisNegatifs === 0 ? 'Trésorerie positive toute l’année' : `Besoin de financement : ${milliers(-t.pointBas.montant)}`}
        />
        <Indicateur
          libelle="Besoin en fonds de roulement" aide="bfr" valeur={milliers(t.bfr.total)}
          detail={`Fin décembre, ${enChiffres(Math.round(t.bfr.joursCA))} jours de CA. Stock ${milliers(t.bfr.stock)}${t.bfr.consignes ? ` et consignes ${milliers(t.bfr.consignes)}` : ''}, moins ${milliers(t.bfr.fournisseurs + t.bfr.tva + t.bfr.cotisations + t.bfr.redevance)} encore dus`}
        />
        {t.consignesMoyennes > 0 && (
          <Indicateur
            libelle="Consignes avancées aux fournisseurs" aide="consignesAvancees" valeur={milliers(t.consignesMoyennes)}
            detail={`Moyenne sur l’année ; au plus haut fin ${MOIS_LONGS[plusHaut]} : ${milliers(t.mois[plusHaut].consignesEnAttente)}`}
          />
        )}
      </Stack>
      <Box sx={{ px: 2.5, pb: 1 }}><GraphiqueTresorerie tresorerie={t} annee={annee} /></Box>
      <Box className="pas-a-l-impression" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pb: 1 }}>
        <Button onClick={() => setDetail((v) => !v)} aria-expanded={detail} endIcon={<ExpandMoreOutlined sx={{ transform: detail ? 'rotate(180deg)' : 'none' }} />} sx={{ minHeight: 48 }}>
          {detail ? 'Masquer le détail' : 'Voir le détail mois par mois'}
        </Button>
        <Box sx={{ flex: 1 }} />
        {detail && <ChoixPeriode quoi={`Trésorerie ${annee}`} {...choix} />}
      </Box>
      {detail && <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label={`Trésorerie ${annee} mois par mois`} sx={styleTableau}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}><Box component="span" sx={{ fontWeight: 400 }}>{unite === 'milliers' ? 'En k€ TTC' : 'En euros TTC'}</Box></TableCell>
              {colonnes.map((c) => <TableCell key={c[0]} align="right">{enTete(c)}</TableCell>)}
              <TableCell align="right">Année</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lignes.map((l) => {
              const signe = l.sortie ? -1 : 1
              return (
                <TableRow key={l.cle} className={l.fort ? 'ligne-forte' : undefined}>
                  <TableCell sx={{ fontWeight: l.fort ? 700 : 400 }}>{l.libelle}{l.aide && <Aide sujet={l.aide} compact />}</TableCell>
                  {regrouper(t.mois.map((m) => m[l.cle]), periode).map((v, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: l.fort ? 700 : 400, ...(l.cle === 'flux' ? rouge(v) : {}) }}>
                      {affiche(signe * v)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, ...(l.cle === 'flux' ? rouge(somme('flux')) : {}) }}>{affiche(signe * somme(l.cle))}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="ligne-forte">
              <TableCell sx={{ fontWeight: 700 }}>Trésorerie en fin de mois<Aide sujet="tresorerieFinMois" compact /></TableCell>
              {regrouper(t.mois.map((m) => m.fin), periode, 'dernier').map((v, i) => <TableCell key={i} align="right" sx={{ fontWeight: 700, ...rouge(v) }}>{affiche(v)}</TableCell>)}
              <TableCell align="right" sx={{ fontWeight: 700, ...rouge(t.fin) }}>{affiche(t.fin)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>}
    </Card>
  )
}
