import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateApiKey, useApiKeyProviders } from '@/hooks/use-api-keys';
import type { ApiKeyProviderPreset } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';

interface ApiKeyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: ApiKeyProviderPreset[];
}

export function ApiKeyCreateDialog({ open, onOpenChange, providers }: ApiKeyCreateDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateApiKey();
  const { data: providersData } = useApiKeyProviders();
  const availableProviders = providersData?.providers || providers;

  const [id, setId] = useState('');
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [target, setTarget] = useState<'claude' | 'droid'>('droid');

  const _selectedProvider = availableProviders.find((p) => p.id === provider);

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const preset = availableProviders.find((p) => p.id === value);
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setDefaultModel(preset.defaultModel);
      setId(`${value}-api`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !provider || !apiKey) return;

    createMutation.mutate(
      {
        id,
        provider,
        apiKey,
        baseUrl: baseUrl || undefined,
        defaultModel: defaultModel || undefined,
        target,
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
    setId('');
    setProvider('');
    setApiKey('');
    setBaseUrl('');
    setDefaultModel('');
    setTarget('droid');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('apiKeys.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('apiKeys.createDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">{t('apiKeys.createDialog.provider')}</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t('apiKeys.createDialog.selectProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="id">{t('apiKeys.createDialog.id')}</Label>
              <Input
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="deepseek-prod"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">{t('apiKeys.createDialog.apiKey')}</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="baseUrl">{t('apiKeys.createDialog.baseUrl')}</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">{t('apiKeys.createDialog.model')}</Label>
              <Input
                id="model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="claude-sonnet-4-5"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="target">{t('apiKeys.createDialog.target')}</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as 'claude' | 'droid')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="droid">Droid</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.creating') : t('apiKeys.createDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
