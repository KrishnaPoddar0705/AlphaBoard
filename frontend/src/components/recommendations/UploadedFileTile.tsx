import { useState } from 'react';
import { FileText } from 'lucide-react';

interface UploadedFileTileProps {
  url: string;
  index: number;
}

/** Matches .pdf before an optional query string or fragment. */
function isPdfUrl(url: string): boolean {
  return /\.pdf(?:[?#]|$)/i.test(url);
}

// Uploads are stored as `${Date.now()}_${random}.${ext}` — the original
// filename is discarded, so there is nothing meaningful to show from the URL.
// A generic label beats echoing "1767475922027_n8o3no.pdf" at the user.

/**
 * One entry in the recommendation's "Uploaded Files" grid.
 *
 * The whole tile is the link, so a PDF opens in a new tab from anywhere on it
 * rather than only from a hover overlay.
 *
 * Previously every upload rendered as <img>, and a PDF's load failure ran an
 * onError handler that reassigned the wrapper's innerHTML. That wiped the
 * sibling anchor along with the broken image, which is why PDFs showed a dead
 * "Document" box with no way to open them. The fallback is React state now, so
 * the link is never destroyed — and the DOM is no longer mutated behind React's
 * back.
 */
export default function UploadedFileTile({ url, index }: UploadedFileTileProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const isPdf = isPdfUrl(url);
  const showDocumentTile = isPdf || imageFailed;
  const label = isPdf ? 'PDF document' : 'Document';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="relative group block rounded focus:outline-none focus:ring-2 focus:ring-[#6F6A60]"
    >
      {showDocumentTile ? (
        <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded border border-[#D7D0C2] bg-[#FBF7ED] px-2">
          <FileText className="h-6 w-6 shrink-0 text-[#6F6A60]" />
          <span className="max-w-full truncate font-mono text-xs text-[#6F6A60]">{label}</span>
        </div>
      ) : (
        <img
          src={url}
          alt={`Upload ${index + 1}`}
          className="h-32 w-full rounded border border-[#D7D0C2] object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      <span className="absolute inset-0 flex items-center justify-center rounded bg-black/50 font-mono text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {isPdf ? 'Open PDF' : 'View'}
      </span>
    </a>
  );
}
