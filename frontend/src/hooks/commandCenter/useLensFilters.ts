import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LensFilters } from '@/lib/commandCenter/home'

const PARAMS: Record<keyof LensFilters, string> = {
  analystId: 'analyst', sector: 'sector', coverageId: 'stock', typeId: 'type',
}

/**
 * The filters above the home table, kept in the URL (?analyst=&sector=&stock=&type=)
 * next to the scope and lens, so a filtered view can be bookmarked or sent to someone.
 */
export function useLensFilters() {
  const [params, setParams] = useSearchParams()
  const analystId = params.get(PARAMS.analystId)
  const sector = params.get(PARAMS.sector)
  const coverageId = params.get(PARAMS.coverageId)
  const typeId = params.get(PARAMS.typeId)

  const filters = useMemo<LensFilters>(
    () => ({ analystId, sector, coverageId, typeId }),
    [analystId, sector, coverageId, typeId]
  )

  const setFilters = (patch: Partial<LensFilters>) => {
    const next = new URLSearchParams(params)
    for (const key of Object.keys(patch) as Array<keyof LensFilters>) {
      const value = patch[key]
      if (value) next.set(PARAMS[key], value)
      else next.delete(PARAMS[key])
    }
    setParams(next, { replace: true })
  }

  return { filters, setFilters }
}
