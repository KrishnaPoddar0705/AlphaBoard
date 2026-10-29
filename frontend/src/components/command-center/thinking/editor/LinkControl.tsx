import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Link2, Unlink } from 'lucide-react'

/** Link button with an inline URL field, instead of a browser prompt that blocks the page. */
export default function LinkControl({ editor, compact }: { editor: Editor; compact?: boolean }) {
  const active = useEditorState({ editor, selector: ({ editor: e }) => e.isActive('link') })
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  const start = () => {
    setUrl((editor.getAttributes('link').href as string | undefined) ?? '')
    setOpen(true)
  }
  const apply = () => {
    const href = url.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!href) chain.unsetLink().run()
    else chain.setLink({ href: /^https?:\/\//i.test(href) ? href : `https://${href}` }).run()
    setOpen(false)
  }

  if (open) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); apply() }} className="flex flex-none items-center gap-1">
        <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} onBlur={() => setOpen(false)}
          className="tb-data h-7 w-44 rounded-md border border-[#D7D0C2] bg-[#FFFDF7] px-2 text-[11px] focus:border-[#1C1B17] focus:outline-none" />
      </form>
    )
  }
  return (
    <>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={start}
        aria-label="Link" title="Link" aria-pressed={active}
        className={[
          'flex flex-none items-center justify-center rounded-md transition-colors',
          compact ? 'h-7 w-7' : 'h-7 w-7',
          active ? 'bg-[#1C1B17] text-[#F7F2E6]' : 'text-[#4A463E] hover:bg-[#EFE9DA]',
        ].join(' ')}>
        <Link2 className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </button>
      {active && !compact && (
        <button type="button" onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          aria-label="Remove link" title="Remove link"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-[#4A463E] hover:bg-[#EFE9DA]">
          <Unlink className="h-[15px] w-[15px]" strokeWidth={1.8} />
        </button>
      )}
    </>
  )
}
