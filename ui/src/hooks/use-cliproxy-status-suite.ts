/**
 * useCliproxyStatusSuite
 *
 * Aggregates all React Query hooks needed for CLIProxy status widgets.
 * Pure data plumbing — no UI. Any component can consume it.
 * React Query cache is the global state; this hook is just a convenience facade.
 */

import { useQuery, useIsMutating } from '@tanstack/react-query';
import { api, type CliproxyServerConfig } from '@/lib/api-client';
import {
  useProxyStatus,
  useStartProxy,
  useStopProxy,
  useCliproxyUpdateCheck,
  useCliproxyVersions,
  useInstallVersion,
  useRestartProxy,
  useCliproxyRoutingStrategy,
  useCliproxySessionAffinity,
  useUpdateCliproxyRoutingStrategy,
  useUpdateCliproxySessionAffinity,
} from '@/hooks/use-cliproxy';
import { useSyncStatus, useExecuteSync } from '@/hooks/use-cliproxy-sync';

export function useCliproxyStatusSuite() {
  const { data: status, isLoading } = useProxyStatus();
  const { data: updateCheck } = useCliproxyUpdateCheck();
  const { data: versionsData, isLoading: versionsLoading } = useCliproxyVersions();
  const {
    data: routingState,
    isLoading: routingLoading,
    error: routingError,
  } = useCliproxyRoutingStrategy();
  const updateRouting = useUpdateCliproxyRoutingStrategy();
  const {
    data: sessionAffinityState,
    isLoading: sessionAffinityLoading,
    error: sessionAffinityError,
  } = useCliproxySessionAffinity();
  const updateSessionAffinity = useUpdateCliproxySessionAffinity();
  const startProxy = useStartProxy();
  const stopProxy = useStopProxy();
  const restartProxy = useRestartProxy();
  const installVersion = useInstallVersion();
  const { data: syncStatus } = useSyncStatus();
  const { mutate: executeSync, isPending: isSyncing } = useExecuteSync();

  const { data: cliproxyConfig } = useQuery<CliproxyServerConfig>({
    queryKey: ['cliproxy-server-config'],
    queryFn: () => api.cliproxyServer.get(),
    staleTime: 30000,
  });

  const isBackendSwitching = useIsMutating({ mutationKey: ['update-backend'] }) > 0;

  const isRunning = status?.running ?? false;
  const isActioning =
    startProxy.isPending ||
    stopProxy.isPending ||
    restartProxy.isPending ||
    installVersion.isPending ||
    isBackendSwitching ||
    isSyncing;

  const isSavingRoutingConfig = updateRouting.isPending || updateSessionAffinity.isPending;
  const routingConfigError = routingError instanceof Error ? routingError : null;

  const remoteConfig = cliproxyConfig?.remote;
  const isRemoteMode = remoteConfig?.enabled && remoteConfig?.host;

  const effectiveSessionAffinityState =
    sessionAffinityState ??
    (sessionAffinityError instanceof Error
      ? {
          source: 'unsupported' as const,
          target: (routingState?.target ?? (isRemoteMode ? 'remote' : 'local')) as
            | 'local'
            | 'remote',
          reachable: false,
          manageable: false,
          message: sessionAffinityError.message,
        }
      : undefined);

  return {
    // Queries
    status,
    isLoading,
    updateCheck,
    versionsData,
    versionsLoading,
    routingState,
    routingLoading,
    routingError: routingConfigError,
    sessionAffinityState: effectiveSessionAffinityState,
    sessionAffinityLoading,
    syncStatus,
    cliproxyConfig,
    isRemoteMode,
    remoteConfig,

    // Derived state
    isRunning,
    isActioning,
    isSavingRoutingConfig,
    isSyncing,
    isBackendSwitching,

    // Mutations
    startProxy,
    stopProxy,
    restartProxy,
    installVersion,
    executeSync,
    updateRouting,
    updateSessionAffinity,
  };
}
