import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ComboChart } from './ComboChart'
import { explainFinancials } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface IncomeStatementSectionProps {
  incomeData?: any[]
  loading?: boolean
  ticker?: string
}

export function IncomeStatementSection({ incomeData, loading, ticker = 'AAPL' }: IncomeStatementSectionProps) {
  const [period, setPeriod] = useState<'quarterly' | 'annually'>('quarterly')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  
  const handleExplain = async () => {
    if (!incomeData || incomeData.length === 0) return
    
    setLoadingExplanation(true)
    setShowExplanation(true)
    try {
      // Extract ticker from somewhere - for now use a placeholder
      const result = await explainFinancials(ticker, incomeData)
      setExplanation(result.explanation || 'Unable to generate explanation.')
    } catch (error) {
      console.error('Error getting explanation:', error)
      setExplanation('Unable to generate explanation at this time.')
    } finally {
      setLoadingExplanation(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
        <p className="text-sm font-mono text-[#6F6A60]">Loading financial data...</p>
      </div>
    )
  }

  if (!incomeData || incomeData.length === 0) {
    return null
  }

  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#D7D0C2]">
        <h2 className="text-base font-mono font-bold text-[#1C1B17]">Income Statement</h2>
        <div className="flex gap-2">
          <Button
            variant={period === 'quarterly' ? 'default' : 'outline'}
            onClick={() => setPeriod('quarterly')}
            className={`font-mono text-xs px-3 py-1.5 h-auto ${
              period === 'quarterly'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                : 'bg-transparent border-[#D7D0C2] text-[#1C1B17]'
            }`}
          >
            Quarterly
          </Button>
          <Button
            variant={period === 'annually' ? 'default' : 'outline'}
            onClick={() => setPeriod('annually')}
            className={`font-mono text-xs px-3 py-1.5 h-auto ${
              period === 'annually'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                : 'bg-transparent border-[#D7D0C2] text-[#1C1B17]'
            }`}
          >
            Annually
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#D7D0C2]">
              <th className="text-left py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Period
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Revenue
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Operating Expense
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Net Income
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Net Profit Mar.
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                Earnings P...
              </th>
              <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                EBITDA
              </th>
            </tr>
          </thead>
                        <tbody>
                          {incomeData.slice(0, 5).map((row: any, idx: number) => {
                            const revenue = row.revenue || row.totalRevenue || 0
                            const operatingExpense = row.operatingExpense || row.totalOperatingExpenses || 
                              ((row.cogs || 0) + (row.rnd || 0) + (row.sga || 0))
                            const netIncome = row.netIncome || row.netProfit || 0
                            const netProfitMargin = row.netProfitMargin !== undefined ? row.netProfitMargin : (revenue > 0 ? (netIncome / revenue) * 100 : 0)
                            const eps = row.eps || row.earningsPerShare || 0
                            const ebitda = row.ebitda || row.ebitdaValue || row.operatingIncome || row.operating_profit || 0
                            
                            return (
                              <tr key={idx} className="border-b border-[#E3DDCF]">
                                <td className="py-2 px-3 text-[#1C1B17]">{row.period || row.year || row.date || 'N/A'}</td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {revenue > 0 ? `$${(revenue / 1e6).toFixed(2)}M` : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {operatingExpense > 0 ? `$${(operatingExpense / 1e6).toFixed(2)}M` : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {netIncome !== 0 ? `$${(netIncome / 1e6).toFixed(2)}M` : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {netProfitMargin !== 0 ? `${netProfitMargin.toFixed(2)}%` : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {eps !== 0 ? `$${eps.toFixed(2)}` : 'N/A'}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                                  {ebitda !== 0 ? `$${(ebitda / 1e6).toFixed(2)}M` : 'N/A'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
        </table>
      </div>

      {/* Combo Chart */}
      {incomeData && incomeData.length > 0 && (
        <div className="mt-6">
          <ComboChart data={incomeData} />
          <Button
            variant="outline"
            onClick={handleExplain}
            disabled={loadingExplanation}
            className="mt-4 font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
            size="sm"
          >
            {loadingExplanation ? 'Generating...' : 'Explain These Numbers'}
          </Button>
          
          <Dialog open={showExplanation} onOpenChange={setShowExplanation}>
            <DialogContent className="bg-[#F7F2E6] border-[#D7D0C2] max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-mono text-[#1C1B17]">Income Statement Analysis</DialogTitle>
                <DialogDescription className="font-mono text-[#6F6A60]">
                  AI-powered explanation of financial trends
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                {loadingExplanation ? (
                  <p className="font-mono text-sm text-[#6F6A60]">Generating explanation...</p>
                ) : (
                  <p className="font-mono text-sm text-[#1C1B17] leading-relaxed whitespace-pre-wrap">
                    {explanation || 'No explanation available.'}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

