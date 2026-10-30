// Per-page text extraction for keyword search.
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

export interface PageText {
  page_number: number;
  content: string;
}

/**
 * Text of each page that has any, 1-based. A scanned PDF has no text layer and yields [].
 * pdf.js can take ownership of the buffer it is given, so it gets a copy and the caller's
 * bytes stay usable for the Gemini upload.
 */
export async function extractPdfPages(pdf: Uint8Array): Promise<PageText[]> {
  const doc = await getDocumentProxy(pdf.slice());
  const { text } = await extractText(doc, { mergePages: false });
  return text
    .map((content: string, i: number) => ({ page_number: i + 1, content: content.replace(/\u0000/g, '').trim() }))
    .filter((p: PageText) => p.content.length > 0);
}
