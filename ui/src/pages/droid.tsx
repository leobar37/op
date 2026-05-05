import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  FileCode2,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { useDroid, useDroidModelProxyStatus } from '@/hooks/use-droid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  buildDroidCustomModelSelector,
  DROID_REASONING_EFFORT_OPTIONS,
  type DroidSessionDefaultSettingKey,
} from '@/lib/droid-byok-custom-models';
import { useTranslation } from 'react-i18next';

const CodeEditor = lazy(() =>
  import('@/components/shared/code-editor').then((m) => ({ default: m.CodeEditor }))
);

const DROID_PROVIDER_OPTIONS = ['anthropic', 'openai', 'generic-chat-completion-api'] as const;
const SESSION_DEFAULT_KEYS = [
  'model',
  'reasoningEffort',
  'specModeModel',
  'specModeReasoningEffort',
] as const;

type ModelEntry = Record<string, unknown>;

type DroidModel = {
  index: number;
  displayName: string;
  model: string;
  provider: string;
  baseUrl: string;
  host: string | null;
  isCcsManaged: boolean;
  apiKeyPreview: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseModelEntry(rawJson: string): ModelEntry {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toPrettyJson(value: ModelEntry): string {
  return JSON.stringify(value, null, 2);
}

function setOrDelete(entry: ModelEntry, key: string, value: string | null): ModelEntry {
  const next = { ...entry };
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    delete next[key];
  } else {
    next[key] = normalized;
  }
  return next;
}

function resolveExtraArgsKey(entry: ModelEntry): 'extraArgs' | 'extra_args' {
  return Object.prototype.hasOwnProperty.call(entry, 'extra_args') ? 'extra_args' : 'extraArgs';
}

function setReasoningEffort(entry: ModelEntry, effort: string | null): ModelEntry {
  const next = { ...entry };
  const provider = asString(next.provider).toLowerCase();
  const extraArgsKey = resolveExtraArgsKey(next);
  const extraArgs = isRecord(next[extraArgsKey]) ? { ...next[extraArgsKey] } : {};
  const normalized = effort?.trim() ?? '';
  const isOff = !normalized || ['none', 'off', 'disabled', 'default', 'unset'].includes(normalized);

  if (provider === 'openai') {
    delete extraArgs.reasoning_effort;
    delete extraArgs.reasoningEffort;
    delete extraArgs.thinking;
    if (isOff) {
      delete extraArgs.reasoning;
    } else {
      extraArgs.reasoning = {
        ...(isRecord(extraArgs.reasoning) ? extraArgs.reasoning : {}),
        effort: normalized,
      };
    }
  } else if (provider === 'anthropic') {
    delete extraArgs.reasoning;
    delete extraArgs.reasoning_effort;
    delete extraArgs.reasoningEffort;
    if (isOff) {
      delete extraArgs.thinking;
    } else {
      extraArgs.thinking = {
        ...(isRecord(extraArgs.thinking) ? extraArgs.thinking : {}),
        type: 'enabled',
      };
    }
  } else {
    delete extraArgs.reasoning;
    delete extraArgs.reasoningEffort;
    delete extraArgs.thinking;
    if (isOff) {
      delete extraArgs.reasoning_effort;
    } else {
      extraArgs.reasoning_effort = normalized;
    }
  }

  if (Object.keys(extraArgs).length === 0) {
    delete next.extraArgs;
    delete next.extra_args;
  } else {
    next[extraArgsKey] = extraArgs;
  }
  return next;
}

function getReasoningEffort(entry: ModelEntry): string {
  const extraArgs = isRecord(entry.extraArgs)
    ? entry.extraArgs
    : isRecord(entry.extra_args)
      ? entry.extra_args
      : null;
  if (!extraArgs) return '';
  const reasoning = isRecord(extraArgs.reasoning) ? extraArgs.reasoning : null;
  const thinking = isRecord(extraArgs.thinking) ? extraArgs.thinking : null;
  if (typeof reasoning?.effort === 'string') return reasoning.effort;
  if (typeof extraArgs.reasoning_effort === 'string') return extraArgs.reasoning_effort;
  if (typeof extraArgs.reasoningEffort === 'string') return extraArgs.reasoningEffort;
  if (typeof thinking?.type === 'string' && thinking.type) return 'high';
  return '';
}

function getAnthropicBudgetTokens(entry: ModelEntry): string {
  const extraArgs = isRecord(entry.extraArgs)
    ? entry.extraArgs
    : isRecord(entry.extra_args)
      ? entry.extra_args
      : null;
  const thinking = extraArgs && isRecord(extraArgs.thinking) ? extraArgs.thinking : null;
  const budget = thinking?.budget_tokens ?? thinking?.budgetTokens;
  return typeof budget === 'number' && Number.isFinite(budget) ? String(budget) : '';
}

function setAnthropicBudgetTokens(entry: ModelEntry, value: string): ModelEntry {
  const next = { ...entry };
  const extraArgsKey = resolveExtraArgsKey(next);
  const extraArgs = isRecord(next[extraArgsKey]) ? { ...next[extraArgsKey] } : {};
  const thinking = isRecord(extraArgs.thinking) ? { ...extraArgs.thinking } : {};
  const raw = value.trim();
  thinking.type = 'enabled';
  if (!raw) {
    delete thinking.budget_tokens;
    delete thinking.budgetTokens;
  } else {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      thinking.budget_tokens = Math.max(1024, parsed);
      delete thinking.budgetTokens;
    }
  }
  extraArgs.thinking = thinking;
  next[extraArgsKey] = extraArgs;
  return next;
}

