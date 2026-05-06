/**
 * React Query hooks for API key profiles
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateApiKeyProfileRequest, type ApplyApiKeyRequest } from '@/lib/api-client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.apiKeys.list(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: CreateApiKeyProfileRequest) => api.apiKeys.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('toasts.apiKeyCreated'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => api.apiKeys.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success(t('toasts.apiKeyDeleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useApplyApiKey() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApplyApiKeyRequest }) =>
      api.apiKeys.apply(id, data),
    onSuccess: (result) => {
      toast.success(
        t('toasts.apiKeyApplied', { target: result.target, strategy: result.strategy })
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useApiKeyProviders() {
  return useQuery({
    queryKey: ['api-key-providers'],
    queryFn: () => api.apiKeys.providers(),
  });
}
