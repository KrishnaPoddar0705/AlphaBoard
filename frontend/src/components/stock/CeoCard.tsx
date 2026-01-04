// import React from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CeoCardProps {
  ceoName?: string
}

export function CeoCard({ ceoName = 'CEO Name' }: CeoCardProps) {
  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
      <div className="flex flex-col items-center mb-4">
        <Avatar className="w-16 h-16 mb-3 border border-[#D7D0C2] bg-[#FBF7ED]">
          <AvatarFallback className="font-mono text-[#1C1B17] bg-[#FBF7ED]">
            {ceoName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="text-xs font-mono text-[#6F6A60] uppercase tracking-wider mb-1">CEO</p>
          <p className="text-sm font-mono font-semibold text-[#1C1B17]">{ceoName}</p>
        </div>
      </div>
      <Button
        variant="outline"
        className="w-full font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
        size="sm"
      >
        View Insider Trades
      </Button>
    </div>
  )
}

