import { useQuery } from '@tanstack/react-query';
import { getPRs } from '../services/api';

/**
 * Custom hook to fetch and manage PR events for a repository.
 * Wraps React Query for caching, refetching, and loading states.
 *
 * @param {string} repoId - MongoDB ObjectId of the repo.
 * @returns {{ prs: Array, isLoading: boolean, isError: boolean, error: Error, refetch: Function }}
 */
export default function usePRs(repoId) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['prs', repoId],
    queryFn: () => getPRs(repoId),
    enabled: !!repoId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  return {
    prs: data?.prs || [],
    isLoading,
    isError,
    error,
    refetch,
  };
}
