import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Trash2, Key, CheckCircle2, AlertCircle, Rocket } from 'lucide-react';
import { useApiKeys, useDeleteApiKey, useApplyApiKey } from '@/hooks/use-api-keys';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ApiKeyCreateDialog } from '@/components/api-keys/api-key-create-dialog';
import { ApiKeyApplyDialog } from '@/components/api-keys/api-key-apply-dialog';
import type { ApiKeyProfile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function ApiKeysPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useApiKeys();
  const deleteMutation = useDeleteApiKey();
  useApplyApiKey();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [applyDialog, setApplyDialog] = useState<ApiKeyProfile | null>(null);

  const profiles = data?.profiles || [];
  const filteredProfiles = profiles.filter((p) =>
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeleteConfirm(null);
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="p-4 border-b bg-background">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <div className="min-w-0">
              <h1 className="font-semibold">{t('apiKeys.title')}</h1>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('apiKeys.new')}
          </Button>
        </div>

        <p className="mb-3 text-xs leading-4 text-muted-foreground">{t('apiKeys.subtitle')}</p>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('apiKeys.searchPlaceholder')}
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">{t('apiKeys.loading')}</div>
        ) : isError ? (
          <div className="p-4 text-center">
            <div className="space-y-3 py-8">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive/50" />
              <div>
                <p className="text-sm font-medium">{t('apiKeys.failedLoadTitle')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('apiKeys.failedLoadDesc')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                {t('apiKeys.retry')}
              </Button>
            </div>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-4 text-center">
            {profiles.length === 0 ? (
              <div className="space-y-3 py-8">
                <Key className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">{t('apiKeys.noProfilesYet')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('apiKeys.noProfilesDesc')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('apiKeys.createProfile')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                {t('apiKeys.noMatch', { query: searchQuery })}
              </p>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredProfiles.map((profile) => (
              <ApiKeyListItem
                key={profile.id}
                profile={profile}
                onDelete={() => setDeleteConfirm(profile.id)}
                onApply={() => setApplyDialog(profile)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {profiles.length > 0 && (
        <div className="p-3 border-t bg-background text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>{t('apiKeys.profileCount', { count: profiles.length })}</span>
          </div>
        </div>
      )}

      <ApiKeyCreateDialog open={isCreateDialogOpen} onOpenChange={setCreateDialogOpen} />

      <ApiKeyApplyDialog
        open={!!applyDialog}
        onOpenChange={(open) => !open && setApplyDialog(null)}
        profile={applyDialog}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        title={t('apiKeys.deleteTitle')}
        description={t('apiKeys.deleteDesc', { id: deleteConfirm ?? '' })}
        confirmText={t('apiKeys.delete')}
        variant="destructive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function ApiKeyListItem({
  profile,
  onDelete,
  onApply,
}: {
  profile: ApiKeyProfile;
  onDelete: () => void;
  onApply: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2.5 rounded-md border border-transparent hover:bg-muted transition-colors'
      )}
    >
      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-medium text-sm truncate">{profile.id}</div>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
            {profile.provider}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
            {profile.target}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-xs text-muted-foreground truncate flex-1">{profile.baseUrl}</div>
          <div className="text-xs text-muted-foreground">{profile.defaultModel}</div>
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onApply();
        }}
      >
        <Rocket className="w-3.5 h-3.5 mr-1" />
        Apply
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  );
}
