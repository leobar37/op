/**
 * CLIProxy Providers Page - Global provider cards view
 * Shows all CLIProxy providers as cards, with model selection
 * and Droid JSON export integration
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Server,
  Zap,
  Rocket,
  AlertTriangle,
} from 'lucide-react';
import { ProviderLogo } from '@/components/cliproxy/provider-logo';
import { CodeEditor } from '@/components/shared/code-editor';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  useCliproxyGlobalProviders,
  useCliproxyProvidersConfig,
  useCliproxyProviderModels,
} from '@/hooks/use-cliproxy-providers';
import { useDroid } from '@/hooks/use-droid';
import type { DroidCustomModelEntry } from '@/lib/api-client';
import { resolveDroidProviderForModel } from '@/lib/provider-mapping';
import { computeModelHash } from '@/lib/hash';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

function ProviderCard({
  provider,
  isSelected,
  onSelect,
}: {
  provider: {
    provider: string;
    displayName: string;
    authenticated: boolean;
    accountCount: number;
    modelCount: number;
  };
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-all cursor-pointer',
        isSelected
          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
          : 'border-border/60 bg-card hover:bg-muted/50 hover:border-border'
      )}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo provider={provider.provider} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{provider.displayName}</span>
            {provider.authenticated ? (
              <Badge
                variant="default"
                className="text-[10px] h-4 px-1.5 bg-green-600 hover:bg-green-600"
              >
                <Check className="w-2.5 h-2.5 mr-0.5" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Not connected
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{provider.accountCount} account(s)</span>
            <span>{provider.modelCount} model(s)</span>
          </div>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground shrink-0 transition-transform',
            isSelected && 'rotate-90 text-primary'
          )}
        />
      </div>
    </button>
  );
}

function ModelCard({
  model,
  isSelected,
  onSelect,
}: {
  model: { id: string; name: string; source?: 'live' | 'catalog' };
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer',
        isSelected
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/40 bg-background hover:bg-muted/30'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate flex-1">{model.id}</span>
        {model.source === 'catalog' && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
            Catalog
          </Badge>
        )}
        {model.source === 'live' && (
          <Badge
            variant="default"
            className="text-[9px] h-4 px-1 shrink-0 bg-green-600 hover:bg-green-600"
          >
            Live
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate">{model.name}</div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

// localStorage helpers for tracking applied models
const APPLIED_HASH_KEY = 'ccs:droid-applied-hash';

function getAppliedHash(provider: string, modelId: string): string | null {
  try {
    const stored = localStorage.getItem(APPLIED_HASH_KEY);
    if (!stored) return null;
    const map = JSON.parse(stored) as Record<string, string>;
    return map[`${provider}:${modelId}`] ?? null;
  } catch {
    return null;
  }
}

function setAppliedHash(provider: string, modelId: string, hash: string): void {
  try {
    const stored = localStorage.getItem(APPLIED_HASH_KEY);
    const map = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    map[`${provider}:${modelId}`] = hash;
    localStorage.setItem(APPLIED_HASH_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function CliproxyProvidersPage() {
  const { t } = useTranslation();
  const {
    data: providersData,
    isLoading: providersLoading,
    isFetching: providersFetching,
    refetch: refetchProviders,
  } = useCliproxyGlobalProviders();
  const { data: configData } = useCliproxyProvidersConfig();
  const { applyModelAsync, isApplyingModel } = useDroid();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('ccs-internal-managed');
  const [noImageSupport, setNoImageSupport] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [hasCopied, setHasCopied] = useState(false);
  const [appliedHashVersion, setAppliedHashVersion] = useState(0);

  const {
    data: modelsData,
    isLoading: modelsLoading,
    isError: modelsError,
  } = useCliproxyProviderModels(selectedProvider || '');

  const providers = providersData?.providers || [];

  const selectedProviderData = providers.find((p) => p.provider === selectedProvider);

  const baseUrl = useMemo(() => {
    if (!configData?.baseUrl || !selectedProvider) return '';
    return `${configData.baseUrl}/api/provider/${selectedProvider}`;
  }, [configData, selectedProvider]);

  const generatedEntry = useMemo(() => {
    if (!selectedProvider || !selectedModel || !baseUrl) return null;

    const entry: DroidCustomModelEntry = {
      model: selectedModel,
      id: `custom:${selectedProvider.toUpperCase()}:${selectedModel}`,
      index: modelIndex,
      baseUrl,
      apiKey,
      displayName: displayName || selectedModel,
      noImageSupport,
      provider: resolveDroidProviderForModel(selectedProvider, selectedModel),
    };

    return entry;
  }, [selectedProvider, selectedModel, baseUrl, apiKey, displayName, noImageSupport, modelIndex]);

  const generatedJson = useMemo(() => {
    if (!generatedEntry) return '';
    return JSON.stringify(generatedEntry, null, 2);
  }, [generatedEntry]);

  // Async hash computation to match server-side SHA-256
  const [currentHash, setCurrentHash] = useState('');
  const [hashReady, setHashReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const updateHash = async () => {
      if (!generatedEntry) {
        setCurrentHash('');
        setHashReady(true);
        return;
      }
      setHashReady(false);
      const hash = await computeModelHash(generatedEntry as unknown as Record<string, unknown>);
      if (!cancelled) {
        setCurrentHash(hash);
        setHashReady(true);
      }
    };
    void updateHash();
    return () => {
      cancelled = true;
    };
  }, [generatedEntry]);

  const appliedHash = useMemo(() => {
    if (!selectedProvider || !selectedModel) return null;
    return getAppliedHash(selectedProvider, selectedModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, selectedModel, appliedHashVersion]);

  const applyState = useMemo(() => {
    if (!hashReady || !currentHash) return 'not-applied';
    if (!appliedHash) return 'not-applied';
    if (appliedHash === currentHash) return 'applied';
    return 'modified';
  }, [appliedHash, currentHash, hashReady]);

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
    setDisplayName('');
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setDisplayName(modelId);
  };

  const handleCopyJson = () => {
    if (!generatedJson) return;
    navigator.clipboard.writeText(generatedJson);
    setHasCopied(true);
    toast.success(t('cliproxyProviders.copied'));
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleApplyToDroid = async () => {
    if (!generatedEntry || !selectedProvider || !selectedModel) return;
    try {
      const result = await applyModelAsync({
        entry: generatedEntry as unknown as Record<string, unknown>,
        hash: currentHash,
      });
      setAppliedHash(selectedProvider, selectedModel, result.meta.appliedHash);
      setAppliedHashVersion((v) => v + 1);
      toast.success(t('cliproxyProviders.appliedToDroid'));
    } catch (error) {
      toast.error((error as Error).message || t('cliproxyProviders.applyFailed'));
    }
  };

  const handleRefresh = () => {
    void refetchProviders();
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left Sidebar - Provider Cards */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <h1 className="font-semibold">{t('cliproxyProviders.title')}</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={providersFetching}
            >
              <RefreshCw className={cn('w-4 h-4', providersFetching && 'animate-spin')} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('cliproxyProviders.subtitle')}</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {providersLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </>
            ) : providers.length === 0 ? (
              <EmptyState message={t('cliproxyProviders.noProviders')} />
            ) : (
              providers.map((provider) => (
                <ProviderCard
                  key={provider.provider}
                  provider={provider}
                  isSelected={selectedProvider === provider.provider}
                  onSelect={() => handleProviderSelect(provider.provider)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Model Selection & JSON Export */}
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden bg-background">
        {!selectedProvider ? (
          <EmptyState message={t('cliproxyProviders.selectProviderPrompt')} />
        ) : (
          <div className="flex h-full">
            {/* Middle Panel - Models */}
            <div className="w-72 border-r flex flex-col bg-muted/20">
              <div className="p-4 border-b bg-background">
                <div className="flex items-center gap-2">
                  <ProviderLogo provider={selectedProvider} size="md" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm">
                      {selectedProviderData?.displayName || selectedProvider}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {modelsData?.models?.length || 0} models
                      </p>
                      {modelsData?.models && modelsData.models.length > 0 && (
                        <>
                          {modelsData.models.some((m) => m.source === 'live') ? (
                            <Badge
                              variant="default"
                              className="text-[9px] h-4 px-1 bg-green-600 hover:bg-green-600"
                            >
                              Live
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              Catalog
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-1.5">
                  {modelsLoading ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </>
                  ) : modelsError ? (
                    <div className="p-4 text-sm text-destructive text-center">
                      {t('cliproxyProviders.modelsError')}
                    </div>
                  ) : modelsData?.models?.length === 0 ? (
                    <EmptyState message={t('cliproxyProviders.noModels')} />
                  ) : (
                    modelsData?.models?.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        isSelected={selectedModel === model.id}
                        onSelect={() => handleModelSelect(model.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Panel - JSON Configuration */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-4 border-b bg-background">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('cliproxyProviders.integrationConfig')}</h3>
                  {selectedModel && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedModel}
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">
                  {/* Proxy API URL */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        {t('cliproxyProviders.proxyApiUrl')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md truncate">
                          {baseUrl || t('cliproxyProviders.selectProviderFirst')}
                        </code>
                        {baseUrl && <CopyButton value={baseUrl} size="sm" variant="outline" />}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Form */}
                  {selectedModel && (
                    <>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-primary" />
                            {t('cliproxyProviders.modelSettings')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('cliproxyProviders.displayName')}
                              </label>
                              <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder={selectedModel}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('cliproxyProviders.apiKey')}
                              </label>
                              <Input
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="ccs-internal-managed"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('cliproxyProviders.index')}
                              </label>
                              <Input
                                type="number"
                                value={modelIndex}
                                onChange={(e) => setModelIndex(Number(e.target.value))}
                                min={0}
                              />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                              <Switch
                                checked={noImageSupport}
                                onCheckedChange={setNoImageSupport}
                              />
                              <label className="text-sm text-muted-foreground">
                                {t('cliproxyProviders.noImageSupport')}
                              </label>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* JSON Preview */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <ExternalLink className="h-4 w-4 text-primary" />
                              {t('cliproxyProviders.droidJsonPreview')}
                              {applyState === 'applied' && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] h-5 px-1.5 bg-green-600 hover:bg-green-600"
                                >
                                  <Check className="w-3 h-3 mr-0.5" />
                                  {t('cliproxyProviders.applied')}
                                </Badge>
                              )}
                              {applyState === 'modified' && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 px-1.5 border-amber-500 text-amber-600"
                                >
                                  <AlertTriangle className="w-3 h-3 mr-0.5" />
                                  {t('cliproxyProviders.modified')}
                                </Badge>
                              )}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={applyState === 'applied' ? 'outline' : 'default'}
                                onClick={handleApplyToDroid}
                                disabled={!generatedJson || isApplyingModel}
                              >
                                {isApplyingModel ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                                    {t('cliproxyProviders.applying')}
                                  </>
                                ) : applyState === 'applied' ? (
                                  <>
                                    <Rocket className="w-3.5 h-3.5 mr-1" />
                                    {t('cliproxyProviders.reapply')}
                                  </>
                                ) : (
                                  <>
                                    <Rocket className="w-3.5 h-3.5 mr-1" />
                                    {t('cliproxyProviders.applyToDroid')}
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCopyJson}
                                disabled={!generatedJson}
                              >
                                {hasCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-1 text-green-500" />
                                    {t('cliproxyProviders.copied')}
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 mr-1" />
                                    {t('cliproxyProviders.copyJson')}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-md border overflow-hidden">
                            <CodeEditor
                              value={generatedJson || t('cliproxyProviders.selectModelPrompt')}
                              onChange={() => {}}
                              language="json"
                              readonly
                              minHeight="200px"
                            />
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {applyState === 'applied' ? (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                {t('cliproxyProviders.appliedHint')}
                              </p>
                            ) : applyState === 'modified' ? (
                              <p className="text-xs text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {t('cliproxyProviders.modifiedHint')}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {t('cliproxyProviders.droidJsonHint')}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {!selectedModel && (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('cliproxyProviders.selectModelPrompt')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
