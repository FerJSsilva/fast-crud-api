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

    // Mock da instância do documento salvo
    const mockDocInstance = {
      _id: 'new-id',
      name: 'New Test',
      save: jest.fn().mockResolvedValue({ _id: 'new-id', name: 'New Test' })
    };

    // Mock do modelo Mongoose como função construtora
    modelMock = jest.fn().mockImplementation(() => mockDocInstance);
    
    // Adicionar propriedades ao modelo
    modelMock.collection = { name: 'users' };
    modelMock.schema = {
      paths: {
        name: { instance: 'String' },
        email: { instance: 'String' },
        age: { instance: 'Number' },
        author: { 
          options: { ref: 'Author' },
          cast: jest.fn(id => `cast-${id}`)
        }
      }
    };
    modelMock.find = jest.fn();
    modelMock.findById = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ _id: 'mocked-id', name: 'Test' })
    });
    modelMock.findByIdAndUpdate = jest.fn().mockResolvedValue({ _id: 'mocked-id', name: 'Updated' });
    modelMock.findByIdAndDelete = jest.fn().mockResolvedValue({ _id: 'mocked-id' });
    modelMock.countDocuments = jest.fn().mockResolvedValue(10);

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

  // Testes adicionais para melhorar a cobertura

  test('deve implementar a lógica da rota GET para obter recurso único', async () => {
    // Obter o handler da segunda rota GET (recurso único)
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Mock de request e reply para obter um recurso específico
    const request = {
      params: { id: 'user-123' },
      query: { populate: 'posts' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    const result = await getHandler(request, reply);
    
    // Verificar que findById foi chamado corretamente
    expect(modelMock.findById).toHaveBeenCalledWith('user-123');
    expect(modelMock.findById().populate).toHaveBeenCalledWith('posts');
    expect(transformDocument).toHaveBeenCalled();
    
    // Verificar o resultado
    expect(result).toEqual({ id: 'mocked-id', _id: 'mocked-id', name: 'Test' });
  });

  test('deve retornar 404 quando o recurso não é encontrado na rota GET :id', async () => {
    // Configurar findById para retornar null (recurso não encontrado)
    modelMock.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    // Obter o handler da rota GET de recurso único
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Mock de request e reply
    const request = {
      params: { id: 'nonexistent-id' },
      query: {}
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    await getHandler(request, reply);
    
    // Verificar que o código 404 foi retornado
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('deve implementar a lógica da rota POST para criar recurso', async () => {
    // Obter o handler da rota POST
    const postHandler = fastifyMock.post.mock.calls[0][1];
    
    // Mock de request
    const request = {
      body: { name: 'New User', email: 'new@example.com' }
    };
    
    // Chamar o handler
    const result = await postHandler(request);
    
    // Verificar que o modelo foi criado e salvo corretamente
    expect(modelMock).toHaveBeenCalledWith(request.body);
    expect(modelMock().save).toHaveBeenCalled();
    expect(transformDocument).toHaveBeenCalled();
    
    // Verificar o resultado
    expect(result).toBeDefined();
  });

  test('deve lidar com erros durante o salvamento na rota POST', async () => {
    // Obter o handler da rota POST
    const postHandler = fastifyMock.post.mock.calls[0][1];
    
    // Mock de request
    const request = {
      body: { name: 'Error User' }
    };
    
    // Simular erro durante o salvamento
    const saveError = new Error('Erro ao salvar');
    const errorInstance = {
      _id: 'error-id',
      save: jest.fn().mockRejectedValue(saveError)
    };
    
    // Sobrescrever a implementação do mock apenas para este teste
    modelMock.mockImplementationOnce(() => errorInstance);
    
    // Verificar que a função propaga o erro
    await expect(postHandler(request)).rejects.toThrow('Erro ao salvar');
    
    // Verificar que o método save foi chamado
    expect(errorInstance.save).toHaveBeenCalled();
  });

  test('deve implementar a lógica da rota PUT para atualizar recurso', async () => {
    // Obter o handler da rota PUT
    const putHandler = fastifyMock.put.mock.calls[0][1];
    
    // Mock de request e reply
    const request = {
      params: { id: 'user-123' },
      body: { name: 'Updated Name' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    const result = await putHandler(request, reply);
    
    // Verificar que findByIdAndUpdate foi chamado corretamente
    expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-123',
      { name: 'Updated Name' },
      { new: true, runValidators: true }
    );
    expect(transformDocument).toHaveBeenCalled();
    
    // Verificar o resultado
    expect(result).toEqual({ id: 'mocked-id', _id: 'mocked-id', name: 'Updated' });
  });

  test('deve retornar 404 quando o recurso não é encontrado na rota PUT', async () => {
    // Configurar findByIdAndUpdate para retornar null (recurso não encontrado)
    modelMock.findByIdAndUpdate.mockResolvedValue(null);
    
    // Obter o handler da rota PUT
    const putHandler = fastifyMock.put.mock.calls[0][1];
    
    // Mock de request e reply
    const request = {
      params: { id: 'nonexistent-id' },
      body: { name: 'Updated Name' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    await putHandler(request, reply);
    
    // Verificar que o código 404 foi retornado
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('deve implementar a lógica da rota DELETE para remover recurso', async () => {
    // Obter o handler da rota DELETE
    const deleteHandler = fastifyMock.delete.mock.calls[0][1];
    
    // Mock de request e reply
    const request = {
      params: { id: 'user-123' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    const result = await deleteHandler(request, reply);
    
    // Verificar que findByIdAndDelete foi chamado corretamente
    expect(modelMock.findByIdAndDelete).toHaveBeenCalledWith('user-123');
    
    // Verificar o resultado
    expect(result).toEqual({ success: true });
  });

  test('deve retornar 404 quando o recurso não é encontrado na rota DELETE', async () => {
    // Configurar findByIdAndDelete para retornar null (recurso não encontrado)
    modelMock.findByIdAndDelete.mockResolvedValue(null);
    
    // Obter o handler da rota DELETE
    const deleteHandler = fastifyMock.delete.mock.calls[0][1];
    
    // Mock de request e reply
    const request = {
      params: { id: 'nonexistent-id' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    await deleteHandler(request, reply);
    
    // Verificar que o código 404 foi retornado
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('deve lidar com GET para recurso único sem populate', async () => {
    // Obter o handler da rota GET de recurso único
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Mock de request e reply sem parâmetro populate
    const request = {
      params: { id: 'user-123' },
      query: {}
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Chamar o handler
    await getHandler(request, reply);
    
    // Verificar que findById foi chamado, mas populate não
    expect(modelMock.findById).toHaveBeenCalledWith('user-123');
    expect(modelMock.findById().populate).not.toHaveBeenCalled();
  });

  test('deve suportar referenceFields vazios', () => {
    // Reset dos mocks
    jest.clearAllMocks();
    
    // Criar modelo sem campos de referência
    const noRefModel = { 
      collection: { name: 'simple' },
      schema: { 
        paths: { 
          name: { instance: 'String' } 
        } 
      },
      find: jest.fn(),
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'simple-id' })
      })
    };
    
    // Chamar setupCrudRoutes
    const result = setupCrudRoutes(fastifyMock, noRefModel, '/api/simple', options);
    
    // Verificar que retornou array vazio de reference fields
    expect(result.referenceFields).toEqual([]);
    
    // Verificar que as rotas ainda foram registradas
    expect(fastifyMock.get).toHaveBeenCalled();
  });
});
