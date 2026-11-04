// Fusion avec l'app réseau (Joseph, 03/11/2026, point 9) : l'adresse du pilotage disparaît. Les budgets vivent dans
// l'app réseau (menu « Budgets », onglet « Budget » de la fiche du magasin). Une ancienne adresse, un favori ou un lien
// envoyé par message mène à la même page dans l'app réseau. Même origine : la connexion est déjà partagée.
export const APP_RESEAU = 'https://vandb-reseau.github.io/vandb-reseau/'
export const HOTE_PUBLIC = 'vandb-reseau.github.io'

const PAGES: Record<string, string> = {
  '': '/budgets',
  reseau: '/budgets/suivi',
  hypotheses: '/budgets/hypotheses',
  imports: '/budgets/imports',
  parametres: '/budgets/parametres',
}

// hash : « #/magasins/Annecy/budget?x=1 », « #/reseau »… ; rend l'adresse complète dans l'app réseau
export function adresseReseau(hash: string): string {
  const chemin = hash.replace(/^#/, '').split('?')[0].replace(/^\/+|\/+$/g, '')
  const [page = '', nom, partie] = chemin.split('/')
  if (page === 'magasins' && nom) {
    const p = partie ? `&partie=${encodeURIComponent(decodeURIComponent(partie))}` : ''
    return `${APP_RESEAU}#/magasins/${encodeURIComponent(decodeURIComponent(nom))}?vue=budget${p}`
  }
  return `${APP_RESEAU}#${PAGES[page] ?? '/budgets'}`
}
