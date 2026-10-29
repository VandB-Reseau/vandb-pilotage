import Button from '@mui/material/Button'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'
import { telechargerModele, type Modele } from '../lib/modeles'

// « Télécharger le modèle » d'un import (lot 32) : le fichier attendu, avec des lignes d'exemple
export function BoutonModele({ modele, libelle = 'Télécharger le modèle' }: { modele: Modele; libelle?: string }) {
  return (
    <Button startIcon={<FileDownloadOutlined />} onClick={() => telechargerModele(modele)} className="pas-a-l-impression" sx={{ minHeight: 48 }}>
      {libelle}
    </Button>
  )
}