function getSessionDefaultValue(entry: ModelEntry, key: DroidSessionDefaultSettingKey): string {
  const settings = isRecord(entry.sessionDefaultSettings) ? entry.sessionDefaultSettings : null;
  return asString(settings?.[key]);
}

function setSessionDefaultValue(
  entry: ModelEntry,
  key: DroidSessionDefaultSettingKey,
  value: string | null
): ModelEntry {
  const next = { ...entry };
  const currentSettings = isRecord(next.sessionDefaultSettings) ? next.sessionDefaultSettings : {};
  const sessionDefaultSettings = { ...currentSettings };
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    delete sessionDefaultSettings[key];
  } else {
    sessionDefaultSettings[key] = normalized;
  }

  for (const settingKey of SESSION_DEFAULT_KEYS) {
    if (
      typeof sessionDefaultSettings[settingKey] === 'string' &&
      sessionDefaultSettings[settingKey]
    ) {
      next.sessionDefaultSettings = sessionDefaultSettings;
      return next;
    }
  }

  delete next.sessionDefaultSettings;
  return next;
}

function getModelDefaultToggleState(
  entry: ModelEntry,
  index: number,
  mode: 'droid' | 'spec'
): boolean {
  const settings = isRecord(entry.sessionDefaultSettings) ? entry.sessionDefaultSettings : null;
  const key = mode === 'droid' ? 'model' : 'specModeModel';
  const currentValue = asString(settings?.[key]);
  if (!currentValue) return false;
  const displayName = asString(entry.displayName) || asString(entry.model_display_name);
  if (!displayName) return false;
  const selector = buildDroidCustomModelSelector(displayName, index);
  console.log('[getModelDefaultToggleState]', {
    mode,
    currentValue,
    selector,
    match: currentValue === selector,
    displayName,
    index,
  });
  return currentValue === selector;
}

