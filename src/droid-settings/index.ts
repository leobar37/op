import type {
  DroidCustomModel,
  DroidManagedModelRef,
  DroidSettings,
  DroidSettingsStoreOptions,
  ReadRawResult,
  WriteRawResult,
} from './types';
import { DroidCustomModelSchema } from './types';
import {
  readDroidSettings,
  readDroidSettingsSync,
  writeDroidSettings,
  writeDroidSettingsSync,
  readRaw,
  readRawSync,
  writeRaw,
  writeRawSync,
} from './io';
import {
  listModels,
  listModelsSync,
  listCcsModels,
  listCcsModelsSync,
  getModel,
  getModelSync,
  addModel,
  updateModel,
  removeModel,
  removeModelByIndex,
  setActiveModel,
  pruneOrphanedModels,
} from './models';
import {
  validateProfileName,
  validateCustomModel,
  validateCustomModelPartial,
  computeModelHash,
} from './validation';
import { applyReasoningOverride } from './reasoning';
import { resolveDroidConfigPaths, getFactoryDir, getSettingsPath } from './paths';

export {
  DroidCustomModelSchema,
  validateProfileName,
  validateCustomModel,
  validateCustomModelPartial,
  computeModelHash,
  applyReasoningOverride,
  resolveDroidConfigPaths,
  getFactoryDir,
  getSettingsPath,
  readDroidSettings,
  readDroidSettingsSync,
  writeDroidSettings,
  writeDroidSettingsSync,
  readRaw,
  readRawSync,
  writeRaw,
  writeRawSync,
  listModels,
  listModelsSync,
  listCcsModels,
  listCcsModelsSync,
  getModel,
  getModelSync,
  addModel,
  updateModel,
  removeModel,
  removeModelByIndex,
  setActiveModel,
  pruneOrphanedModels,
};

// Legacy aliases for backward compatibility
export { addModel as upsertCcsModel };
export { removeModel as removeCcsModel };

export type {
  DroidCustomModel,
  DroidManagedModelRef,
  DroidSettings,
  DroidSettingsStoreOptions,
  ReadRawResult,
  WriteRawResult,
};

export class DroidSettingsStore {
  private options: DroidSettingsStoreOptions;

  constructor(options: DroidSettingsStoreOptions = {}) {
    this.options = options;
  }

  read(): Promise<DroidSettings> {
    return readDroidSettings(this.options);
  }

  readSync(): DroidSettings {
    return readDroidSettingsSync(this.options);
  }

  write(settings: DroidSettings): Promise<void> {
    return writeDroidSettings(settings, this.options);
  }

  writeSync(settings: DroidSettings): void {
    writeDroidSettingsSync(settings, this.options);
  }

  listModels(): Promise<DroidCustomModel[]> {
    return listModels(this.options);
  }

  listModelsSync(): DroidCustomModel[] {
    return listModelsSync(this.options);
  }

  getModel(profile: string): Promise<DroidCustomModel | null> {
    return getModel(profile, this.options);
  }

  getModelSync(profile: string): DroidCustomModel | null {
    return getModelSync(profile, this.options);
  }

  addModel(profile: string, model: DroidCustomModel): Promise<DroidManagedModelRef> {
    return addModel(profile, model, this.options);
  }

  updateModel(profile: string, patch: Partial<DroidCustomModel>): Promise<DroidManagedModelRef> {
    return updateModel(profile, patch, this.options);
  }

  removeModel(profile: string): Promise<void> {
    return removeModel(profile, this.options);
  }

  removeModelByIndex(index: number): Promise<void> {
    return removeModelByIndex(index, this.options);
  }

  setActiveModel(selector: string): Promise<void> {
    return setActiveModel(selector, this.options);
  }

  pruneOrphanedModels(activeProfiles: string[]): Promise<number> {
    return pruneOrphanedModels(activeProfiles, this.options);
  }

  readRaw(): Promise<ReadRawResult> {
    return readRaw(this.options);
  }

  readRawSync(): ReadRawResult {
    return readRawSync(this.options);
  }

  writeRaw(text: string, expectedMtime?: number): Promise<WriteRawResult> {
    return writeRaw(text, expectedMtime, this.options);
  }

  writeRawSync(text: string, expectedMtime?: number): WriteRawResult {
    return writeRawSync(text, expectedMtime, this.options);
  }
}
