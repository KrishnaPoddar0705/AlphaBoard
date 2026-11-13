// import React from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CeoCardProps {
  ceoName?: string
}

export function CeoCard({ ceoName = 'CEO Name' }: CeoCardProps) {
  return (
    <div className="bg-paper-light border border-border-editorial p-5">
      <div className="flex flex-col items-center mb-4">
        <Avatar className="w-16 h-16 mb-3 border border-border-editorial bg-paper-alt">
          <AvatarFallback className="font-mono text-ink bg-paper-alt">
            {ceoName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-xs font-mono text-ink-muted uppercase tracking-wider mb-1">CEO</p>
          <p className="text-sm font-mono font-semibold text-ink">{ceoName}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full font-mono text-xs bg-transparent border-border-editorial text-ink hover:bg-paper-alt"
        size="sm"
      >
        View Insider Trades
      </Button>
    </div>
  )
}

