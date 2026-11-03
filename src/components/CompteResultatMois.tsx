import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined'
import { enChiffres, enMilliers, montant, MOIS, QUADRIMESTRES_COURTS, taux } from '../lib/format'
import type { LigneCompte } from '../moteur/compteResultat'
import { COLONNES, regrouperCompte } from '../moteur/periodes'
import type { SujetAide } from '../lib/aide'
import { Aide } from './Aide'
import { ChoixPeriode, usePeriode } from './ChoixPeriode'
import { classeLigne, styleTableau } from '../theme/tableau'

// Lot 32 : picto (i) sur chaque ligne calculée. Joseph (03/11/2026) : aussi sur les totaux et sous-totaux ; seules les
// lignes de frais saisies une à une n'en ont pas (elles viennent telles quelles de l'écran Frais)
const AIDE_LIGNE: Record<string, SujetAide> = {
  ca: 'chiffreAffaires', achats: 'achatsConsommes', marge: 'margeCommerciale', externes: 'chargesExternes', 'externes/theme/reseau': 'redevancesReseau',
  'externes/publicite': 'publiciteRedevance', 'externes/redevance': 'publiciteRedevance', impots: 'impotsTaxes', autres: 'autresCharges',
  'externes/consignes': 'demarqueConsignes', 'externes/evenements': 'chargesEvenements', capital: 'capitalRembourse', reintegres: 'amortissementsReintegres', personnel: 'fraisPersonnel', ebe: 'ebe', amortissements: 'amortissements',
  exploitation: 'resultatExploitation', interets: 'interets', avant_impot: 'resultatAvantImpot', impot: 'impotSocietes', net: 'resultatNet', tresorerie: 'tresorerieDegagee',
  productivite: 'productivite', heures: 'heures',
}
export function aideLigneCompte(cle: string): SujetAide | null {
  if (AIDE_LIGNE[cle]) return AIDE_LIGNE[cle]
  if (cle.startsWith('ca/')) return 'caUnivers'
  if (cle.startsWith('externes/theme/')) return 'themeFrais'
  return null
}

