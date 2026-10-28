// Classeur Excel (.xlsx) écrit dans le navigateur, sans bibliothèque : quelques feuilles, des nombres, des textes,
// des formules (avec leur valeur, pour les lecteurs qui ne recalculent pas) et une poignée de styles.
// Archive ZIP sans compression : le fichier reste petit (quelques dizaines de ko pour un réseau entier).

export type Style = 'texte' | 'gras' | 'titre' | 'entete' | 'enteteDroite' | 'retrait' | 'euros' | 'eurosGras' | 'euros2' | 'euros2Gras' | 'pct' | 'pctGras' | 'discret'
export type Cellule = string | number | null | { v?: string | number | null; f?: string; s?: Style }
export interface Feuille {
  nom: string
  lignes: Cellule[][]
  largeurs?: number[]                       // en caractères, colonne par colonne
  figer?: { lignes: number; colonnes: number }
}

// Ordre = numéro du style dans styles.xml
const STYLES: Style[] = ['texte', 'gras', 'titre', 'entete', 'retrait', 'euros', 'eurosGras', 'euros2', 'euros2Gras', 'pct', 'pctGras', 'discret', 'enteteDroite']

export const colonne = (i: number): string => (i < 26 ? '' : colonne(Math.floor(i / 26) - 1)) + String.fromCharCode(65 + (i % 26))
export const cellule = (ligne: number, col: number) => `${colonne(col)}${ligne + 1}`

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caractères de contrôle interdits dans le XML
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

// 12 chiffres significatifs : pas de 209999.99999999997 hérité des calculs en virgule flottante
const nombre = (v: number) => String(Number(v.toPrecision(12)))

function xmlCellule(c: Cellule, ref: string): string {
  if (c === null || c === undefined) return ''
  const o = typeof c === 'object' ? c : { v: c }
  const s = o.s ? ` s="${STYLES.indexOf(o.s)}"` : ''
  const v = o.v ?? null
  if (o.f) {
    const f = `<f>${echapper(o.f.replace(/^=/, ''))}</f>`
    if (typeof v === 'string') return `<c r="${ref}"${s} t="str">${f}<v>${echapper(v)}</v></c>`
    return `<c r="${ref}"${s}>${f}${typeof v === 'number' && Number.isFinite(v) ? `<v>${nombre(v)}</v>` : ''}</c>`
  }
  if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${nombre(v)}</v></c>` : (s ? `<c r="${ref}"${s}/>` : '')
  if (typeof v === 'string' && v !== '') return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${echapper(v)}</t></is></c>`
  return s ? `<c r="${ref}"${s}/>` : ''
}

function xmlFeuille(f: Feuille): string {
  const vue = f.figer && (f.figer.lignes || f.figer.colonnes)
    ? `<sheetViews><sheetView workbookViewId="0"><pane${f.figer.colonnes ? ` xSplit="${f.figer.colonnes}"` : ''}${f.figer.lignes ? ` ySplit="${f.figer.lignes}"` : ''} topLeftCell="${cellule(f.figer.lignes, f.figer.colonnes)}" activePane="${f.figer.lignes && f.figer.colonnes ? 'bottomRight' : f.figer.lignes ? 'bottomLeft' : 'topRight'}" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const cols = f.largeurs?.length ? `<cols>${f.largeurs.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>` : ''
  const lignes = f.lignes.map((l, i) => `<row r="${i + 1}">${l.map((c, j) => xmlCellule(c, cellule(i, j))).join('')}</row>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${vue}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${lignes}</sheetData><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToHeight="0"/></worksheet>`
}

const XML_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0\\ &quot;€&quot;;\\-#,##0\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF5F5F5F"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EEE8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF9E9E9E"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="bottom"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment indent="2"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" wrapText="1" vertical="bottom"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

// Nom de feuille : 31 caractères au plus, sans : \ / ? * [ ]
export const nomFeuille = (t: string) => t.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Feuille'

export function classeur(feuilles: Feuille[]): Uint8Array {
  const noms = feuilles.map((f) => nomFeuille(f.nom))
  const fichiers: [string, string][] = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${noms.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${noms.map((n, i) => `<sheet name="${echapper(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${noms.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${noms.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', XML_STYLES],
    ...feuilles.map((f, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, xmlFeuille(f)]),
  ]
  return zip(fichiers.map(([nom, texte]) => [nom, new TextEncoder().encode(texte)]))
}

export function telecharger(nomFichier: string, octets: Uint8Array) {
  const url = URL.createObjectURL(new Blob([octets as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Nom de fichier sans caractère gênant ni accent (Chrome ignore un nom accentué) : « Budget 2027 - Brionne-sur-Lac.xlsx »
export const nomFichier = (t: string) =>
  `${t.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]/g, '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()}.xlsx`

// ── ZIP sans compression (méthode « stored »)
const TABLE_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
export function crc32(o: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < o.length; i++) c = TABLE_CRC[(c ^ o[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(fichiers: [string, Uint8Array][]): Uint8Array {
  const d = new Date()
  const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  const locaux: Uint8Array[] = [], centraux: Uint8Array[] = []
  let position = 0
  for (const [nom, donnees] of fichiers) {
    const n = new TextEncoder().encode(nom)
    const crc = crc32(donnees)
    const local = new Uint8Array(30 + n.length)
    const l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true)
    l.setUint16(10, heure, true); l.setUint16(12, jour, true); l.setUint32(14, crc, true)
    l.setUint32(18, donnees.length, true); l.setUint32(22, donnees.length, true); l.setUint16(26, n.length, true); l.setUint16(28, 0, true)
    local.set(n, 30)
    const central = new Uint8Array(46 + n.length)
    const c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true)
    c.setUint16(12, heure, true); c.setUint16(14, jour, true); c.setUint32(16, crc, true)
    c.setUint32(20, donnees.length, true); c.setUint32(24, donnees.length, true); c.setUint16(28, n.length, true)
    c.setUint32(42, position, true)
    central.set(n, 46)
    locaux.push(local, donnees)
    centraux.push(central)
    position += local.length + donnees.length
  }
  const tailleCentral = centraux.reduce((a, b) => a + b.length, 0)
  const fin = new Uint8Array(22)
  const f = new DataView(fin.buffer)
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, fichiers.length, true); f.setUint16(10, fichiers.length, true)
  f.setUint32(12, tailleCentral, true); f.setUint32(16, position, true)
  const sortie = new Uint8Array(position + tailleCentral + 22)
  let p = 0
  for (const b of [...locaux, ...centraux, fin]) { sortie.set(b, p); p += b.length }
  return sortie
}
