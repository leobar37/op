/**
 * CLIProxy Header Status
 *
 * Compact inline badge + popover for the global layout header.
 * Inline: dot + label + version + port
 * Popover: sessions, uptime, sync, routing, and all actions.
 */

import { useState } from 'react';
import {
  Power,
  RefreshCw,
  Clock,
  Users,
  Square,
  RotateCw,
  ArrowUp,
  ArrowDown,
  Globe,
  AlertTriangle,
  Download,
  FileDown,
  Check,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trans, useTranslation } from 'react-i18next';
import { useCliproxyStatusSuite } from '@/hooks/use-cliproxy-status-suite';
import { cn } from '@/lib/utils';
import {
  isCliproxyVersionExperimental,
  isCliproxyVersionInRange,
} from '@/lib/cliproxy-version-risk';
import { RoutingGuidanceCard } from '@/components/cliproxy/routing-guidance-card';

type PendingInstallRisk = 'faulty' | 'experimental';

function formatUptime(startedAt?: string): string {
  if (!startedAt) return '';
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(
  timestamp: number | undefined,
  t: (key: string, opts?: { count?: number }) => string
): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (minutes < 1) return t('proxyStatusWidget.justNow');
  if (minutes < 60) return t('proxyStatusWidget.minutesAgo', { count: minutes });
  return t('proxyStatusWidget.hoursAgo', { count: hours });
}

