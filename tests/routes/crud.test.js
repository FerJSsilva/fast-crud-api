const { setupCrudRoutes } = require('../../src/routes/crud');
const { isMethodAllowed } = require('../../src/validators/method');
const { transformDocument } = require('../../src/utils/document');
const { buildQuery } = require('../../src/utils/query');

// Mock dos módulos externos
jest.mock('../../src/validators/method');
jest.mock('../../src/utils/document');
jest.mock('../../src/utils/query');

describe('CRUD Routes', () => {
  let fastifyMock;
  let modelMock;
  let options;
  let returnedValue;

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
      exec: jest.fn().mockResolvedValue([{ _id: 'mocked-id', name: 'Test' }])
    });

    // Mock do Fastify
    fastifyMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    // Mock do modelo Mongoose
    modelMock = {
      collection: {
        name: 'users'
      },
      schema: {
        paths: {
          name: { instance: 'String' },
          email: { instance: 'String' },
          age: { instance: 'Number' },
          author: { 
            options: { ref: 'Author' },
            cast: jest.fn(id => `cast-${id}`)
          }
        }
      },
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ _id: 'mocked-id', name: 'Test' })
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: 'mocked-id', name: 'Updated' }),
      findByIdAndDelete: jest.fn().mockResolvedValue({ _id: 'mocked-id' }),
      countDocuments: jest.fn().mockResolvedValue(10)
    };

    // Opções padrão
    options = {
      methods: {
        users: ['GET', 'POST', 'PUT', 'DELETE']
      }
    };

    // Executar a função setupCrudRoutes
    returnedValue = setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
  });

  test('deve retornar campos de referência', () => {
    expect(returnedValue).toHaveProperty('referenceFields');
    expect(returnedValue.referenceFields).toContain('author');
  });

  test('deve verificar permissões para cada método HTTP', () => {
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'GET', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'POST', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'PUT', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'DELETE', options.methods);
  });

  test('deve registrar rotas GET quando permitido', () => {
    // Verificar se as rotas GET foram registradas
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    expect(fastifyMock.get.mock.calls[0][0]).toBe('/api/users');
    expect(fastifyMock.get.mock.calls[1][0]).toBe('/api/users/:id');
  });

  test('deve registrar rota POST quando permitido', () => {
    expect(fastifyMock.post).toHaveBeenCalledTimes(1);
    expect(fastifyMock.post.mock.calls[0][0]).toBe('/api/users');
  });

  test('deve registrar rota PUT quando permitido', () => {
    expect(fastifyMock.put).toHaveBeenCalledTimes(1);
    expect(fastifyMock.put.mock.calls[0][0]).toBe('/api/users/:id');
  });

  test('deve registrar rota DELETE quando permitido', () => {
    expect(fastifyMock.delete).toHaveBeenCalledTimes(1);
    expect(fastifyMock.delete.mock.calls[0][0]).toBe('/api/users/:id');
  });

  test('não deve registrar rotas quando método não permitido', () => {
    // Reset dos mocks
    jest.clearAllMocks();
    
    // Configurar isMethodAllowed para negar todos os métodos
    isMethodAllowed.mockReturnValue(false);
    
    // Executar a função novamente
    setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
    
    // Verificar que nenhuma rota foi registrada
    expect(fastifyMock.get).not.toHaveBeenCalled();
    expect(fastifyMock.post).not.toHaveBeenCalled();
    expect(fastifyMock.put).not.toHaveBeenCalled();
    expect(fastifyMock.delete).not.toHaveBeenCalled();
  });

  test('deve identificar corretamente campos de busca do tipo String', () => {
    // Reset dos mocks
    jest.clearAllMocks();
    
    // Executar a função novamente
    setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
    
    // Obter o handler da primeira rota GET (listagem)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Chamar o handler com um mock de request
    listHandler({ query: { search: 'test' } });
    
    // Verificar se buildQuery foi chamado com os campos de busca corretos
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        searchFields: ['name', 'email']
      })
    );
  });

  test('deve implementar a lógica da rota GET para listar recursos', async () => {
    // Obter o handler da primeira rota GET (listagem)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Mock de request para listagem com vários parâmetros
    const request = {
      query: {
        page: '2',
        limit: '20',
        sort: '{"name":1}',
        search: 'test',
        author: 'author-id',
        status: 'active'
      }
    };
    
    // Chamar o handler
    const result = await listHandler(request);
    
    // Verificar que buildQuery foi chamado com os parâmetros corretos
    expect(buildQuery).toHaveBeenCalledWith(
      modelMock,
      expect.objectContaining({
        status: 'active',
        author: 'cast-author-id' // Verificar que o cast foi aplicado
      }),
      expect.objectContaining({
        page: 2,
        limit: 20,
        sort: { name: 1 },
        search: 'test'
      })
    );
    
    // Verificar a estrutura do resultado
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result.pagination).toEqual({
      total: 10,
      page: 2,
      limit: 20,
      pages: 1
    });
    expect(transformDocument).toHaveBeenCalled();
  });
});
