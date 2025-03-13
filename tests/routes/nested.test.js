const { setupNestedRoutes } = require('../../src/routes/nested');
const { isMethodAllowed } = require('../../src/validators/method');
const { transformDocument } = require('../../src/utils/document');
const { buildQuery } = require('../../src/utils/query');

// Mock dos módulos externos
jest.mock('../../src/validators/method');
jest.mock('../../src/utils/document');
jest.mock('../../src/utils/query');

describe('Nested Routes', () => {
  let fastifyMock;
  let modelMock;
  let prefix;
  let referenceFields;
  let options;

  beforeEach(() => {
    // Reset de todos os mocks
    jest.clearAllMocks();
    
    // Mock padrão para isMethodAllowed (permitir tudo por padrão)
    isMethodAllowed.mockReturnValue(true);
    
    // Mock para transformDocument
    transformDocument.mockImplementation(doc => ({
      id: 'mocked-id',
      ...doc
    }));
    
    // Mock para buildQuery
    buildQuery.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: 'post-1', title: 'Post 1' },
        { _id: 'post-2', title: 'Post 2' }
      ])
    });

    // Mock do Fastify
    fastifyMock = {
      get: jest.fn()
    };

    // Mock do modelo Mongoose
    modelMock = {
      collection: {
        name: 'posts'
      },
      schema: {
        paths: {
          title: { instance: 'String' },
          content: { instance: 'String' },
          author: { 
            options: { ref: 'User' },
            cast: jest.fn(id => `cast-${id}`)
          },
          category: {
            options: { ref: 'Category' },
            cast: jest.fn(id => `cast-${id}`)
          }
        }
      },
      countDocuments: jest.fn().mockResolvedValue(2)
    };

    // Parâmetros para setupNestedRoutes
    prefix = '/api';
    referenceFields = ['author', 'category'];
    options = {
      methods: {
        posts: ['GET', 'POST', 'PUT', 'DELETE']
      }
    };
  });

  test('deve verificar se o método GET é permitido', () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    expect(isMethodAllowed).toHaveBeenCalledWith('posts', 'GET', options.methods);
  });

  test('não deve registrar rotas se o método GET não é permitido', () => {
    // Configurar isMethodAllowed para negar GET
    isMethodAllowed.mockReturnValue(false);
    
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    expect(fastifyMock.get).not.toHaveBeenCalled();
  });

  test('deve registrar uma rota aninhada para cada campo de referência', () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Deve criar duas rotas (uma para author e outra para category)
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    
    // Verificar as rotas criadas
    expect(fastifyMock.get.mock.calls[0][0]).toBe('/api/user/:refId/posts');
    expect(fastifyMock.get.mock.calls[1][0]).toBe('/api/category/:refId/posts');
  });

  test('o handler da rota aninhada deve implementar a lógica correta', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da primeira rota (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request para a rota aninhada
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {
        page: '2',
        limit: '5',
        sort: '{"createdAt":-1}',
        search: 'test',
        status: 'published'
      }
    };
    
    // Chamar o handler
    const result = await authorRouteHandler(request);
    
    // Verificar que buildQuery foi chamado com os parâmetros corretos
    expect(buildQuery).toHaveBeenCalledWith(
      modelMock,
      expect.objectContaining({
        author: 'cast-user-123', // Verificar que o campo de referência foi aplicado corretamente
        status: 'published'
      }),
      expect.objectContaining({
        page: 2,
        limit: 5,
        sort: { createdAt: -1 },
        search: 'test'
      })
    );
    
    // Verificar a estrutura do resultado
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result.pagination).toEqual({
      total: 2,
      page: 2,
      limit: 5,
      pages: 1
    });
    
    // Verificar que transformDocument foi chamado para cada item
    expect(transformDocument).toHaveBeenCalledTimes(2);
  });

  test('deve usar os campos de busca do tipo String do modelo', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da primeira rota (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request com search
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {
        search: 'test'
      }
    };
    
    // Chamar o handler
    await authorRouteHandler(request);
    
    // Verificar que buildQuery foi chamado com os campos de busca corretos
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        searchFields: ['title', 'content']
      })
    );
  });

  // Testes adicionais para melhorar a cobertura

  test('deve ignorar referenceFields vazios', () => {
    // Chamar a função com array vazio de campos de referência
    setupNestedRoutes(fastifyMock, modelMock, prefix, [], options);
    
    // Não deve haver rotas registradas
    expect(fastifyMock.get).not.toHaveBeenCalled();
  });

  test('deve lidar com valores padrão de options', () => {
    // Chamar a função sem o parâmetro options
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields);
    
    // Deve registrar rotas como habitual
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    expect(isMethodAllowed).toHaveBeenCalledWith('posts', 'GET', {});
  });

  test('deve aplicar paginação com valores padrão quando não especificados', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da primeira rota (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request sem parâmetros de paginação
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {}
    };
    
    // Chamar o handler
    await authorRouteHandler(request);
    
    // Verificar que buildQuery foi chamado com valores padrão
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        page: 1,
        limit: 10
      })
    );
  });

  test('deve lidar com diferentes formatos de campos de populate', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da primeira rota (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Casos de teste para diferentes formatos de populate
    const testCases = [
      { 
        description: 'populate como string única',
        populate: 'comments',
        expected: 'comments'
      },
      {
        description: 'populate como array',
        populate: ['comments', 'likes'],
        expected: ['comments', 'likes']
      }
    ];
    
    for (const testCase of testCases) {
      // Reset dos mocks
      jest.clearAllMocks();
      
      // Mock de request com o caso de teste
      const request = {
        params: {
          refId: 'user-123'
        },
        query: {
          populate: testCase.populate
        }
      };
      
      // Chamar o handler
      await authorRouteHandler(request);
      
      // Verificar que buildQuery foi chamado com o campo populate correto
      expect(buildQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          populate: testCase.expected
        })
      );
    }
  });

  test('deve processar todos os tipos de parâmetros de query', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da primeira rota (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request com múltiplos parâmetros de consulta diferentes
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {
        // Paginação
        page: '3',
        limit: '15',
        
        // Ordenação
        sort: '{"updatedAt":-1,"title":1}',
        
        // Filtros
        status: 'active',
        type: 'article',
        featured: 'true',
        
        // Busca
        search: 'exemplo',
        
        // População
        populate: ['author', 'comments']
      }
    };
    
    // Chamar o handler
    const result = await authorRouteHandler(request);
    
    // Verificar que buildQuery foi chamado com todos os parâmetros processados corretamente
    expect(buildQuery).toHaveBeenCalledWith(
      modelMock,
      expect.objectContaining({
        author: 'cast-user-123',
        status: 'active',
        type: 'article',
        featured: 'true'
      }),
      expect.objectContaining({
        page: 3,
        limit: 15,
        sort: { updatedAt: -1, title: 1 },
        search: 'exemplo',
        populate: ['author', 'comments']
      })
    );
    
    // Verificar a estrutura completa do resultado
    expect(result).toEqual({
      data: [
        { id: 'mocked-id', _id: 'post-1', title: 'Post 1' },
        { id: 'mocked-id', _id: 'post-2', title: 'Post 2' }
      ],
      pagination: {
        total: 2,
        page: 3,
        limit: 15,
        pages: 1
      }
    });
  });

  test('deve lidar com erros na query e propagar para o caller', async () => {
    // Preparar um erro para ser lançado pela query
    const queryError = new Error('Erro na consulta');
    buildQuery.mockReturnValue({
      exec: jest.fn().mockRejectedValue(queryError)
    });
    
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Obter o handler da rota
    const routeHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request
    const request = {
      params: { refId: 'user-123' },
      query: {}
    };
    
    // Chamar o handler e verificar que o erro é propagado
    await expect(routeHandler(request)).rejects.toThrow('Erro na consulta');
  });
});
