import { useQuery } from '@tanstack/react-query';
import { getGraph } from '../services/api';

/**
 * Custom hook to fetch and manage graph data for a repository.
 * Wraps React Query for caching, refetching, and loading states.
 *
 * @param {string} repoId - MongoDB ObjectId of the repo.
 * @returns {{ nodes: Array, edges: Array, isLoading: boolean, isError: boolean, error: Error, refetch: Function }}
 */
export default function useGraph(repoId) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['graph', repoId],
    queryFn: () => getGraph(repoId),
    enabled: !!repoId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    nodes: data?.nodes || [],
    edges: data?.edges || [],
    isLoading,
    isError,
    error,
    refetch,
  };
}
