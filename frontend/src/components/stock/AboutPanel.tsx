import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AboutPanelProps {
  companyName?: string
  description?: string
  website?: string
}

const MAX_HEIGHT = 120 // Max height in pixels before showing read more

export function AboutPanel({ companyName, description, website }: AboutPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [needsExpansion, setNeedsExpansion] = useState(false)
  const textRef = React.useRef<HTMLParagraphElement>(null)

  React.useEffect(() => {
    if (textRef.current) {
      const height = textRef.current.scrollHeight
      setNeedsExpansion(height > MAX_HEIGHT)
    }
  }, [description])

  const displayText = description || 'No description available'

  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5 h-full flex flex-col">
      <h2 className="text-base font-mono font-bold text-[#1C1B17] mb-3">
        About {companyName || 'Company'}
      </h2>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-[#2F8F5B] hover:underline block mb-3"
        >
          {website}
        </a>
      )}
      <div className="flex-1 overflow-hidden">
        <p
          ref={textRef}
          className={`text-sm font-mono text-[#6F6A60] leading-relaxed ${
            !isExpanded && needsExpansion ? 'line-clamp-4' : ''
          }`}
          style={{
            maxHeight: isExpanded ? 'none' : `${MAX_HEIGHT}px`,
            overflow: isExpanded ? 'visible' : 'hidden',
          }}
        >
          {displayText}
        </p>
        {needsExpansion && (
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 font-mono text-xs text-[#6F6A60] hover:text-[#1C1B17] p-0 h-auto"
            size="sm"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Read less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Read more
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

