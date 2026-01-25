import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
globalThis.localStorage = localStorageMock;

// Use real fetch for database loading - let tests use production database
// Tests can override this if they need to test database error scenarios
globalThis.fetch = vi.fn(async (url, options) => {
  if (url === '/ev_data.db') {
    try {
      // Read the actual database file from the public directory
      const dbPath = resolve(process.cwd(), 'public', 'ev_data.db');
      const arrayBuffer = readFileSync(dbPath).buffer;
      return {
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(arrayBuffer),
      };
    } catch (error) {
      console.error('Failed to load database file:', error);
      return {
        ok: false,
        status: 404,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      };
    }
  }
  // For other URLs, use default mock response
  return {
    ok: true,
    json: () => Promise.resolve({}),
  };
});

// Mock sql.js initialization
if (typeof window !== 'undefined') {
  window.initSqlJs = vi.fn(() => 
    Promise.resolve({
      Database: vi.fn(() => ({
        exec: vi.fn(() => []),
        close: vi.fn(),
      })),
    })
  );
}
