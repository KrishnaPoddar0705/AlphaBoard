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

export default function Recommendations() {
  const { user } = useUser()
  const [recommendations, setRecommendations] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showAddModal, setShowAddModal] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      loadRecommendations()
    }
  }, [user])

  const loadRecommendations = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Get Supabase user ID from mapping
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (!mapping) {
        setLoading(false)
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
      }
    } catch (error) {
      console.error("Error loading recommendations:", error)
    } finally {
      setLoading(false)
    }
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
    <div className="h-full flex flex-col bg-[#F1EEE0]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#D7D0C2] bg-[#F7F2E6]">
        <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight">Recommendations</h1>
        <Button
          onClick={() => setShowAddModal(true)}
          className="font-mono text-sm bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recommendation
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <RecommendationSidebar
          recommendations={recommendations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Detail View */}
        <RecommendationDetailView
          recommendation={selectedRecommendation}
          onUpdate={() => {
            loadRecommendations()
            // Clear selection if the recommendation was closed
            if (selectedRecommendation && selectedRecommendation.status === 'OPEN') {
              // Check if recommendation still exists and is OPEN
              setTimeout(() => {
                const stillExists = recommendations.find(r => r.id === selectedId && r.status === 'OPEN')
                if (!stillExists) {
                  // Recommendation was closed, clear selection
                  setSelectedId(null)
                }
              }, 100)
            }
          }}
        />
      </div>

      {/* Add Recommendation Modal */}
      <AddRecommendationModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadRecommendations()
          // Select the newly created recommendation if possible
          setTimeout(() => {
            if (recommendations.length > 0) {
              setSelectedId(recommendations[0].id)
            }
          }, 500)
        }}
      />
    </div>
  )
}
