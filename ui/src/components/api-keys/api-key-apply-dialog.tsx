import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { useApplyApiKey } from '@/hooks/use-api-keys';
import type { ApiKeyProfile } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';

interface ApiKeyApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ApiKeyProfile | null;
}

export function ApiKeyApplyDialog({ open, onOpenChange, profile }: ApiKeyApplyDialogProps) {
  const { t } = useTranslation();
  const applyMutation = useApplyApiKey();

  const [target, setTarget] = useState<'claude' | 'droid'>('droid');
  const [strategy, setStrategy] = useState<'direct' | 'proxy'>('direct');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    applyMutation.mutate(
      {
        id: profile.id,
        data: { target, strategy },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('apiKeys.applyDialog.title', { id: profile.id })}</DialogTitle>
            <DialogDescription>{t('apiKeys.applyDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('apiKeys.applyDialog.target')}</label>
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

            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('apiKeys.applyDialog.strategy')}</label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as 'direct' | 'proxy')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="proxy">Proxy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              {strategy === 'direct'
                ? t('apiKeys.applyDialog.directHint')
                : t('apiKeys.applyDialog.proxyHint')}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={applyMutation.isPending}>
              {applyMutation.isPending ? t('common.applying') : t('apiKeys.applyDialog.apply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
