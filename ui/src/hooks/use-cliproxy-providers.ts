/**
 * React Query hooks for CLIProxy global providers view
 * Cards layout with model selection and Droid JSON export
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useCliproxyGlobalProviders() {
  return useQuery({
    queryKey: ['cliproxy-global-providers'],
    queryFn: () => api.cliproxy.providers.list(),
    staleTime: 30000,
  });
}

export function useCliproxyProvidersConfig() {
  return useQuery({
    queryKey: ['cliproxy-providers-config'],
    queryFn: () => api.cliproxy.providers.config(),
    staleTime: 60000,
  });
}

export function useCliproxyProviderModels(provider: string) {
  return useQuery({
    queryKey: ['cliproxy-provider-models', provider],
    queryFn: () => api.cliproxy.providers.models(provider),
    enabled: !!provider,
    staleTime: 30000,
  });
}
