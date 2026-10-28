import { useEffect, useState } from 'react'
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
import { nombre } from '../import/caisse'
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined'
import { enChiffres, enMilliers, milliers, montant, MOIS, MOIS_LONGS, QUADRIMESTRES_COURTS } from '../lib/format'
import { COLONNES, regrouper } from '../moteur/periodes'
import type { MoisTresorerie, Tresorerie } from '../moteur/tresorerie'
import { ChoixPeriode, usePeriode } from './ChoixPeriode'
import { GraphiqueTresorerie } from './GraphiqueTresorerie'
import { ChampNombre } from './ChampNombre'
import { Indicateur } from './Indicateur'
import { Aide } from './Aide'

// Trésorerie du budget mois par mois : encaissements, décaissements (montants TTC, délais de paiement compris), solde
// « facultative » : ligne masquée quand elle est nulle toute l'année
export const LIGNES_TRESORERIE: { cle: keyof MoisTresorerie; libelle: string; sortie?: boolean; fort?: boolean; facultative?: boolean }[] = [
  { cle: 'encaissements', libelle: 'Encaissements des ventes TTC', fort: true },
  { cle: 'consignesRemboursees', libelle: 'Consignes remboursées par les fournisseurs', facultative: true },
  { cle: 'fournisseurs', libelle: 'Fournisseurs de marchandises', sortie: true },
  { cle: 'frais', libelle: 'Frais, redevance et publicité', sortie: true },
  { cle: 'personnel', libelle: 'Salaires et cotisations', sortie: true },
  { cle: 'tva', libelle: 'TVA reversée', sortie: true },
  { cle: 'emprunts', libelle: 'Emprunts (intérêts et capital)', sortie: true },
  { cle: 'impot', libelle: 'Impôt sur les sociétés', sortie: true, facultative: true },
  { cle: 'travaux', libelle: 'Travaux', sortie: true, facultative: true },
  { cle: 'consignesVersees', libelle: 'Consignes versées aux fournisseurs', sortie: true, facultative: true },
  { cle: 'decaissements', libelle: 'Total des décaissements', sortie: true, fort: true },
  { cle: 'flux', libelle: 'Variation du mois', fort: true },
]

// Lot 27 : le solde de fin de mois en barres au-dessus du tableau ; tableau par mois, quadrimestre ou année, en € ou k€,
// replié d'office pour le franchisé (« replie »)
export function TresorerieBudget({ tresorerie: t, annee, depart, onDepart, lectureSeule, replie = false }: {
  tresorerie: Tresorerie
  annee: number
  depart: number | undefined
  onDepart: (v: number | undefined) => void
  lectureSeule: boolean
  replie?: boolean
}) {
  const [detail, setDetail] = useState(!replie)
  const choix = usePeriode('tresorerie')
  const { periode, unite } = choix
  const colonnes = COLONNES[periode]
  const affiche = (v: number) => (unite === 'milliers' ? enMilliers(v) : enChiffres(Math.round(v) || 0))
  const enTete = (c: number[]) => (periode === 'mois' ? MOIS[c[0]] : QUADRIMESTRES_COURTS[c[0] / 4])
  const [saisie, setSaisie] = useState(depart === undefined ? '' : enChiffres(depart))
  // Départ changé ailleurs (ajustements chargés après l'ouverture de l'onglet, retour aux valeurs enregistrées) : le champ suit
  useEffect(() => { setSaisie((s) => { const n = nombre(s); return (n === null ? undefined : n) === depart ? s : depart === undefined ? '' : enChiffres(depart) }) }, [depart])
  const changer = (v: string) => {
    setSaisie(v)
    const n = nombre(v)
    if (n === null) onDepart(undefined)
    else if (!Number.isNaN(n)) onDepart(n)
  }
  const somme = (cle: keyof MoisTresorerie) => t.mois.reduce((a, m) => a + m[cle], 0)
  const rouge = (v: number) => (Math.round(v) < 0 ? { color: 'error.main' } : {})
  const lignes = LIGNES_TRESORERIE.filter((l) => !l.facultative || t.mois.some((m) => Math.round(m[l.cle]) !== 0))
  const plusHaut = t.mois.reduce((m, x, i) => (x.consignesEnAttente > t.mois[m].consignesEnAttente ? i : m), 0)

  return (
    <Card component="section" aria-label={`Trésorerie ${annee}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="h2">Trésorerie {annee}</Typography><Aide sujet="tresorerie" /></Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary">Au 1er janvier</Typography>
          <ChampNombre libelle="Trésorerie au 1er janvier" valeur={saisie} onChange={changer} desactive={lectureSeule} largeur={160} />
        </Box>
      </Box>
      <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', px: 2.5, py: 1.5 }} aria-label="Trésorerie en bref">
        <Indicateur libelle="Fin décembre" valeur={milliers(t.fin)} detail={`${t.fin >= t.debut ? '+' : ''}${milliers(t.fin - t.debut)} sur l’année`} />
        <Indicateur libelle="Point bas" valeur={milliers(t.pointBas.montant)} detail={`Fin ${MOIS_LONGS[t.pointBas.mois]}`} />
        <Indicateur
          libelle="Mois à découvert" valeur={t.moisNegatifs === 0 ? 'Aucun' : `${t.moisNegatifs} mois`}
          detail={t.moisNegatifs === 0 ? 'Trésorerie positive toute l’année' : `Besoin de financement : ${montant(-t.pointBas.montant)}`}
        />
        {t.consignesMoyennes > 0 && (
          <Indicateur
            libelle="Consignes avancées aux fournisseurs" valeur={milliers(t.consignesMoyennes)}
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
        <Table size="small" className="colonne-fixe" aria-label={`Trésorerie ${annee} mois par mois`} sx={{ '& td, & th': { py: 0.75, px: 1, fontSize: '0.8125rem', whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
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
              const fond = l.fort ? { bgcolor: 'background.default' } : undefined
              return (
                <TableRow key={l.cle} sx={fond}>
                  <TableCell sx={{ fontWeight: l.fort ? 700 : 400, ...fond }}>{l.libelle}</TableCell>
                  {regrouper(t.mois.map((m) => m[l.cle]), periode).map((v, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: l.fort ? 700 : 400, ...(l.cle === 'flux' ? rouge(v) : {}) }}>
                      {affiche(signe * v)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, ...(l.cle === 'flux' ? rouge(somme('flux')) : {}) }}>{affiche(signe * somme(l.cle))}</TableCell>
                </TableRow>
              )
            })}
            <TableRow sx={{ bgcolor: 'background.default' }}>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Trésorerie en fin de mois</TableCell>
              {regrouper(t.mois.map((m) => m.fin), periode, 'dernier').map((v, i) => <TableCell key={i} align="right" sx={{ fontWeight: 700, ...rouge(v) }}>{affiche(v)}</TableCell>)}
              <TableCell align="right" sx={{ fontWeight: 700, ...rouge(t.fin) }}>{affiche(t.fin)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>}
    </Card>
  )
}