export function CliproxyHeaderStatus() {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [showUnstableConfirm, setShowUnstableConfirm] = useState(false);
  const [pendingInstallVersion, setPendingInstallVersion] = useState<string | null>(null);
  const [pendingInstallRisk, setPendingInstallRisk] = useState<PendingInstallRisk | null>(null);

  const suite = useCliproxyStatusSuite();
  const {
    status,
    isLoading,
    updateCheck,
    versionsData,
    versionsLoading,
    routingState,
    routingLoading,
    routingError,
    sessionAffinityState,
    sessionAffinityLoading,
    syncStatus,
    isRemoteMode,
    remoteConfig,
    isRunning,
    isActioning,
    isSavingRoutingConfig,
    isSyncing,
    startProxy,
    stopProxy,
    restartProxy,
    installVersion,
    executeSync,
    updateRouting,
    updateSessionAffinity,
  } = suite;

  const hasUpdate = updateCheck?.hasUpdate ?? false;
  const isUnstable = updateCheck?.isStable === false;
  const currentVersion = updateCheck?.currentVersion;
  const isSyncConfigured = syncStatus?.configured ?? false;
  const syncStatusText = isSyncConfigured
    ? t('proxyStatusWidget.syncReady')
    : t('proxyStatusWidget.noConfig');

  const targetVersion = isUnstable
    ? updateCheck?.maxStableVersion || versionsData?.latestStable
    : updateCheck?.latestVersion;
  const maxStableVersion =
    versionsData?.maxStableVersion || updateCheck?.maxStableVersion || '6.6.80';
  const faultyRange = versionsData?.faultyRange;
  const faultyRangeLabel =
    faultyRange &&
    `${faultyRange.min.replace(/-\d+$/, '')}-${faultyRange.max.replace(/-\d+$/, '')}`;

  const queueInstallConfirmation = (version: string, risk: PendingInstallRisk) => {
    setPendingInstallVersion(version);
    setPendingInstallRisk(risk);
    setShowUnstableConfirm(true);
  };

  const handleInstallVersion = async (version: string) => {
    if (!version) return;
    const isVersionExperimental = isCliproxyVersionExperimental(version, maxStableVersion);
    const isVersionFaulty =
      faultyRange !== undefined &&
      isCliproxyVersionInRange(version, faultyRange.min, faultyRange.max);

    if (isVersionFaulty) {
      queueInstallConfirmation(version, 'faulty');
      return;
    }
    if (isVersionExperimental) {
      queueInstallConfirmation(version, 'experimental');
      return;
    }
    try {
      const result = await installVersion.mutateAsync({ version });
      if (result.requiresConfirmation) {
        queueInstallConfirmation(version, result.isFaulty ? 'faulty' : 'experimental');
      }
    } catch {
      // Hook-level onError already reports install failures.
    }
  };

  const handleConfirmUnstableInstall = () => {
    if (pendingInstallVersion) {
      installVersion.mutate({ version: pendingInstallVersion, force: true });
    }
    setShowUnstableConfirm(false);
    setPendingInstallVersion(null);
    setPendingInstallRisk(null);
  };

  const handleCancelUnstableInstall = () => {
    setShowUnstableConfirm(false);
    setPendingInstallVersion(null);
    setPendingInstallRisk(null);
  };

  // Remote display host
  const remoteDisplayHost = isRemoteMode
    ? (() => {
        const protocol = remoteConfig?.protocol || 'http';
        const port = remoteConfig?.port || (protocol === 'https' ? 443 : 80);
        const isDefaultPort =
          (protocol === 'https' && port === 443) || (protocol === 'http' && port === 80);
        return isDefaultPort ? remoteConfig?.host : `${remoteConfig?.host}:${port}`;
      })()
    : null;

  // Inline badge content
  const inlineLabel = updateCheck?.backendLabel ?? 'CLIProxy';
  const inlinePort = isRunning && status?.port ? `:${status.port}` : '';

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/50',
              isRunning ? 'border-green-500/30 bg-green-500/5' : 'border-muted bg-muted/30'
            )}
          >
            {/* Status dot */}
            <div
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
              )}
            />
            <span className="font-medium text-sm hidden sm:inline">{inlineLabel}</span>
            {currentVersion && (
              <span
                className={cn(
                  'text-xs font-mono text-muted-foreground hidden md:inline',
                  isUnstable && 'text-amber-600 dark:text-amber-400'
                )}
              >
                v{currentVersion}
              </span>
            )}
            {inlinePort && (
              <span className="text-xs font-mono text-muted-foreground hidden lg:inline">
                {inlinePort}
              </span>
            )}
            {(hasUpdate || isUnstable) && targetVersion && (
              <Badge
                variant="secondary"
                className={cn(
                  'text-[10px] h-4 px-1 gap-0.5 hidden lg:inline-flex',
                  isUnstable
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                )}
              >
                {isUnstable ? (
                  <ArrowDown className="w-2.5 h-2.5" />
                ) : (
                  <ArrowUp className="w-2.5 h-2.5" />
                )}
                {targetVersion}
              </Badge>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-96 p-0" align="start" sideOffset={6}>
          {/* Popover Header */}
          <div className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRemoteMode ? (
                  <Globe className="w-4 h-4 text-blue-500" />
                ) : (
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      isRunning ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'
                    )}
                  />
                )}
                <span className="font-semibold text-sm">
                  {isRemoteMode ? t('proxyStatusWidget.remoteProxy') : inlineLabel}
                </span>
                {isRemoteMode && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  >
                    {t('proxyStatusWidget.active')}
                  </Badge>
                )}
              </div>
              {isLoading && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>

            {/* Version row */}
            {currentVersion && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-mono text-muted-foreground',
                    isUnstable && 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  v{currentVersion}
                </span>
                {(hasUpdate || isUnstable) && targetVersion && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] h-4 px-1.5 gap-0.5 cursor-pointer transition-colors',
                      isUnstable
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                    )}
                    onClick={() => void handleInstallVersion(targetVersion)}
                  >
                    {isUnstable ? (
                      <ArrowDown className="w-2.5 h-2.5" />
                    ) : (
                      <ArrowUp className="w-2.5 h-2.5" />
                    )}
                    {targetVersion}
                  </Badge>
                )}
              </div>
            )}

            {/* Remote host */}
            {isRemoteMode && remoteDisplayHost && (
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-mono">{remoteDisplayHost}</span>
              </div>
            )}

            {/* Stats row */}
            {!isRemoteMode && isRunning && status && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{t('proxyStatusWidget.port', { port: status.port })}</span>
                {status.sessionCount !== undefined && status.sessionCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {t('proxyStatusWidget.sessionCount', { count: status.sessionCount })}
                  </span>
                )}
                {status.startedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatUptime(status.startedAt)}
                  </span>
                )}
              </div>
            )}

            {/* Sync status */}
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {isSyncConfigured ? (
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-3 h-3 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'text-xs',
                  isSyncConfigured ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}
              >
                {syncStatusText}
              </span>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {!isRemoteMode && (
                <>
                  {isRunning ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => executeSync()}
                        disabled={!isSyncConfigured || isActioning}
                      >
                        {isSyncing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                        {t('proxyStatusWidget.tooltipSync')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => restartProxy.mutate()}
                        disabled={isActioning}
                      >
                        {restartProxy.isPending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCw className="w-3.5 h-3.5" />
                        )}
                        {t('proxyStatusWidget.tooltipRestart')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => stopProxy.mutate()}
                        disabled={isActioning}
                      >
                        {stopProxy.isPending ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        {t('proxyStatusWidget.tooltipStop')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={() => startProxy.mutate()}
                      disabled={startProxy.isPending}
                    >
                      {startProxy.isPending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Power className="w-3.5 h-3.5" />
                      )}
                      {t('proxyStatusWidget.start')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Routing */}
          {!isRemoteMode && (
            <>
              <Separator />
              <div className="p-3">
                <RoutingGuidanceCard
                  key={`local:${routingState?.strategy ?? 'round-robin'}:${sessionAffinityState?.enabled ?? 'na'}:${sessionAffinityState?.ttl ?? 'na'}:${sessionAffinityState?.manageable ?? 'na'}`}
                  compact
                  state={routingState}
                  sessionAffinityState={sessionAffinityState}
                  isLoading={routingLoading || sessionAffinityLoading}
                  isSaving={isSavingRoutingConfig}
                  error={routingError}
                  onApply={(strategy) => updateRouting.mutate(strategy)}
                  onApplyAffinity={(data) => updateSessionAffinity.mutate(data)}
                />
              </div>
            </>
          )}

          {/* Remote routing */}
          {isRemoteMode && (
            <>
              <Separator />
              <div className="p-3">
                <RoutingGuidanceCard
                  key={`remote:${routingState?.strategy ?? 'round-robin'}:${sessionAffinityState?.enabled ?? 'na'}:${sessionAffinityState?.ttl ?? 'na'}:${sessionAffinityState?.manageable ?? 'na'}`}
                  compact
                  state={routingState}
                  sessionAffinityState={sessionAffinityState}
                  isLoading={routingLoading || sessionAffinityLoading}
                  isSaving={isSavingRoutingConfig}
                  error={routingError}
                  onApply={(strategy) => updateRouting.mutate(strategy)}
                  onApplyAffinity={(data) => updateSessionAffinity.mutate(data)}
                />
              </div>
            </>
          )}

          {/* Version Management */}
          <Separator />
          <div className="p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">
              {t('proxyStatusWidget.versionManagement')}
            </h4>
            <div className="flex items-center gap-2">
              <Select
                value={selectedVersion}
                onValueChange={setSelectedVersion}
                disabled={versionsLoading}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={t('proxyStatusWidget.selectVersionPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {versionsData?.versions.slice(0, 20).map((v) => {
                    const vIsExperimental =
                      versionsData?.maxStableVersion &&
                      isCliproxyVersionExperimental(v, versionsData.maxStableVersion);
                    const vIsFaulty =
                      versionsData?.faultyRange &&
                      isCliproxyVersionInRange(
                        v,
                        versionsData.faultyRange.min,
                        versionsData.faultyRange.max
                      );
                    return (
                      <SelectItem key={v} value={v} className="text-xs">
                        <span className="flex items-center gap-2">
                          v{v}
                          {v === versionsData.latestStable && (
                            <span className="text-green-600 dark:text-green-400">
                              {t('proxyStatusWidget.stable')}
                            </span>
                          )}
                          {(vIsFaulty || vIsExperimental) && (
                            <span className="text-amber-600 dark:text-amber-400">!</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 px-3"
                onClick={() => void handleInstallVersion(selectedVersion)}
                disabled={installVersion.isPending || !selectedVersion}
              >
                {installVersion.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {t('proxyStatusWidget.install')}
              </Button>
            </div>

            {selectedVersion &&
              versionsData?.maxStableVersion &&
              isCliproxyVersionExperimental(selectedVersion, versionsData.maxStableVersion) && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {t('proxyStatusWidget.versionsAboveUnstable', {
                      version: versionsData.maxStableVersion,
                    })}
                  </span>
                </div>
              )}

            {selectedVersion &&
              versionsData?.faultyRange &&
              isCliproxyVersionInRange(
                selectedVersion,
                versionsData.faultyRange.min,
                versionsData.faultyRange.max
              ) && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {t('proxyStatusWidget.versionsKnownIssues', {
                      version: selectedVersion,
                    })}
                  </span>
                </div>
              )}

            {updateCheck?.checkedAt && (
              <div className="mt-2 text-[10px] text-muted-foreground/60">
                {t('proxyStatusWidget.lastChecked', {
                  time: formatTimeAgo(updateCheck.checkedAt, t),
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Unstable Version Confirmation Dialog */}
      <AlertDialog open={showUnstableConfirm} onOpenChange={setShowUnstableConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {pendingInstallRisk === 'faulty'
                ? t('proxyStatusWidget.installFaultyTitle')
                : t('proxyStatusWidget.installUnstableTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {pendingInstallRisk === 'faulty' ? (
                <p>
                  <Trans
                    i18nKey="proxyStatusWidget.installFaultyDesc"
                    values={{
                      version: pendingInstallVersion ?? '',
                      range: faultyRangeLabel || '',
                    }}
                    components={{ strong: <strong /> }}
                  />
                </p>
              ) : (
                <p>
                  <Trans
                    i18nKey="proxyStatusWidget.installUnstableDesc"
                    values={{
                      version: pendingInstallVersion ?? '',
                      maxStable: maxStableVersion,
                    }}
                    components={{ strong: <strong /> }}
                  />
                </p>
              )}
              <p className="text-amber-600 dark:text-amber-400">
                {pendingInstallRisk === 'faulty'
                  ? t('proxyStatusWidget.installFaultyWarning')
                  : t('proxyStatusWidget.installUnstableWarning')}
              </p>
              <p>{t('proxyStatusWidget.installUnstableConfirm')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelUnstableInstall}>
              {t('proxyStatusWidget.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnstableInstall}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {t('proxyStatusWidget.installAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
