'use client';
import React, { useState } from 'react';

import {
  Upload,
  Code,
  Wand2,
  CheckCircle,
  AlertCircle,
  FileText,
  Zap,
} from 'lucide-react';
import { ComponentAnalysis, PropInfo, TestScenario } from '@/types';

export const TestGeneratorTool = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'fix'>('generate');
  const [componentCode, setComponentCode] = useState<string>('');
  const [testCode, setTestCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [generatedTest, setGeneratedTest] = useState<string>('');
  const [analysisResult, setAnalysisResult] =
    useState<ComponentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Contexto base do Jest Setup
  const jestContext = `
Configuração Jest (jest.setup.ts):
- Mocks globais: @headlessui/react, @mui/material, next/router, firebase, framer-motion
- Store mockado com useAppSelector, useAppDispatch, useAppSelectorHook
- Context mockado com user, setUser, setIsLoading, subNav, otpTFA
- localStorage/sessionStorage NÃO disponíveis (usar state)
- Ambiente: jsdom
- Testing Library disponível

Padrões de teste identificados:
1. Estrutura: describe > it com descrições claras
2. Setup com beforeEach quando necessário
3. Primeiro teste sempre: snapshot com toMatchSnapshot()
4. Queries: getByTestId, getByText, queryByText, container.querySelector
5. Interações: fireEvent e userEvent
6. Validações: toBeInTheDocument(), toHaveTextContent(), toHaveBeenCalledTimes()
7. Mocks específicos no topo do arquivo quando necessário
`;

  const analyzeComponent = (code: string): ComponentAnalysis => {
    const analysis: ComponentAnalysis = {
      componentName: '',
      props: [],
      hooks: [],
      events: [],
      dependencies: [],
      stateVariables: [],
      hasConditionalRender: false,
      testScenarios: [],
    };

    // Extrai nome do componente
    const componentMatch = code.match(
      /(?:export\s+(?:const|function)\s+|const\s+)(\w+)/,
    );
    if (componentMatch) analysis.componentName = componentMatch[1];

    // Extrai props
    const propsMatch = code.match(/interface\s+\w+Props\s*{([^}]+)}/);
    if (propsMatch) {
      const propsContent = propsMatch[1];
      const propLines = propsContent.split('\n').filter((line) => line.trim());
      propLines.forEach((line) => {
        const propMatch = line.match(/(\w+)\??:\s*([^;]+)/);
        if (propMatch) {
          analysis.props.push({
            name: propMatch[1],
            type: propMatch[2].trim(),
            optional: line.includes('?'),
          });
        }
      });
    }

    // Extrai hooks
    const hookMatches = code.matchAll(/use\w+/g);
    const hooks = new Set([...hookMatches].map((m) => m[0]));
    analysis.hooks = Array.from(hooks);

    // Extrai eventos
    const eventMatches = code.matchAll(
      /on(Click|Change|Submit|Blur|Focus|KeyDown|Paste)\s*=\s*{/g,
    );
    analysis.events = [...new Set([...eventMatches].map((m) => m[1]))];

    // Extrai state variables
    const stateMatches = code.matchAll(
      /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g,
    );
    analysis.stateVariables = [...stateMatches].map((m) => m[1]);

    // Detecta renderização condicional
    analysis.hasConditionalRender = /\?.*:|\&\&/.test(code);

    // Extrai dependências externas
    const importMatches = code.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
    analysis.dependencies = [...importMatches]
      .map((m) => m[1])
      .filter((dep) => !dep.startsWith('.') && !dep.startsWith('react'));

    // Gera cenários de teste
    analysis.testScenarios = generateTestScenarios(analysis);

    return analysis;
  };

  const generateTestScenarios = (
    analysis: ComponentAnalysis,
  ): TestScenario[] => {
    const scenarios: TestScenario[] = [
      { type: 'snapshot', description: 'Renderização com snapshot' },
    ];

    // Testes de props
    analysis.props.forEach((prop) => {
      if (prop.type.includes('function') || prop.type.includes('=>')) {
        scenarios.push({
          type: 'callback',
          description: `Teste de callback: ${prop.name}`,
          propName: prop.name,
        });
      }
      if (prop.optional) {
        scenarios.push({
          type: 'optional',
          description: `Renderização sem prop opcional: ${prop.name}`,
          propName: prop.name,
        });
      }
    });

    // Testes de eventos
    analysis.events.forEach((event) => {
      scenarios.push({
        type: 'event',
        description: `Interação: on${event}`,
        eventName: event,
      });
    });

    // Testes de estado
    if (analysis.stateVariables.length > 0) {
      scenarios.push({
        type: 'state',
        description: 'Mudanças de estado',
      });
    }

    // Testes condicionais
    if (analysis.hasConditionalRender) {
      scenarios.push({
        type: 'conditional',
        description: 'Renderização condicional',
      });
    }

    return scenarios;
  };

  const generateTestCode = (analysis: ComponentAnalysis): string => {
    const { componentName, props, events, testScenarios } = analysis;

    let testCode = `import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ${componentName} } from 'components/path/to/${componentName.toLowerCase()}'

`;

    // Adiciona mocks específicos se necessário
    if (analysis.hooks.includes('useAppSelectorHook')) {
      testCode += `// Mock específico para o useAppSelectorHook
        jest.mock('store', () => ({
          ...jest.requireActual('store'),
          useAppSelectorHook: jest.fn(() => ({
          id_categoria: 1,
          nome: 'Teste',
          email: 'teste@teste.com'
        }))
    }))
    `;
    }

    testCode += `describe('${componentName}', () => {
`;

    // Setup se necessário
    const hasCallbacks = props.some((p) => p.type.includes('function'));
    if (hasCallbacks) {
      testCode += `  let mockProps: any
  
      beforeEach(() => {
        jest.resetAllMocks()
        mockProps = {
          ${props
            .filter((p) => p.type.includes('function'))
            .map((p) => `      ${p.name}: jest.fn()`)
            .join(',\n')}
        }
      })
      `;
    }

    // Gera testes baseado nos cenários
    testScenarios.forEach((scenario: TestScenario, index: number) => {
      switch (scenario.type) {
        case 'snapshot':
          testCode += `  it('should render correctly', () => {
          const { container } = render(<${componentName} ${generatePropsString(
            props,
            false,
          )} />)
          expect(container).toMatchSnapshot()
          })
          `;

          break;

        case 'callback':
          testCode += `  it('should call ${scenario.propName} when triggered', () => {
          const { getByTestId } = render(<${componentName} {...mockProps} />)

          const element = getByTestId('test-id') // Ajuste o testId conforme necessário
          fireEvent.click(element)

          expect(mockProps.${scenario.propName}).toHaveBeenCalledTimes(1)
          })
          `;

          break;

        case 'event':
          const eventName = scenario.eventName?.toLowerCase() || 'click';
          testCode += `  it('should handle ${eventName} event correctly', () => {
          const { getByTestId } = render(<${componentName} ${generatePropsString(
            props,
          )} />)
    
          const element = getByTestId('test-id') // Ajuste o testId conforme necessário
          fireEvent.${eventName}(element${
            eventName === 'change' ? ', { target: { value: "test" } }' : ''
          })
              
          // Adicione suas assertions aqui
          })
          `;

          break;

        case 'state':
          testCode += `  it('should update state correctly', async () => {
          const { getByTestId } = render(<${componentName} ${generatePropsString(
            props,
          )} />)
          
      // Simule interação que muda o estado
          const element = getByTestId('test-id')
          fireEvent.change(element, { target: { value: 'new value' } })

          await waitFor(() => {
      // Verifique se o estado foi atualizado
            expect(element).toHaveValue('new value')
          })
        })
        `;

          break;

        case 'conditional':
          testCode += `  it('should render conditionally based on props/state', () => {
          const { queryByTestId, rerender } = render(<${componentName} ${generatePropsString(
            props,
          )} />)
    
    // Teste primeira condição
          expect(queryByTestId('conditional-element')).toBeInTheDocument()
    
    // Teste segunda condição
          rerender(<${componentName} /* altere props aqui */ />)
          expect(queryByTestId('conditional-element')).not.toBeInTheDocument()
          })
          `;

          break;
      }
    });

    testCode += `})
`;

    return testCode;
  };

  const generatePropsString = (props: PropInfo[], withMock = true): string => {
    const requiredProps = props.filter((p) => !p.optional);
    if (requiredProps.length === 0) return '';

    if (withMock) {
      return requiredProps
        .map((p) => {
          if (p.type.includes('string')) return `${p.name}="test"`;
          if (p.type.includes('number')) return `${p.name}={123}`;
          if (p.type.includes('boolean')) return `${p.name}={true}`;
          if (p.type.includes('function'))
            return `${p.name}={mockProps.${p.name}}`;
          return `${p.name}={{}}`;
        })
        .join(' ');
    }
    return ''; // Para snapshot, use props mínimas
  };

  const handleGenerate = async () => {
    if (!componentCode.trim()) {
      setErrorMessage('Por favor, cole o código do componente');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Simula processamento
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const analysis = analyzeComponent(componentCode);
      setAnalysisResult(analysis);

      const generatedCode = generateTestCode(analysis);
      setGeneratedTest(generatedCode);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      setErrorMessage('Erro ao gerar testes: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixTest = async () => {
    if (!testCode.trim() || !errorMessage.trim()) {
      setErrorMessage('Cole o código do teste e a mensagem de erro');
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Análise básica de erros comuns
      let suggestion = 'Sugestões de correção:\n\n';

      if (errorMessage.includes('toMatchSnapshot')) {
        suggestion += '✓ Erro de Snapshot:\n';
        suggestion +=
          '  - Execute: npm test -- -u (para atualizar snapshots)\n';
        suggestion +=
          '  - Verifique se houve mudanças intencionais no componente\n\n';
      }

      if (errorMessage.includes('toBeInTheDocument')) {
        suggestion += '✓ Elemento não encontrado:\n';
        suggestion += '  - Verifique o testId ou query usado\n';
        suggestion += '  - Use screen.debug() para ver o DOM renderizado\n';
        suggestion +=
          '  - Considere usar queryBy* ao invés de getBy* para elementos opcionais\n\n';
      }

      if (errorMessage.includes('act')) {
        suggestion += '✓ Warning do React (act):\n';
        suggestion += '  - Envolva código assíncrono com waitFor()\n';
        suggestion +=
          '  - Use userEvent ao invés de fireEvent quando possível\n\n';
      }

      if (errorMessage.includes('mock') || errorMessage.includes('jest.fn')) {
        suggestion += '✓ Problema com Mocks:\n';
        suggestion += '  - Verifique se resetAllMocks() está no beforeEach\n';
        suggestion += '  - Confirme se o mock está no escopo correto\n\n';
      }

      if (
        errorMessage.includes('Cannot read property') ||
        errorMessage.includes('undefined')
      ) {
        suggestion += '✓ Propriedade undefined:\n';
        suggestion +=
          '  - Verifique se todos os mocks necessários estão configurados\n';
        suggestion += '  - Adicione valores default para props opcionais\n\n';
      }

      setGeneratedTest(suggestion);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Erro desconhecido';
      setErrorMessage('Erro ao analisar: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Zap className="text-yellow-400" size={40} />
            Gerador de Testes Unitários
          </h1>
          <p className="text-purple-200">
            Crie, atualize e corrija testes seguindo seu padrão
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'generate'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Wand2 size={20} />
            Gerar Teste
          </button>
          <button
            onClick={() => setActiveTab('fix')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'fix'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <AlertCircle size={20} />
            Corrigir Erro
          </button>
        </div>

        {/* Conteúdo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Input */}
          <div className="space-y-4">
            {activeTab === 'generate' ? (
              <>
                <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                  <label className="flex items-center gap-2 text-white font-semibold mb-3">
                    <Code size={20} />
                    Código do Componente/Hook
                  </label>
                  <textarea
                    value={componentCode}
                    onChange={(e) => setComponentCode(e.target.value)}
                    placeholder="Cole aqui o código do componente ou hook que deseja testar..."
                    className="w-full h-96 bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm border border-slate-700 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>Analisando...</>
                  ) : (
                    <>
                      <Wand2 size={24} />
                      Gerar Testes
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                  <label className="flex items-center gap-2 text-white font-semibold mb-3">
                    <FileText size={20} />
                    Código do Teste Atual
                  </label>
                  <textarea
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="Cole o código do teste que está com erro..."
                    className="w-full h-48 bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm border border-slate-700 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                  <label className="flex items-center gap-2 text-white font-semibold mb-3">
                    <AlertCircle size={20} />
                    Mensagem de Erro
                  </label>
                  <textarea
                    value={errorMessage}
                    onChange={(e) => setErrorMessage(e.target.value)}
                    placeholder="Cole a mensagem de erro completa do Jest..."
                    className="w-full h-48 bg-slate-900 text-red-300 rounded-lg p-4 font-mono text-sm border border-red-900 focus:border-red-500 focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={handleFixTest}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-4 rounded-lg font-bold text-lg hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>Analisando erro...</>
                  ) : (
                    <>
                      <CheckCircle size={24} />
                      Analisar e Corrigir
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Coluna Direita - Output */}
          <div className="space-y-4">
            {analysisResult && activeTab === 'generate' && (
              <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-400" />
                  Análise do Componente
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-purple-400 font-semibold">Nome:</span>
                    <span className="text-slate-200 ml-2">
                      {analysisResult.componentName}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">
                      Props:
                    </span>
                    <span className="text-slate-200 ml-2">
                      {analysisResult.props.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">
                      Hooks:
                    </span>
                    <span className="text-slate-200 ml-2">
                      {analysisResult.hooks.join(', ') || 'Nenhum'}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">
                      Eventos:
                    </span>
                    <span className="text-slate-200 ml-2">
                      {analysisResult.events.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">
                      Cenários detectados:
                    </span>
                    <span className="text-slate-200 ml-2">
                      {analysisResult.testScenarios.length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
              <label className="flex items-center gap-2 text-white font-semibold mb-3">
                <Code size={20} className="text-green-400" />
                {activeTab === 'generate'
                  ? 'Código do Teste Gerado'
                  : 'Sugestões de Correção'}
              </label>
              <textarea
                value={generatedTest}
                readOnly
                placeholder="O resultado aparecerá aqui..."
                className="w-full h-[600px] bg-slate-900 text-green-300 rounded-lg p-4 font-mono text-sm border border-slate-700 focus:outline-none resize-none"
              />
              {generatedTest && (
                <button
                  onClick={() => {
                    copyToClipboard(generatedTest);
                    alert('Código copiado!');
                  }}
                  className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-all"
                >
                  Copiar Código
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dicas */}
        <div className="mt-8 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-700">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <FileText size={20} />
            Dicas Rápidas
          </h3>
          <ul className="text-blue-200 space-y-2 text-sm">
            <li>
              ✓ Sempre adicione data-testid nos elementos importantes para
              facilitar os testes
            </li>
            <li>✓ Use waitFor() para operações assíncronas</li>
            <li>
              ✓ Prefira userEvent sobre fireEvent para interações mais realistas
            </li>
            <li>
              ✓ Execute 'npm test -- -u' para atualizar snapshots após mudanças
              intencionais
            </li>
            <li>
              ✓ Use screen.debug() para visualizar o DOM durante o
              desenvolvimento
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
