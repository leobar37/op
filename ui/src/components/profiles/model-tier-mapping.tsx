/**
 * Model Tier Mapping Editor
 * Configure opus/sonnet/haiku model overrides
 */

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wand2, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface TierMapping {
  opus?: string;
  sonnet?: string;
  haiku?: string;
}

interface ModelTierMappingProps {
  selectedModel?: string;
  value: TierMapping;
  onChange: (mapping: TierMapping) => void;
  className?: string;
}

export function ModelTierMapping({
  selectedModel,
  value,
  onChange,
  className,
}: ModelTierMappingProps) {
  const { t } = useTranslation();

  const suggestions = useMemo(() => {
    if (!selectedModel) return {};
    return { opus: selectedModel, sonnet: selectedModel, haiku: selectedModel };
  }, [selectedModel]);

  const handleAutoSuggest = () => {
    onChange(suggestions);
  };

  const updateTier = (tier: keyof TierMapping, modelId: string) => {
    onChange({ ...value, [tier]: modelId || undefined });
  };

  const hasSuggestions = selectedModel && Object.keys(suggestions).length > 0;

  return (
    <Collapsible className={cn('group', className)}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:underline">
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
        {t('modelTierMapping.title')}
        <span className="text-muted-foreground font-normal">
          ({t('modelTierMapping.advanced')})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        <p className="text-muted-foreground text-sm">{t('modelTierMapping.description')}</p>

        {hasSuggestions && (
          <Button type="button" variant="outline" size="sm" onClick={handleAutoSuggest}>
            <Wand2 className="mr-1 h-4 w-4" />
            {t('modelTierMapping.autoSuggest', { provider: selectedModel?.split('/')[0] })}
          </Button>
        )}

        <div className="grid gap-3">
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label htmlFor="tier-opus" className="text-right">
              Opus
            </Label>
            <Input
              id="tier-opus"
              value={value.opus ?? ''}
              onChange={(e) => updateTier('opus', e.target.value)}
              placeholder={t('modelTierMapping.opusPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label htmlFor="tier-sonnet" className="text-right">
              Sonnet
            </Label>
            <Input
              id="tier-sonnet"
              value={value.sonnet ?? ''}
              onChange={(e) => updateTier('sonnet', e.target.value)}
              placeholder={t('modelTierMapping.sonnetPlaceholder')}
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <Label htmlFor="tier-haiku" className="text-right">
              Haiku
            </Label>
            <Input
              id="tier-haiku"
              value={value.haiku ?? ''}
              onChange={(e) => updateTier('haiku', e.target.value)}
              placeholder={t('modelTierMapping.haikuPlaceholder')}
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">{t('modelTierMapping.footer')}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}
