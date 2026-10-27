// Lecture d'un classeur Excel (.xlsx) sans dépendance : un .xlsx est une archive zip de fichiers XML.
// On ne lit que les valeurs des cellules (pour une formule, la dernière valeur calculée et enregistrée par Excel).

export type Valeur = string | number | boolean
export type Feuille = Map<string, Valeur>
export type Classeur = Map<string, Feuille>

export class FichierIllisible extends Error {}

async function inflater(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Blob([donnees as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(flux).arrayBuffer())
}

// Fichiers de l'archive zip, d'après son répertoire central
async function lireZip(tampon: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(tampon)
  const octets = new Uint8Array(tampon)
  let fin = -1
  for (let i = tampon.byteLength - 22; i >= Math.max(0, tampon.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break }
  }
  if (fin < 0) throw new FichierIllisible()
  const nombre = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const texte = new TextDecoder()
  const fichiers = new Map<string, () => Promise<string>>()
  for (let n = 0; n < nombre; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new FichierIllisible()
    const methode = v.getUint16(p + 10, true)
    const taille = v.getUint32(p + 20, true)
    const lgNom = v.getUint16(p + 28, true)
    const lgExtra = v.getUint16(p + 30, true)
    const lgCommentaire = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nom = texte.decode(octets.subarray(p + 46, p + 46 + lgNom))
    fichiers.set(nom, async () => {
      const debut = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
      const brut = octets.subarray(debut, debut + taille)
      if (methode === 0) return texte.decode(brut)
      if (methode === 8) return texte.decode(await inflater(brut))
      throw new FichierIllisible()
    })
    p += 46 + lgNom + lgExtra + lgCommentaire
  }
  return fichiers
}

const entites: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decoder = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : entites[e] ?? m)
const attribut = (balise: string, nom: string) => balise.match(new RegExp(`\\s${nom}="([^"]*)"`))?.[1]
const textes = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decoder(m[1])).join('')

export async function lireClasseur(tampon: ArrayBuffer): Promise<Classeur> {
  let zip: Map<string, () => Promise<string>>
  try { zip = await lireZip(tampon) } catch { throw new FichierIllisible() }
  const lire = async (nom: string) => { const f = zip.get(nom); return f ? f() : '' }
  const classeurXml = await lire('xl/workbook.xml')
  if (!classeurXml) throw new FichierIllisible()
  const liens = new Map([...(await lire('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => [attribut(m[0], 'Id') ?? '', attribut(m[0], 'Target') ?? '']))
  const partages = [...(await lire('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textes(m[1]))

  const classeur: Classeur = new Map()
  for (const m of classeurXml.matchAll(/<sheet\b[^>]*>/g)) {
    const nom = decoder(attribut(m[0], 'name') ?? '')
    const cible = liens.get(attribut(m[0], 'r:id') ?? '') ?? ''
    const chemin = cible.startsWith('/') ? cible.slice(1) : `xl/${cible}`
    const feuille: Feuille = new Map()
    for (const c of (await lire(chemin)).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attribut(c[1], 'r')
      const contenu = c[2] ?? ''
      if (!ref) continue
      const type = attribut(c[1], 't')
      const brut = contenu.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let valeur: Valeur | undefined
      if (type === 'inlineStr') valeur = textes(contenu)
      else if (brut === undefined) continue
      else if (type === 's') valeur = partages[Number(brut)] ?? ''
      else if (type === 'str') valeur = decoder(brut)
      else if (type === 'b') valeur = brut === '1'
      else if (type === 'e') continue
      else valeur = Number(brut)
      feuille.set(ref, valeur)
    }
    classeur.set(nom, feuille)
  }
  return classeur
}
