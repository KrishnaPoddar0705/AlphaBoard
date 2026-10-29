import { forwardRef, useImperativeHandle, useState } from 'react'
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { SlashItem } from './slashCommand'

export interface ListProps { items: SlashItem[]; command: (item: SlashItem) => void }
export interface ListHandle { onKeyDown: (p: SuggestionKeyDownProps) => boolean }

const SlashList = forwardRef<ListHandle, ListProps>(({ items, command }, ref) => {
  const [index, setIndex] = useState(0)
  // A new query means a new list: back to the top match (adjusted during render, which
  // React prefers over an effect for state derived from a prop change).
  const [seen, setSeen] = useState(items)
  if (seen !== items) { setSeen(items); setIndex(0) }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') { setIndex((i) => (i + 1) % items.length); return true }
      if (event.key === 'ArrowUp') { setIndex((i) => (i - 1 + items.length) % items.length); return true }
      if (event.key === 'Enter') { command(items[index]); return true }
      return false
    },
  }))

  if (!items.length) {
    return <div className="tb-card tb-data w-64 px-3 py-2.5 text-[11px] text-[#8B857A]">Nothing matches</div>
  }
  return (
    <div className="tb-card max-h-[340px] w-72 overflow-y-auto p-1.5" role="listbox">
      {items.map((item, i) => {
        const header = item.group !== items[i - 1]?.group ? item.group : null
        const Icon = item.icon
        return (
          <div key={item.title}>
            {header && <p className="tb-data px-2 pb-1 pt-2 text-[10px] text-[#8B857A]">{header}</p>}
            <button type="button" role="option" aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => { e.preventDefault(); command(item) }}
              className={[
                'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left',
                i === index ? 'bg-[#EFE9DA]' : '',
              ].join(' ')}>
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[#DDD6C7] bg-[#FBF7ED]">
                <Icon className="h-3.5 w-3.5 text-[#3F3C35]" />
              </span>
              <span className="min-w-0">
                <span className="tb-data block text-[12px] text-[#1C1B17]">{item.title}</span>
                <span className="tb-data block truncate text-[10.5px] text-[#8B857A]">{item.hint}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
})
SlashList.displayName = 'SlashList'

export default SlashList
