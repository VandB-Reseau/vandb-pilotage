// Mêmes rôles que l'app réseau. Le Directeur de réseau, les Responsables Régionaux et les Coachs forment l'équipe ;
// un franchisé ne voit que ses magasins ; « aucun » : compte créé mais pas encore ouvert.
export type Role = 'directeur' | 'rr' | 'coach' | 'franchise' | 'aucun'

export interface Profil {
  id: string
  email: string
  nom: string
  role: Role
  parametreur?: boolean      // Directeur ou contrôle de gestion : modifie les paramètres réseau (lot 39)
  controleGestion?: boolean  // compte du contrôle de gestion, désigné par le Directeur dans le pilotage
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
// Paramètres réseau : modifiés par le Directeur et le contrôle de gestion, lus par les Responsables Régionaux (lot 39)
export const peutParametrer = (p: Profil | null) => p?.role === 'directeur' || !!p?.parametreur
export const voitParametres = (p: Profil | null) => peutParametrer(p) || p?.role === 'rr'
// Compte du contrôle de gestion sans rôle dans l'app réseau : il n'a que les paramètres
export const seulementParametres = (p: Profil | null) => p?.role === 'aucun' && !!p.parametreur
export const libelleProfil = (p: Profil) => (p.controleGestion && p.role !== 'directeur' ? 'Contrôle de gestion' : roleLibelle[p.role])
