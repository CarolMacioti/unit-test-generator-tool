import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { TestGeneratorTool } from '../test-generator-tool';

describe('TestGeneratorTool', () => {
  it('should render correctly', () => {
    const { container } = render(<TestGeneratorTool />);
    expect(container).toMatchSnapshot();
  });

  it('should render with title "Gerador de Testes Unitários"', () => {
    render(<TestGeneratorTool />);
    expect(
      screen.getByText(/Gerador de Testes Unitários/i),
    ).toBeInTheDocument();
  });

  it('should toggle between tabs', () => {
    render(<TestGeneratorTool />);

    const fixTab = screen.getByTestId('tab-fix');
    fireEvent.click(fixTab);

    expect(screen.getByTestId('test-code-input')).toBeInTheDocument();
  });

  it('should save component code to localStorage', async () => {
    render(<TestGeneratorTool />);

    const textarea = screen.getByTestId('component-code-input');

    // Usar act para garantir que o estado foi atualizado
    fireEvent.change(textarea, {
      target: { value: 'const MyComponent = () => {}' },
    });

    // Verificar se o valor está no textarea
    expect(textarea).toHaveValue('const MyComponent = () => {}');

    // Verificar se localStorage foi chamado (após o useEffect ser acionado)
    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'lastComponent',
        'const MyComponent = () => {}',
      );
    });
  });

  it('should toggle theme', async () => {
    render(<TestGeneratorTool />);

    const themeButton = screen.getByTestId('theme-toggle-button');
    fireEvent.click(themeButton);

    await waitFor(() => {
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'theme',
        'light',
      );
    });
  });

  it('should clear history when clicking clear button', () => {
    render(<TestGeneratorTool />);

    const clearButton = screen.getByTestId('clear-history-button');
    fireEvent.click(clearButton);

    expect(window.localStorage.removeItem).toHaveBeenCalledWith(
      'lastComponent',
    );
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('lastTest');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('lastError');
  });

  it('should generate test when clicking generate button', async () => {
    render(<TestGeneratorTool />);

    const textarea = screen.getByTestId('component-code-input');
    fireEvent.change(textarea, {
      target: {
        value: 'export const MyComponent = () => { return <div>Test</div> }',
      },
    });

    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByTestId('loading-text')).toBeInTheDocument();
    });
  });

  it('should show error message when generating without code', async () => {
    render(<TestGeneratorTool />);

    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);

    await waitFor(() => {
      const fixTab = screen.getByTestId('tab-fix');
      fireEvent.click(fixTab);
    });

    const textarea = screen.getByTestId('error-message-input');
    expect(textarea).toHaveValue('Por favor, cole o código do componente');
  });

  it('should show error message in generating code', async () => {
    render(<TestGeneratorTool />);

    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);

    await waitFor(() => {
      const errorElement = screen.getByTestId('generate-error-message');
      expect(errorElement).toHaveTextContent(
        'Por favor, cole o código do componente',
      );
    });
  });

  it('should call AI fix API when clicking fix button', async () => {
    render(<TestGeneratorTool />);

    // Mudar para aba fix
    const fixTab = screen.getByTestId('tab-fix');
    fireEvent.click(fixTab);

    // Adicionar código de teste
    const testCodeInput = screen.getByTestId('test-code-input');
    fireEvent.change(testCodeInput, {
      target: { value: 'const test = () => {}' },
    });

    // Adicionar mensagem de erro
    const errorInput = screen.getByTestId('error-message-input');
    fireEvent.change(errorInput, {
      target: { value: 'TypeError: something went wrong' },
    });

    // Clicar no botão de correção
    const fixButton = screen.getByTestId('fix-button');
    fireEvent.click(fixButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/fix-test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        }),
      );
    });
  });
});
