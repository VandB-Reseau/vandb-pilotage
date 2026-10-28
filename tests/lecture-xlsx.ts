// Relit un classeur écrit par src/lib/xlsx.ts (archive ZIP sans compression) : chemin du fichier → texte XML.
export function lireClasseur(octets: Uint8Array): Record<string, string> {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  const fichiers: Record<string, string> = {}
  let p = 0
  while (p + 30 <= octets.length && v.getUint32(p, true) === 0x04034b50) {
    if (v.getUint16(p + 8, true) !== 0) throw new Error('fichier compressé')
    const taille = v.getUint32(p + 18, true), nom = v.getUint16(p + 26, true), extra = v.getUint16(p + 28, true)
    const debut = p + 30 + nom + extra
    fichiers[new TextDecoder().decode(octets.subarray(p + 30, p + 30 + nom))] = new TextDecoder().decode(octets.subarray(debut, debut + taille))
    p = debut + taille
  }
  return fichiers
}

// Contenu d'une cellule (référence A1) dans le XML d'une feuille
export function celluleXml(feuille: string, ref: string): string | null {
  return new RegExp(`<c r="${ref}"[^>]*?(?:/>|>(.*?)</c>)`).exec(feuille)?.[1] ?? null
}
