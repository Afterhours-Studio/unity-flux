import { useQuery } from '@tanstack/react-query'
import { search, type SearchResults } from '@/lib/supabase-data'

export function useSearch(query: string) {
  return useQuery<SearchResults>({
    queryKey: ['search', query],
    queryFn: () => search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
