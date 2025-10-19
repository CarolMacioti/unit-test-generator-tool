/* eslint-disable dot-notation */
import '@testing-library/jest-dom';

// Mock do Next.js Router
jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    push: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    route: '/',
    asPath: '/',
  }),
}));

// Mock do Next.js Navigation (App Router)
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock do lucide-react (ícones)
jest.mock('lucide-react', () => {
  const React = require('react');
  return {
    Upload: () => React.createElement('div', {}, 'Upload Icon'),
    Code: () => React.createElement('div', {}, 'Code Icon'),
    Wand2: () => React.createElement('div', {}, 'Wand2 Icon'),
    CheckCircle: () => React.createElement('div', {}, 'CheckCircle Icon'),
    AlertCircle: () => React.createElement('div', {}, 'AlertCircle Icon'),
    FileText: () => React.createElement('div', {}, 'FileText Icon'),
    Zap: () => React.createElement('div', {}, 'Zap Icon'),
  };
});

// Mock do matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock do URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock do document.execCommand
document.execCommand = jest.fn(() => true);

// Mock do alert
global.alert = jest.fn();

// Mock do fetch para a API de correção
global.fetch = jest.fn();

// Setup global do localStorage (será sobrescrito em cada teste)
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
};

// Aplicar mock do localStorage globalmente
Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true,
});

// Limpar mocks antes de cada teste
beforeEach(() => {
  // Recriar localStorage mock para cada teste
  Object.defineProperty(window, 'localStorage', {
    value: createLocalStorageMock(),
    writable: true,
  });

  jest.clearAllMocks();

  // Reset fetch mock
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      fixedCode: '// Código corrigido',
      suggestions: '// Sugestões',
    }),
  });
});
