"use client"

import * as React from "react"
import { Outlet } from "react-router-dom"
import { AppSidebar } from "./AppSidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useSearch } from "@/contexts/SearchContext"
import { searchStocks } from "@/lib/api"
import { useDebounce } from "@/hooks/useDebounce"

interface SearchResult {
    symbol: string
    name: string
    market?: string
}

export default function LayoutV2() {
    const { searchQuery, setSearchQuery } = useSearch()
    const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const debouncedQuery = useDebounce(searchQuery, 300)
    const searchRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useEffect(() => {
        if (debouncedQuery.trim().length >= 2) {
            searchStocks(debouncedQuery)
                .then((results: SearchResult[]) => {
                    setSearchResults(results.slice(0, 5)) // Limit to 5 results
                    setShowSuggestions(true)
                })
                .catch(() => {
                    setSearchResults([])
                    setShowSuggestions(false)
                })
        } else {
            setSearchResults([])
            setShowSuggestions(false)
        }
    }, [debouncedQuery])

    const handleSelectStock = (symbol: string) => {
        setSearchQuery(symbol)
        setShowSuggestions(false)
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[#D7D0C2] bg-[#F1EEE0] px-4 md:px-6">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4 bg-[#D7D0C2]" />
                    <div className="flex flex-1 items-center gap-4">
                        <div className="relative flex-1 max-w-md" ref={searchRef}>
                            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F6A60] z-10" />
                            <Input
                                placeholder="Search Stock"
                                className="pl-8 bg-[#F7F2E6]"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    if (e.target.value.trim().length >= 2) {
                                        setShowSuggestions(true)
                                    } else {
                                        setShowSuggestions(false)
                                    }
                                }}
                                onFocus={() => {
                                    if (searchResults.length > 0) {
                                        setShowSuggestions(true)
                                    }
                                }}
                            />
                            {showSuggestions && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.symbol}
                                            onClick={() => handleSelectStock(result.symbol)}
                                            className="w-full text-left px-4 py-3 hover:bg-[#F1EEE0] transition-colors border-b border-[#D7D0C2] last:border-b-0"
                                        >
                                            <div className="font-semibold text-[#1C1B17]">{result.symbol}</div>
                                            <div className="text-sm text-[#6F6A60] truncate">{result.name}</div>
                                            {result.market && (
                                                <div className="text-xs text-[#6F6A60] mt-1">{result.market}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <div className="flex flex-1 flex-col overflow-auto">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}

