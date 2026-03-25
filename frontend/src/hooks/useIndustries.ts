import { useState, useEffect, useCallback } from 'react'
import client from '../api/client'

export interface SubIndustryItem {
  id: string
  industry_id: string
  label: string
  sort_order: number
  is_system: boolean
}

export interface IndustryItem {
  id: string
  label: string
  sort_order: number
  is_system: boolean
  children: SubIndustryItem[]
}

// Module-level cache so multiple components don't refetch
let cachedIndustries: IndustryItem[] | null = null
let fetchPromise: Promise<IndustryItem[]> | null = null

function doFetch(): Promise<IndustryItem[]> {
  if (fetchPromise) return fetchPromise
  fetchPromise = client
    .get('/industries')
    .then((res: any) => {
      const list: IndustryItem[] = res.industries ?? res ?? []
      cachedIndustries = list
      fetchPromise = null
      return list
    })
    .catch((err: any) => {
      fetchPromise = null
      throw err
    })
  return fetchPromise
}

export function useIndustries() {
  const [industries, setIndustries] = useState<IndustryItem[]>(cachedIndustries ?? [])
  const [loading, setLoading] = useState(!cachedIndustries)

  const refresh = useCallback(() => {
    cachedIndustries = null
    fetchPromise = null
    setLoading(true)
    doFetch()
      .then((list) => setIndustries(list))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (cachedIndustries) {
      setIndustries(cachedIndustries)
      setLoading(false)
      return
    }
    doFetch()
      .then((list) => setIndustries(list))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getIndustryLabel = useCallback(
    (id: string): string => {
      return industries.find((i) => i.id === id)?.label || id
    },
    [industries],
  )

  const getSubIndustryLabel = useCallback(
    (industryId: string, subId: string): string => {
      return (
        industries
          .find((i) => i.id === industryId)
          ?.children.find((c) => c.id === subId)?.label || subId
      )
    },
    [industries],
  )

  return { industries, loading, getIndustryLabel, getSubIndustryLabel, refresh }
}
