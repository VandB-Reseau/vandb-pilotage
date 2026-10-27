// Mêmes rôles que l'app réseau. Le Directeur de réseau, les Responsables Régionaux et les Coachs forment l'équipe ;
// un franchisé ne voit que ses magasins ; « aucun » : compte créé mais pas encore ouvert.
export type Role = 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
}

export const roleLibelle: Record<Role, string> = {
  directeur: 'Directeur de réseau',
  rr: 'Responsable Régional',
  coach: 'Coach',
  franchise: 'Franchisé',
  aucun: 'Accès non ouvert',
}

export const estDirecteur = (p: Profil | null) => p?.role === 'directeur'
// Directeur, RR et Coach : la vue réseau, jamais montrée au franchisé
export const estEquipe = (p: Profil | null) => p?.role === 'directeur' || p?.role === 'rr' || p?.role === 'coach'
