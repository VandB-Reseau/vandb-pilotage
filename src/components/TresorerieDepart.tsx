import { useEffect, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { nombre } from '../import/caisse'
import { enChiffres, milliers, MOIS_LONGS } from '../lib/format'
import type { DepartEstime } from '../moteur/reprise'
import type { Tresorerie } from '../moteur/tresorerie'
import { Aide } from './Aide'
import { ChampNombre } from './ChampNombre'

const finQuadrimestre = (q: number) => (q === 1 ? 'avril' : q === 2 ? 'août' : 'décembre')
export const texteEstimee = (e: DepartEstime) =>
  `Estimée à ${milliers(e.montant)} : ${milliers(e.depuis)} fin ${finQuadrimestre(e.quadrimestre)} ${e.annee}, plus l’activité prévue jusqu’au 31 décembre.`

// Lot 43 (Joseph, 03/11/2026) : la trésorerie au 1er janvier est un chiffre d'atterrissage, comme le CA de fin d'année ;
// elle se règle au point de départ. Saisie par le Directeur avant ou après la proposition, puis par le franchisé tant que
// le budget n'est pas validé ; sans saisie, celle estimée depuis les comptes de l'année.
export function TresorerieDepart({ annee, depart, estimee, onDepart, lectureSeule, tresorerie, accord }: {
  annee: number
  depart: number | undefined
  estimee: DepartEstime | null
  onDepart?: (v: number | undefined) => void      // absent : budget pas encore proposé, l'estimation se lit seulement
  lectureSeule: boolean
  tresorerie?: Tresorerie | null
  accord?: ReactNode                               // « D'accord » du franchisé sur ce thème (lot 42)
}) {
  const [saisie, setSaisie] = useState(depart === undefined ? '' : enChiffres(depart))
  // Départ changé ailleurs (ajustements chargés après coup, retour aux valeurs enregistrées) : le champ suit
  useEffect(() => { setSaisie((s) => { const n = nombre(s); return (n === null ? undefined : n) === depart ? s : depart === undefined ? '' : enChiffres(depart) }) }, [depart])
  const changer = (v: string) => {
    setSaisie(v)
    const n = nombre(v)
    if (n === null) onDepart?.(undefined)
    else if (!Number.isNaN(n)) onDepart?.(n)
  }
  return (
    <Card component="section" aria-label={`Trésorerie au 1er janvier ${annee}`} sx={{ p: { xs: 2, md: 2.5 }, display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="h2">Trésorerie au 1er janvier {annee}</Typography><Aide sujet="tresorerie" />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 1, flexWrap: 'wrap' }}>
        {onDepart ? (
          <ChampNombre libelle="Trésorerie au 1er janvier" valeur={saisie} onChange={changer} desactive={lectureSeule} largeur={180} />
        ) : (
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{estimee ? milliers(estimee.montant) : 'Pas encore connue'}</Typography>
        )}
        {tresorerie && (
          <Typography variant="body2" color="text.secondary">
            {`Fin décembre ${annee} : ${milliers(tresorerie.fin)} · point bas ${milliers(tresorerie.pointBas.montant)} fin ${MOIS_LONGS[tresorerie.pointBas.mois]}`}
          </Typography>
        )}
      </Box>
      {depart === undefined && (
        <Typography variant="body2" color="text.secondary">
          {estimee ? texteEstimee(estimee) : 'Sans comptes de l’année saisis, elle part de zéro.'}
          {onDepart && !lectureSeule ? ' Saisis le solde bancaire quand tu le connais.' : ''}
          {!onDepart ? ' Elle se corrige une fois le budget proposé.' : ''}
        </Typography>
      )}
      {accord && <Box className="pas-a-l-impression">{accord}</Box>}
    </Card>
  )
}