function setModelDefaultToggle(
  entry: ModelEntry,
  index: number,
  mode: 'droid' | 'spec',
  enabled: boolean
): ModelEntry {
  const key = mode === 'droid' ? 'model' : 'specModeModel';
  if (!enabled) {
    console.log('[setModelDefaultToggle] OFF', { mode, key });
    return setSessionDefaultValue(entry, key, null);
  }
  const displayName = asString(entry.displayName) || asString(entry.model_display_name);
  if (!displayName) return entry;
  const selector = buildDroidCustomModelSelector(displayName, index);
  console.log('[setModelDefaultToggle] ON', { mode, key, selector, displayName, index });
  return setSessionDefaultValue(entry, key, selector);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ReasoningInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="provider default"
        className="h-8 text-xs"
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-1">
        {DROID_REASONING_EFFORT_OPTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={value === option ? 'secondary' : 'outline'}
            className="h-6 px-2 text-[11px]"
            disabled={disabled}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  rawJson,
  isOpen,
  onToggle,
  onDelete,
  isDeleting,
  isSaving,
  onSave,
  modelIndex,
}: {
  model: DroidModel;
  rawJson: string;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSaving: boolean;
  onSave: (json: string) => void;
  modelIndex: number;
}) {
  const [editorValue, setEditorValue] = useState(rawJson);
  const [entry, setEntry] = useState<ModelEntry>(() => parseModelEntry(rawJson));
  const structuredJson = useMemo(() => toPrettyJson(entry), [entry]);
  const isStructuredDirty = structuredJson !== rawJson;
  const isRawDirty = editorValue !== rawJson;
  const profile = model.displayName.replace(/^CCS\s+/i, '');
  const { data: proxyStatus, isLoading: proxyStatusLoading } = useDroidModelProxyStatus(
    profile,
    model.baseUrl
  );

  useEffect(() => {
    setEditorValue(rawJson);
    setEntry(parseModelEntry(rawJson));
  }, [rawJson]);

  const handleStructuredSave = () => onSave(structuredJson);
  const handleRawSave = () => onSave(editorValue);
  const handleCancel = () => {
    setEditorValue(rawJson);
    setEntry(parseModelEntry(rawJson));
    onToggle();
  };

  const updateField = (key: string, value: string | null) => {
    setEntry((current) => setOrDelete(current, key, value));
  };
  const updateSessionDefault = (key: DroidSessionDefaultSettingKey, value: string | null) => {
    setEntry((current) => setSessionDefaultValue(current, key, value));
  };

  const showProxyStatus = proxyStatus && proxyStatus.status !== 'not-proxy';
  const provider = asString(entry.provider) || model.provider;
  const isAnthropic = provider === 'anthropic';

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">{model.displayName}</h3>
                {model.isCcsManaged && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                    CCS
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                {model.model}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {model.provider}
                </Badge>
                {proxyStatusLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                {showProxyStatus && proxyStatus.status === 'connected' && (
                  <span title={`Proxy connected on port ${proxyStatus.port}`}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  </span>
                )}
                {showProxyStatus && proxyStatus.status === 'disconnected' && (
                  <button
                    type="button"
                    onClick={() =>
                      toast.error(
                        `Proxy disconnected on port ${proxyStatus.port}. Start CLIProxy with "ccs cliproxy start" or check your configuration.`
                      )
                    }
                    title={`Proxy disconnected on port ${proxyStatus.port}. Click for help.`}
                    className="cursor-pointer"
                  >
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
                <span className="text-xs text-muted-foreground truncate">
                  {model.host || model.baseUrl}
                </span>
              </div>
              {model.apiKeyPreview && (
                <p className="text-[11px] text-muted-foreground mt-1">Key: {model.apiKeyPreview}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', isOpen && 'bg-muted opacity-100')}
              onClick={onToggle}
              title="Model settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="rounded-md border bg-muted/30 p-3">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="general" className="text-xs">
                    General
                  </TabsTrigger>
                  <TabsTrigger value="reasoning" className="text-xs">
                    Reasoning
                  </TabsTrigger>
                  <TabsTrigger value="defaults" className="text-xs">
                    Defaults
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs">
                    <FileCode2 className="h-3.5 w-3.5 mr-1" />
                    Advanced
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-3 pt-2">
                  {model.isCcsManaged && (
                    <p className="text-xs text-muted-foreground">
                      CCS-managed model identity fields are read-only. Use Advanced for low-level
                      edits.
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Display name">
                      <Input
                        value={asString(entry.displayName)}
                        onChange={(event) => updateField('displayName', event.target.value)}
                        className="h-8 text-xs"
                        disabled={model.isCcsManaged}
                      />
                    </Field>
                    <Field label="Model ID">
                      <Input
                        value={asString(entry.model)}
                        onChange={(event) => updateField('model', event.target.value)}
                        className="h-8 text-xs font-mono"
                        disabled={model.isCcsManaged}
                      />
                    </Field>
                    <Field label="Provider">
                      <Select
                        value={provider}
                        onValueChange={(next) => updateField('provider', next)}
                        disabled={model.isCcsManaged}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DROID_PROVIDER_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Base URL">
                      <Input
                        value={asString(entry.baseUrl)}
                        onChange={(event) => updateField('baseUrl', event.target.value)}
                        className="h-8 text-xs font-mono"
                        disabled={model.isCcsManaged}
                      />
                    </Field>
                  </div>
                </TabsContent>

                <TabsContent value="reasoning" className="space-y-3 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Reasoning effort">
                      <ReasoningInput
                        value={getReasoningEffort(entry)}
                        onChange={(next) =>
                          setEntry((current) => setReasoningEffort(current, next))
                        }
                      />
                    </Field>
                    {isAnthropic && (
                      <Field label="Thinking budget tokens">
                        <Input
                          type="number"
                          min={1024}
                          step={1024}
                          value={getAnthropicBudgetTokens(entry)}
                          placeholder="auto"
                          className="h-8 text-xs"
                          onChange={(event) =>
                            setEntry((current) =>
                              setAnthropicBudgetTokens(current, event.target.value)
                            )
                          }
                        />
                      </Field>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    OpenAI writes extraArgs.reasoning.effort, Anthropic writes extraArgs.thinking,
                    and generic providers write extraArgs.reasoning_effort.
                  </p>
                </TabsContent>

                <TabsContent value="defaults" className="space-y-3 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Use as default Droid model</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Use this model when running Droid sessions
                        </p>
                      </div>
                      <Switch
                        checked={getModelDefaultToggleState(entry, modelIndex, 'droid')}
                        onCheckedChange={(checked) =>
                          setEntry((current) =>
                            setModelDefaultToggle(current, modelIndex, 'droid', checked)
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Use as default Spec model</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Use this model when running Spec sessions
                        </p>
                      </div>
                      <Switch
                        checked={getModelDefaultToggleState(entry, modelIndex, 'spec')}
                        onCheckedChange={(checked) =>
                          setEntry((current) =>
                            setModelDefaultToggle(current, modelIndex, 'spec', checked)
                          )
                        }
                      />
                    </div>
                    <Field label="Droid reasoning effort">
                      <ReasoningInput
                        value={getSessionDefaultValue(entry, 'reasoningEffort')}
                        onChange={(next) => updateSessionDefault('reasoningEffort', next)}
                      />
                    </Field>
                    <Field label="Spec reasoning effort">
                      <ReasoningInput
                        value={getSessionDefaultValue(entry, 'specModeReasoningEffort')}
                        onChange={(next) => updateSessionDefault('specModeReasoningEffort', next)}
                      />
                    </Field>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="pt-2">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <CodeEditor
                      value={editorValue}
                      onChange={setEditorValue}
                      language="json"
                      minHeight="220px"
                      heightMode="content"
                    />
                  </Suspense>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRawSave}
                  disabled={isSaving || !isRawDirty}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <FileCode2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save JSON
                </Button>
                <Button
                  size="sm"
                  onClick={handleStructuredSave}
                  disabled={isSaving || !isStructuredDirty}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, action }: { message: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Bot className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  );
}

function getModelRawJsonByIndex(
  settings: Record<string, unknown> | null,
  index: number
): string | null {
  if (!settings) return null;

  for (const rootKey of ['customModels', 'custom_models'] as const) {
    const container = settings[rootKey];
    if (Array.isArray(container) && index >= 0 && index < container.length) {
      const item = container[index];
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return JSON.stringify(item, null, 2);
      }
    }
  }
  return null;
}

export function DroidPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    diagnostics,
    diagnosticsLoading,
    refetchDiagnostics,
    removeModelAsync,
    isRemovingModel,
    rawSettings,
    updateModelRawAsync,
    isUpdatingModelRaw,
  } = useDroid();

  const [openEditorIndex, setOpenEditorIndex] = useState<number | null>(null);

  const customModels = useMemo(
    () => diagnostics?.byok.customModels ?? [],
    [diagnostics?.byok.customModels]
  );

  const handleDelete = async (index: number) => {
    try {
      await removeModelAsync(index);
      toast.success(t('droidPage.modelDeleted'));
      await refetchDiagnostics();
    } catch (error) {
      toast.error((error as Error).message || t('droidPage.deleteFailed'));
    }
  };

  const handleToggleEditor = (index: number) => {
    setOpenEditorIndex((current) => (current === index ? null : index));
  };

  const handleSaveRaw = async (index: number, json: string) => {
    try {
      await updateModelRawAsync({ index, modelRawText: json });
      toast.success('Model configuration saved');
      setOpenEditorIndex(null);
      await refetchDiagnostics();
    } catch (error) {
      if ((error as Error).message.includes('changed externally')) {
        toast.error('Settings were modified externally. Please refresh and try again.');
      } else {
        toast.error((error as Error).message || 'Failed to save model configuration');
      }
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('droidPage.customModelsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('droidPage.customModelsSubtitle')}
          </p>
        </div>
        <Button onClick={() => navigate('/provider-models')}>
          <Plus className="w-4 h-4 mr-2" />
          {t('droidPage.addNewModel')}
        </Button>
      </div>

      {diagnosticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : customModels.length === 0 ? (
        <EmptyState
          message={t('droidPage.noCustomModels')}
          action={
            <Button onClick={() => navigate('/provider-models')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('droidPage.addFirstModel')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {customModels.map((model) => {
            const rawJson =
              getModelRawJsonByIndex(rawSettings?.settings ?? null, model.index) ?? '{}';
            return (
              <ModelCard
                key={model.index}
                model={model}
                rawJson={rawJson}
                isOpen={openEditorIndex === model.index}
                onToggle={() => handleToggleEditor(model.index)}
                onDelete={() => handleDelete(model.index)}
                isDeleting={isRemovingModel}
                isSaving={isUpdatingModelRaw}
                onSave={(json) => handleSaveRaw(model.index, json)}
                modelIndex={model.index}
              />
            );
          })}
        </div>
      )}

      {customModels.length > 0 && (
        <p className="text-xs text-muted-foreground text-center mt-6">
          {t('droidPage.managedByCcsHint')}{' '}
          <a
            href="https://docs.factory.ai/cli/byok/overview/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5"
          >
            BYOK docs
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </div>
  );
}
