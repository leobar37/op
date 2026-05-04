/**
 * Vitest Setup
 * Global test configuration and matchers
 */

import '../../src/lib/i18n';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Mock matchMedia for components that use media queries
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver with a constructible class for Radix/Floating UI usage
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.subtle for SHA-256 hashing in tests
// Uses a simple deterministic hash for test predictability
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn(async (algorithm: string, data: ArrayBuffer) => {
        if (algorithm !== 'SHA-256') {
          throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
        const bytes = new Uint8Array(data);
        // Simple deterministic hash for tests: XOR fold into 32 bytes
        const hash = new Uint8Array(32);
        for (let i = 0; i < bytes.length; i++) {
          hash[i % 32] ^= bytes[i];
        }
        return hash.buffer;
      }),
    },
  },
});
