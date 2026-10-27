import { brand } from '../theme/theme'

// Petite courbe d'une carte : tendance sur l'année, sans axe ni légende (décorative, la valeur est dans la carte)
export function Courbe({ valeurs, couleur = brand.vert }: { valeurs: (number | null)[]; couleur?: string }) {
  const points = valeurs.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v !== null)
  if (points.length < 2) return null
  const max = Math.max(...points.map((p) => p.v)), min = Math.min(0, ...points.map((p) => p.v))
  // Étirée sur les seuls mois connus : deux mois de réel occupent toute la largeur
  const premier = points[0].i, dernier = points[points.length - 1].i
  const x = (i: number) => ((i - premier) / (dernier - premier)) * 100
  const y = (v: number) => 28 - ((v - min) / (max - min || 1)) * 26
  const trace = points.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const aire = `${trace} L${x(points[points.length - 1].i).toFixed(1)},30 L${x(points[0].i).toFixed(1)},30 Z`
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden width="100%" height="32" style={{ display: 'block' }}>
      <path d={aire} fill={couleur} opacity={0.1} />
      <path d={trace} fill="none" stroke={couleur} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
