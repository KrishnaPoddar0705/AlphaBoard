/**
 * File extraction from a drop or paste.
 *
 * Kept out of the component file so both dropzones and the thesis editor can
 * import it without tripping react-refresh, which requires component modules to
 * export only components.
 */

/**
 * Reads files off a paste or drop. Safari below 16 leaves `files` empty for
 * some sources but still populates `items`.
 */
export function extractFiles(source: DataTransfer | null): File[] {
  if (!source) return []
  if (source.files?.length) return Array.from(source.files)
  return Array.from(source.items ?? [])
    .filter((i) => i.kind === 'file')
    .map((i) => i.getAsFile())
    .filter((f): f is File => f !== null)
}

/** Pasted screenshots all arrive named "image.png"; give them something distinct. */
export function nameClipboardFiles(files: File[]): File[] {
  return files.map((file) => {
    if (file.name && file.name !== 'image.png') return file
    const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '')
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
    return new File([file], `pasted-${stamp}.${ext}`, { type: file.type })
  })
}
