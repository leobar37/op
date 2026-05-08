import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@tests/setup/test-utils';

const hookState = vi.hoisted(() => ({
  providersData: {
    providers: [
      {
        provider: 'deepseek',
        displayName: 'DeepSeek',
        authenticated: false,
        accountCount: 0,
        modelCount: 3,
        secretConfigured: false,
      },
      {
        provider: 'glm',
        displayName: 'GLM',
        authenticated: false,
        accountCount: 0,
        modelCount: 4,
        secretConfigured: true,
      },
      {
        provider: 'gemini',
        displayName: 'Gemini',
        authenticated: true,
        accountCount: 1,
        modelCount: 3,
      },
      {
        provider: 'codex',
        displayName: 'Codex',
        authenticated: true,
        accountCount: 1,
        modelCount: 6,
      },
    ],
  },
  configData: { baseUrl: 'http://127.0.0.1:8317', isRemote: false, source: 'local' as const },
  modelsData: {
    provider: 'deepseek',
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat', source: 'catalog' as const }],
  },
  apiKeyData: { provider: 'deepseek', secretConfigured: false, maskedKey: null },
}));

vi.mock('@/hooks/use-cliproxy-providers', () => ({
  useCliproxyGlobalProviders: () => ({
    data: hookState.providersData,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useCliproxyProvidersConfig: () => ({
    data: hookState.configData,
  }),
  useCliproxyProviderModels: () => ({
    data: hookState.modelsData,
    isLoading: false,
    isError: false,
  }),
  useProviderApiKey: () => ({
    data: hookState.apiKeyData,
    isLoading: false,
  }),
  useSaveProviderApiKey: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      provider: 'deepseek',
      secretConfigured: true,
      maskedKey: 'sk-****xxxx',
    }),
    isPending: false,
  }),
  useClearProviderApiKey: () => ({
    mutateAsync: vi
      .fn()
      .mockResolvedValue({ provider: 'deepseek', secretConfigured: false, maskedKey: null }),
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-droid', () => ({
  useDroid: () => ({
    applyModelAsync: vi.fn().mockResolvedValue({
      meta: {
        appliedHash: 'abc123',
        ref: {
          profile: 'deepseek',
          displayName: 'DeepSeek',
          index: 0,
          selectorAlias: 'DeepSeek-0',
          selector: 'custom:DeepSeek-0',
        },
      },
    }),
    isApplyingModel: false,
  }),
}));

vi.mock('@/components/cliproxy/provider-logo', () => ({
  ProviderLogo: () => <div data-testid="provider-logo">logo</div>,
}));

vi.mock('@/components/shared/code-editor', () => ({
  CodeEditor: ({ value }: { value: string }) => <pre data-testid="code-editor">{value}</pre>,
}));

