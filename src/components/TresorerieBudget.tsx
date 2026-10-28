import { useState } from 'react'
import Box from '@mui/material/Box'
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
import { enChiffres, milliers, montant, MOIS, MOIS_LONGS } from '../lib/format'
import type { MoisTresorerie, Tresorerie } from '../moteur/tresorerie'
import { ChampNombre } from './ChampNombre'
import { Indicateur } from './Indicateur'

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

export function TresorerieBudget({ tresorerie: t, annee, depart, onDepart, lectureSeule }: {
  tresorerie: Tresorerie
  annee: number
  depart: number | undefined
  onDepart: (v: number | undefined) => void
  lectureSeule: boolean
}) {
  const [saisie, setSaisie] = useState(depart === undefined ? '' : enChiffres(depart))
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
        <Typography variant="h2" sx={{ flex: 1 }}>Trésorerie {annee}</Typography>
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
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label={`Trésorerie ${annee} mois par mois`} sx={{ '& td, & th': { py: 0.75, px: 1, fontSize: '0.8125rem', whiteSpace: 'nowrap' }, '& td:first-of-type, & th:first-of-type': { pl: 2.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}><Box component="span" sx={{ fontWeight: 400 }}>En euros TTC</Box></TableCell>
              {MOIS.map((m) => <TableCell key={m} align="right">{m}</TableCell>)}
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
                  {t.mois.map((m, i) => (
                    <TableCell key={i} align="right" sx={{ fontWeight: l.fort ? 700 : 400, ...(l.cle === 'flux' ? rouge(m.flux) : {}) }}>
                      {enChiffres(Math.round(signe * m[l.cle]) || 0)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, ...(l.cle === 'flux' ? rouge(somme('flux')) : {}) }}>{enChiffres(Math.round(signe * somme(l.cle)) || 0)}</TableCell>
                </TableRow>
              )
            })}
            <TableRow sx={{ bgcolor: 'background.default' }}>
              <TableCell sx={{ fontWeight: 700, bgcolor: 'background.default' }}>Trésorerie en fin de mois</TableCell>
              {t.mois.map((m, i) => <TableCell key={i} align="right" sx={{ fontWeight: 700, ...rouge(m.fin) }}>{enChiffres(Math.round(m.fin) || 0)}</TableCell>)}
              <TableCell align="right" sx={{ fontWeight: 700, ...rouge(t.fin) }}>{enChiffres(Math.round(t.fin) || 0)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}
