"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { getPrice } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { RecommendationSidebar } from "@/components/recommendations/RecommendationSidebar"
import { RecommendationDetailView } from "@/components/recommendations/RecommendationDetailView"
import { AddRecommendationModal } from "@/components/recommendations/AddRecommendationModal"
import { useIsMobile } from "@/hooks/use-mobile"

export default function Recommendations() {
  const { user } = useUser()
  const isMobile = useIsMobile()
  const [recommendations, setRecommendations] = React.useState<any[]>([])
  // Only the very first fetch blanks the page. Later refreshes repaint in place
  // so the user never loses their scroll position or selection mid-task.
  const [loading, setLoading] = React.useState(true)
  const hasLoadedRef = React.useRef(false)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const topRef = React.useRef<HTMLDivElement>(null)

  // Keyed on the user *id*, not the Clerk user object: Clerk hands back a new
  // object identity on every session refresh, and depending on the object made
  // this effect re-run at random and blank the page mid-interaction.
  React.useEffect(() => {
    if (user?.id) {
      loadRecommendations()
    }
  }, [user?.id])

  const loadRecommendations = async (options: { silent?: boolean } = {}) => {
    if (!user) return
    const silent = options.silent ?? hasLoadedRef.current
    if (!silent) setLoading(true)
    try {
      // Get Supabase user ID from mapping
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (!mapping) {
        setLoading(false)
        hasLoadedRef.current = true
        return
      }

      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .eq("user_id", mapping.supabase_user_id)
        .eq("status", "OPEN") // Only show OPEN recommendations
        .order("entry_date", { ascending: false })

      if (!error && data) {
        // Fetch current prices
        const recommendationsWithPrices = await Promise.all(
          data.map(async (rec) => {
            try {
              const priceData = await getPrice(rec.ticker)
              return { ...rec, current_price: priceData.price || rec.current_price }
            } catch {
              return rec
            }
          })
        )
        setRecommendations(recommendationsWithPrices)

        // Auto-select first recommendation if available
        if (recommendationsWithPrices.length > 0 && !selectedId) {
          setSelectedId(recommendationsWithPrices[0].id)
        }
        return recommendationsWithPrices
      }
    } catch (error) {
    } finally {
      setLoading(false)
      hasLoadedRef.current = true
    }
    return null
  }

  const selectedRecommendation = recommendations.find((rec) => rec.id === selectedId) || null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading recommendations...</div>
      </div>
    )
  }

  return (
    <div className="h-full w-full max-w-full overflow-x-hidden flex flex-col bg-[#F1EEE0]">
      {/* Header */}
      <div className="w-full max-w-full border-b border-[#D7D0C2] bg-[#F7F2E6]">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 md:max-w-none md:mx-0 md:px-4 min-w-0 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
            {/* Match other page headers (e.g. Community) */}
            <h1 className="text-[28px] font-bold text-[#1C1B17] tracking-tight leading-tight">
              Recommendations
            </h1>
            <Button
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto shrink-0 whitespace-nowrap font-mono text-sm bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recommendation
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-full overflow-x-hidden">
        <div ref={topRef} />
        <div className="mx-auto h-full w-full max-w-6xl px-3 sm:px-4 md:max-w-none md:mx-0 md:pl-0 md:pr-6 min-w-0">
          {isMobile ? (
            <div className="flex flex-col gap-4 min-w-0">
              {/* Detail view (on top of list) */}
              {selectedRecommendation ? (
                <div className="min-w-0">
                  <RecommendationDetailView
                    recommendation={selectedRecommendation}
                    onBack={() => {
                      setSelectedId(null)
                      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    onUpdate={() => {
                      loadRecommendations({ silent: true }).then((fresh) => {
                        // Drop the selection only if the row genuinely went away.
                        if (fresh && selectedId && !fresh.some((r) => r.id === selectedId)) {
                          setSelectedId(null)
                        }
                      })
                    }}
                  />
                </div>
              ) : null}

              {/* List */}
              <div className="min-w-0">
                <RecommendationSidebar
                  recommendations={recommendations}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id)
                    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="h-full grid grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)] gap-6 min-w-0">
              {/* Sidebar / list */}
              <div className="min-w-0">
                <RecommendationSidebar
                  recommendations={recommendations}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>

              {/* Detail View */}
              <div className="min-w-0">
                <RecommendationDetailView
                  recommendation={selectedRecommendation}
                  onUpdate={() => {
                    loadRecommendations({ silent: true }).then((fresh) => {
                      // Drop the selection only if the row genuinely went away.
                      if (fresh && selectedId && !fresh.some((r) => r.id === selectedId)) {
                        setSelectedId(null)
                      }
                    })
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Recommendation Modal */}
      <AddRecommendationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          // Refresh in place -- no full-page loader -- and select the row that
          // was just created, taken from the fresh list rather than a stale one.
          loadRecommendations({ silent: true }).then((fresh) => {
            if (fresh && fresh.length > 0) {
              setSelectedId(fresh[0].id)
            }
          })
        }}
      />
    </div>
  )
}