vi.mock('@/components/ui/copy-button', () => ({
  CopyButton: () => <button data-testid="copy-button">copy</button>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { CliproxyProvidersPage } from '@/pages/cliproxy-providers';

describe('CliproxyProvidersPage API Key UI', () => {
  beforeEach(() => {
    hookState.providersData = {
      providers: [
        {
          provider: 'deepseek',
          displayName: 'DeepSeek',
          authenticated: false,
          accountCount: 0,
          modelCount: 3,
          secretConfigured: false,
        },
        {
          provider: 'glm',
          displayName: 'GLM',
          authenticated: false,
          accountCount: 0,
          modelCount: 4,
          secretConfigured: true,
        },
        {
          provider: 'gemini',
          displayName: 'Gemini',
          authenticated: true,
          accountCount: 1,
          modelCount: 3,
        },
        {
          provider: 'codex',
          displayName: 'Codex',
          authenticated: true,
          accountCount: 1,
          modelCount: 6,
        },
      ],
    };
    hookState.apiKeyData = { provider: 'deepseek', secretConfigured: false, maskedKey: null };
  });

  it('shows API key input for Chinese providers', async () => {
    render(<CliproxyProvidersPage />);

    // Select DeepSeek (Chinese provider)
    const deepseekCard = screen.getByText('DeepSeek').closest('button');
    if (!deepseekCard) throw new Error('DeepSeek card not found');
    await userEvent.click(deepseekCard);

    // API key section should be visible
    expect(screen.getByPlaceholderText(/Enter your API key/)).toBeInTheDocument();
  });

  it('does not show API key input for non-Chinese providers', async () => {
    render(<CliproxyProvidersPage />);

    // Select Gemini (non-Chinese provider)
    const geminiCard = screen.getByText('Gemini').closest('button');
    if (!geminiCard) throw new Error('Gemini card not found');
    await userEvent.click(geminiCard);

    // API key section should NOT be visible
    expect(screen.queryByPlaceholderText(/Enter your API key/)).not.toBeInTheDocument();
  });

  it('shows API key input for all Chinese providers (deepseek, glm, kimi, mm)', async () => {
    const chineseProviders = [
      { provider: 'deepseek', displayName: 'DeepSeek' },
      { provider: 'glm', displayName: 'GLM' },
      { provider: 'kimi', displayName: 'Kimi' },
      { provider: 'mm', displayName: 'MiniMax' },
    ];

    for (const cp of chineseProviders) {
      hookState.providersData = {
        providers: [
          {
            provider: cp.provider,
            displayName: cp.displayName,
            authenticated: false,
            accountCount: 0,
            modelCount: 3,
            secretConfigured: false,
          },
        ],
      };
      hookState.modelsData = {
        provider: cp.provider,
        models: [
          {
            id: `${cp.provider}-model`,
            name: `${cp.displayName} Model`,
            source: 'catalog' as const,
          },
        ],
      };
      hookState.apiKeyData = { provider: cp.provider, secretConfigured: false, maskedKey: null };

      const { unmount } = render(<CliproxyProvidersPage />);

      const card = screen.getByText(cp.displayName).closest('button');
      if (!card) throw new Error(`${cp.displayName} card not found`);
      await userEvent.click(card);

      expect(screen.getByPlaceholderText(/Enter your API key/)).toBeInTheDocument();
      unmount();
    }
  });

  it('does not show API key input for non-Chinese providers (anthropic, openai, gemini, codex)', async () => {
    const nonChineseProviders = [
      { provider: 'gemini', displayName: 'Gemini' },
      { provider: 'codex', displayName: 'Codex' },
      { provider: 'claude', displayName: 'Claude' },
      { provider: 'agy', displayName: 'Antigravity' },
    ];

    for (const ncp of nonChineseProviders) {
      hookState.providersData = {
        providers: [
          {
            provider: ncp.provider,
            displayName: ncp.displayName,
            authenticated: true,
            accountCount: 1,
            modelCount: 3,
          },
        ],
      };
      hookState.modelsData = {
        provider: ncp.provider,
        models: [
          {
            id: `${ncp.provider}-model`,
            name: `${ncp.displayName} Model`,
            source: 'catalog' as const,
          },
        ],
      };

      const { unmount } = render(<CliproxyProvidersPage />);

      const card = screen.getByText(ncp.displayName).closest('button');
      if (!card) throw new Error(`${ncp.displayName} card not found`);
      await userEvent.click(card);

      expect(screen.queryByPlaceholderText(/Enter your API key/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('shows Configured badge for GLM which has secretConfigured=true', () => {
    render(<CliproxyProvidersPage />);

    expect(screen.getByText('Configured')).toBeInTheDocument();
  });

  it('shows Missing secret badge for DeepSeek which has secretConfigured=false', () => {
    render(<CliproxyProvidersPage />);

    expect(screen.getByText('Missing secret')).toBeInTheDocument();
  });

  it('masks API key input by default', async () => {
    render(<CliproxyProvidersPage />);

    const deepseekCard = screen.getByText('DeepSeek').closest('button');
    if (!deepseekCard) throw new Error('DeepSeek card not found');
    await userEvent.click(deepseekCard);

    const input = screen.getByPlaceholderText(/Enter your API key/) as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('allows toggling API key visibility', async () => {
    render(<CliproxyProvidersPage />);

    const deepseekCard = screen.getByText('DeepSeek').closest('button');
    if (!deepseekCard) throw new Error('DeepSeek card not found');
    await userEvent.click(deepseekCard);

    const input = screen.getByPlaceholderText(/Enter your API key/) as HTMLInputElement;
    expect(input.type).toBe('password');

    // Find and click the eye toggle button (it's inside the API key input wrapper)
    const toggleBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.querySelector('svg.lucide-eye, svg.lucide-eye-off'));
    if (!toggleBtn) throw new Error('Eye toggle button not found');
    await userEvent.click(toggleBtn);

    expect(input.type).toBe('text');
  });
});
