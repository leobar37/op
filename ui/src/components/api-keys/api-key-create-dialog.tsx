import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateApiKey, useApiKeyProviders } from '@/hooks/use-api-keys';
import { useTranslation } from 'react-i18next';

interface ApiKeyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyCreateDialog({ open, onOpenChange }: ApiKeyCreateDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateApiKey();
  const { data: providersData, isLoading: providersLoading, refetch } = useApiKeyProviders();
  const availableProviders = providersData?.providers || [];

  // Force refetch when dialog opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const selectedPreset = availableProviders.find((p) => p.id === provider);

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const preset = availableProviders.find((p) => p.id === value);
    if (preset) {
      setBaseUrl(preset.baseUrl);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !apiKey) return;

    createMutation.mutate(
      {
        id: provider,
        provider,
        apiKey,
        baseUrl: baseUrl || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setProvider('');
    setApiKey('');
    setBaseUrl('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('apiKeys.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('apiKeys.createDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider selector */}
            <div className="grid gap-2">
              <Label>{t('apiKeys.createDialog.provider')}</Label>
              {providersLoading ? (
                <div className="text-sm text-muted-foreground">Loading providers...</div>
              ) : availableProviders.length === 0 ? (
                <div className="text-sm text-muted-foreground">No providers available</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableProviders.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={provider === p.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleProviderChange(p.id)}
                      className="h-auto py-1.5 px-3"
                    >
                      <span className="flex items-center gap-1.5">
                        {p.name}
                        {p.badge && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {p.badge}
                          </Badge>
                        )}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Provider info card */}
            {selectedPreset && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                <div className="font-medium">{selectedPreset.name}</div>
                <div className="text-muted-foreground">{selectedPreset.description}</div>
                {selectedPreset.apiKeyHint && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Tip:</span> {selectedPreset.apiKeyHint}
                  </div>
                )}
              </div>
            )}

            {/* API Key */}
            <div className="grid gap-2">
              <Label htmlFor="apiKey">{t('apiKeys.createDialog.apiKey')}</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedPreset?.apiKeyPlaceholder || 'sk-...'}
                required
              />
            </div>

            {/* Base URL */}
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">{t('apiKeys.createDialog.baseUrl')}</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  selectedPreset
                    ? selectedPreset.baseUrl || 'No base URL needed'
                    : 'Select a provider first'
                }
                disabled={!provider}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !provider || !apiKey}>
              {createMutation.isPending ? t('common.creating') : t('apiKeys.createDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
