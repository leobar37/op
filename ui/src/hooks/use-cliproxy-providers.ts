/**
 * React Query hooks for CLIProxy global providers view
 * Cards layout with model selection and Droid JSON export
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useProviderApiKey(provider: string) {
  return useQuery({
    queryKey: ['provider-apikey', provider],
    queryFn: () => api.cliproxy.providers.getApiKey(provider),
    enabled: !!provider,
    staleTime: 30000,
  });
}

export function useSaveProviderApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      api.cliproxy.providers.saveApiKey(provider, apiKey),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['provider-apikey', variables.provider] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-global-providers'] });
    },
  });
}

export function useClearProviderApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: string) => api.cliproxy.providers.clearApiKey(provider),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ['provider-apikey', provider] });
      queryClient.invalidateQueries({ queryKey: ['cliproxy-global-providers'] });
    },
  });
}
