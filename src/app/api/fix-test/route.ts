import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { testCode, errorMessage, componentCode } = await req.json();

    console.log('Recebido:', {
      testCode: !!testCode,
      errorMessage: !!errorMessage,
    });

    const prompt = `Você é um especialista em testes unitários Jest e React Testing Library.

CÓDIGO DO COMPONENTE:
\`\`\`typescript
${componentCode || 'Não fornecido'}
\`\`\`

CÓDIGO DO TESTE ATUAL:
\`\`\`typescript
${testCode}
\`\`\`

ERRO ENCONTRADO:
${errorMessage}

INSTRUÇÕES:
1. Analise o erro e identifique a causa raiz
2. Corrija o código do teste
3. Retorne APENAS o código do teste corrigido, pronto para copiar e colar

PADRÕES A SEGUIR:
- Use describe e it com descrições claras
- Primeiro teste sempre: snapshot com toMatchSnapshot()
- Use data-testid quando necessário
- Mock dependências externas (redux, router, etc)
- Use waitFor para operações assíncronas
- Sempre resetar mocks no beforeEach

RETORNE APENAS O CÓDIGO TYPESCRIPT CORRIGIDO:`;

    // Removido das instrucoes 4. Não adicione explicações, apenas o código

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      maxOutputTokens: 2000,
    });

    console.log('Resposta recebida da IA pela API', text);

    // Remove markdown code blocks se existirem
    let cleanedCode = text.trim();
    cleanedCode = cleanedCode.replace(/```typescript\n?/g, '');
    cleanedCode = cleanedCode.replace(/```tsx\n?/g, '');
    cleanedCode = cleanedCode.replace(/```\n?/g, '');

    return Response.json({
      fixedCode: cleanedCode,
      suggestions: text,
    });
  } catch (error) {
    console.error('Error fixing test:', error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao corrigir teste',
      },
      { status: 500 },
    );
  }
}
