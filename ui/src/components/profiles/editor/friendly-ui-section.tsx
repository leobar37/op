/**
 * Friendly UI Section
 * Left column with environment variables and info tabs
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EnvEditorSection } from './env-editor-section';
import { InfoSection } from './info-section';
import { useTranslation } from 'react-i18next';
import type { Settings, SettingsResponse } from './types';
import type { CliTarget } from '@/lib/api-client';

interface FriendlyUISectionProps {
  profileName: string;
  target: CliTarget;
  data: SettingsResponse | undefined;
  currentSettings: Settings | undefined;
  newEnvKey: string;
  newEnvValue: string;
  onNewEnvKeyChange: (key: string) => void;
  onNewEnvValueChange: (value: string) => void;
  onEnvValueChange: (key: string, value: string) => void;
  onAddEnvVar: () => void;
}

export function FriendlyUISection({
  profileName,
  target,
  data,
  currentSettings,
  newEnvKey,
  newEnvValue,
  onNewEnvKeyChange,
  onNewEnvValueChange,
  onEnvValueChange,
  onAddEnvVar,
}: FriendlyUISectionProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full w-full min-w-0 flex flex-col">
      <Tabs defaultValue="env" className="h-full w-full min-w-0 flex flex-col">
        <div className="px-4 pt-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="env" className="flex-1">
              {t('settingsDialog.envTab')}
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              Info &amp; Usage
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <TabsContent
            value="env"
            className="flex-1 mt-0 border-0 p-0 data-[state=inactive]:hidden flex flex-col overflow-hidden min-w-0"
          >
            <EnvEditorSection
              currentSettings={currentSettings}
              newEnvKey={newEnvKey}
              newEnvValue={newEnvValue}
              onNewEnvKeyChange={onNewEnvKeyChange}
              onNewEnvValueChange={onNewEnvValueChange}
              onEnvValueChange={onEnvValueChange}
              onAddEnvVar={onAddEnvVar}
            />
          </TabsContent>

          <TabsContent
            value="info"
            className="h-full mt-0 border-0 p-0 data-[state=inactive]:hidden"
          >
            <InfoSection profileName={profileName} target={target} data={data} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
