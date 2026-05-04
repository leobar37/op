import { useEffect, useState, Suspense, lazy } from 'react';
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
} from 'lucide-react';
import { useDroid, useDroidModelProxyStatus } from '@/hooks/use-droid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Lazy load CodeEditor to keep bundle minimal when editor is closed
const CodeEditor = lazy(() =>
  import('@/components/shared/code-editor').then((m) => ({ default: m.CodeEditor }))
);

function ModelCard({
  model,
  rawJson,
  isOpen,
  onToggle,
  onDelete,
  isDeleting,
  isSaving,
  onSave,
}: {
  model: {
    displayName: string;
    model: string;
    provider: string;
    baseUrl: string;
    host: string | null;
    isCcsManaged: boolean;
    apiKeyPreview: string | null;
  };
  rawJson: string;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isSaving: boolean;
  onSave: (json: string) => void;
}) {
  const [editorValue, setEditorValue] = useState(rawJson);
  const isDirty = editorValue !== rawJson;
  const profile = model.displayName.replace(/^CCS\s+/i, '');
  const { data: proxyStatus, isLoading: proxyStatusLoading } = useDroidModelProxyStatus(
    profile,
    model.baseUrl
  );

  // Reset editor value when rawJson changes externally
  useEffect(() => {
    setEditorValue(rawJson);
  }, [rawJson]);

  const handleSave = () => {
    onSave(editorValue);
  };

  const handleCancel = () => {
    setEditorValue(rawJson);
    onToggle();
  };

  const showProxyStatus = proxyStatus && proxyStatus.status !== 'not-proxy';

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
              title="Edit raw JSON"
            >
              <FileCode2 className="h-4 w-4" />
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

        {/* Collapsible JSON Editor */}
        <div
          className={cn(
            'grid transition-all duration-300 ease-in-out',
            isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
          )}
        >
          <div className="overflow-hidden">
            <div className="rounded-md border bg-muted/30">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <div className="p-3">
                  <CodeEditor
                    value={editorValue}
                    onChange={setEditorValue}
                    language="json"
                    minHeight="200px"
                    heightMode="content"
                  />
                </div>
              </Suspense>
              <div className="flex items-center justify-end gap-2 px-3 pb-3">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
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

  const customModels = diagnostics?.byok.customModels ?? [];

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
      {/* Header */}
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

      {/* Lista */}
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
              />
            );
          })}
        </div>
      )}

      {/* Footer hint */}
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