// Compte de résultat sur 12 mois : rubriques repliées, dépliables d'un clic ; titres et libellés figés au défilement.
// « projeteA » : à partir de ce mois (0 = janvier), les colonnes sont des projections, en gris.
// Lot 27 : par mois, par quadrimestre ou sur l'année seule, en euros ou en k€ (choix gardé dans le navigateur).
export function CompteResultatMois({ lignes, titre, libelleTableau, projeteA, entete, moisEnCours }: {
  lignes: LigneCompte[]
  titre: string
  libelleTableau: string
  projeteA?: number
  entete?: React.ReactNode
  moisEnCours?: number | null       // refonte T1 : colonne du mois en cours surlignée (vue par mois)
}) {
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set())
  const choix = usePeriode('compte')
  const { periode, unite } = choix
  const colonnes = COLONNES[periode]
  const enTete = (c: number[]) => (periode === 'mois' ? MOIS[c[0]] : QUADRIMESTRES_COURTS[c[0] / 4])
  const affiche = (v: number) => (unite === 'milliers' ? enMilliers(v) : enChiffres(Math.round(v) || 0))
  const parents = new Set(lignes.filter((l) => l.parent).map((l) => l.parent!))
  const ca = lignes.find((l) => l.cle === 'ca')?.total ?? 0
  const toutOuvert = parents.size > 0 && [...parents].every((p) => ouvertes.has(p))
  const basculer = (cle: string) => setOuvertes((o) => { const n = new Set(o); if (n.has(cle)) n.delete(cle); else n.add(cle); return n })
  // Lot 35 : deux niveaux de détail (charges externes, puis thème, puis ligne) ; une ligne se voit si tous ses parents sont ouverts
  const parentDe = new Map(lignes.map((l) => [l.cle, l.parent]))
  const profondeur = (l: { parent?: string }) => { let n = 0, p = l.parent; while (p) { n++; p = parentDe.get(p) } return n }
  const visible = (l: { parent?: string }) => { let p = l.parent; while (p) { if (!ouvertes.has(p)) return false; p = parentDe.get(p) } return true }
  // Colonne projetée : tous ses mois sont après le dernier mois réalisé
  const projete = (c: number[]) => projeteA !== undefined && c[0] >= projeteA
  const enCours = (c: number[]) => (periode === 'mois' && moisEnCours != null && c[0] === moisEnCours ? 'en-cours' : undefined)

  return (
    <Card component="section" aria-label={titre}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h2" sx={{ flex: 1 }}>{titre}</Typography>
        {entete}
        <ChoixPeriode quoi={titre} {...choix} />
        {parents.size > 0 && (
          <Button size="small" className="pas-a-l-impression" onClick={() => setOuvertes(toutOuvert ? new Set() : new Set(parents))} sx={{ minHeight: { xs: 48, md: 36 } }}>
            {toutOuvert ? 'Tout replier' : 'Tout détailler'}
          </Button>
        )}
      </Box>
      <TableContainer>
        <Table size="small" className="colonne-fixe" aria-label={libelleTableau} sx={styleTableau}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 210 }}><Box component="span" sx={{ fontWeight: 400 }}>{unite === 'milliers' ? 'En k€' : 'En euros'}</Box></TableCell>
              {colonnes.map((c) => (
                <TableCell key={c[0]} align="right" className={enCours(c)} sx={projete(c) ? { color: 'text.disabled', fontStyle: 'italic' } : undefined}
                  aria-label={projete(c) ? `${enTete(c)} (projection)` : undefined}>{enTete(c)}</TableCell>
              ))}
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">% du CA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {regrouperCompte(lignes, periode).filter(visible).map((l) => {
              const parent = parents.has(l.cle)
              const style = { fontWeight: l.fort ? 700 : 400, whiteSpace: 'nowrap' as const, ...(l.parent ? { color: 'text.secondary' } : {}) }
              return (
                <TableRow key={l.cle} className={classeLigne(l.cle, l.fort)}>
                  <TableCell sx={{ ...style, pl: l.parent ? `${20 + 20 * profondeur(l)}px !important` : undefined }}>
                    {parent ? (
                      <ButtonBase onClick={() => basculer(l.cle)} aria-expanded={ouvertes.has(l.cle)} aria-label={`${l.libelle} : ${ouvertes.has(l.cle) ? 'replier' : 'détailler'}`}
                        sx={{ font: 'inherit', gap: 0.5, ml: -0.75, px: 0.5, borderRadius: 1, minHeight: { xs: 48, md: 28 }, '&:hover': { bgcolor: 'action.hover' } }}>
                        <ChevronRightOutlined sx={{ fontSize: 18, transform: ouvertes.has(l.cle) ? 'rotate(90deg)' : 'none', color: 'text.secondary' }} />
                        {l.libelle}
                      </ButtonBase>
                    ) : l.libelle}
                    {aideLigneCompte(l.cle) && <Aide sujet={aideLigneCompte(l.cle)!} compact />}
                  </TableCell>
                  {l.mois.map((v, i) => (
                    <TableCell key={i} align="right" className={enCours(colonnes[i])} sx={{ ...style, ...(projete(colonnes[i]) ? { color: 'text.secondary' } : {}), ...(v !== null && v < 0 && l.fort ? { color: 'error.main' } : {}) }}>
                      {v === null ? '' : l.indicateur ? enChiffres(Math.round(v) || 0) : affiche(v)}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ ...style, fontWeight: 700, ...(l.total < 0 && l.fort ? { color: 'error.main' } : {}) }}>
                    {l.heures ? `${enChiffres(Math.round(l.total))} h` : unite === 'milliers' && !l.indicateur ? enMilliers(l.total) : montant(l.total)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...style, color: 'text.secondary', fontWeight: 400 }}>{l.indicateur ? '' : taux(ca ? l.total / ca : 0)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}
