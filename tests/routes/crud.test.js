const { setupCrudRoutes } = require('../../src/routes/crud');
const { isMethodAllowed } = require('../../src/validators/method');
const { transformDocument } = require('../../src/utils/document');
const { buildQuery } = require('../../src/utils/query');

// Mock external modules
jest.mock('../../src/validators/method');
jest.mock('../../src/utils/document');
jest.mock('../../src/utils/query');

describe('CRUD Routes', () => {
  let fastifyMock;
  let modelMock;
  let options;
  let returnedValue;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock for isMethodAllowed (allow everything by default)
    isMethodAllowed.mockReturnValue(true);
    
    // Mock for transformDocument
    transformDocument.mockImplementation(doc => ({
      id: 'mocked-id',
      ...doc
    }));
    
    // Mock for buildQuery
    buildQuery.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: 'mocked-id', name: 'Test' }])
    });

    // Mock Fastify
    fastifyMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    };

    // Mock saved document instance
    const mockDocInstance = {
      _id: 'new-id',
      name: 'New Test',
      save: jest.fn().mockResolvedValue({ _id: 'new-id', name: 'New Test' })
    };

    // Mock Mongoose model as constructor function
    modelMock = jest.fn().mockImplementation(() => mockDocInstance);
    
    // Add properties to the model
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

    // Default options
    options = {
      methods: {
        users: ['GET', 'POST', 'PUT', 'DELETE']
      }
    };

    // Execute the setupCrudRoutes function
    returnedValue = setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
  });

  test('should return reference fields', () => {
    expect(returnedValue).toHaveProperty('referenceFields');
    expect(returnedValue.referenceFields).toContain('author');
  });

  test('should check permissions for each HTTP method', () => {
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'GET', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'POST', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'PUT', options.methods);
    expect(isMethodAllowed).toHaveBeenCalledWith('users', 'DELETE', options.methods);
  });

  test('should register GET routes when allowed', () => {
    // Verify if GET routes were registered
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    expect(fastifyMock.get.mock.calls[0][0]).toBe('/api/users');
    expect(fastifyMock.get.mock.calls[1][0]).toBe('/api/users/:id');
  });

  test('should register POST route when allowed', () => {
    expect(fastifyMock.post).toHaveBeenCalledTimes(1);
    expect(fastifyMock.post.mock.calls[0][0]).toBe('/api/users');
  });

  test('should register PUT route when allowed', () => {
    expect(fastifyMock.put).toHaveBeenCalledTimes(1);
    expect(fastifyMock.put.mock.calls[0][0]).toBe('/api/users/:id');
  });

  test('should register DELETE route when allowed', () => {
    expect(fastifyMock.delete).toHaveBeenCalledTimes(1);
    expect(fastifyMock.delete.mock.calls[0][0]).toBe('/api/users/:id');
  });

  test('should not register routes when method is not allowed', () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Configure isMethodAllowed to deny all methods
    isMethodAllowed.mockReturnValue(false);
    
    // Execute the function again
    setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
    
    // Verify that no routes were registered
    expect(fastifyMock.get).not.toHaveBeenCalled();
    expect(fastifyMock.post).not.toHaveBeenCalled();
    expect(fastifyMock.put).not.toHaveBeenCalled();
    expect(fastifyMock.delete).not.toHaveBeenCalled();
  });

  test('should correctly identify String type search fields', () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Execute the function again
    setupCrudRoutes(fastifyMock, modelMock, '/api/users', options);
    
    // Get the handler for the first GET route (listing)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Call the handler with a request mock
    listHandler({ query: { search: 'test' } });
    
    // Verify if buildQuery was called with the correct search fields
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        searchFields: ['name', 'email']
      })
    );
  });

  test('should implement GET route logic to list resources', async () => {
    // Get the handler for the first GET route (listing)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock for listing with various parameters
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
    
    // Call the handler
    const result = await listHandler(request);
    
    // Verify that buildQuery was called with the correct parameters
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
    
    // Verify the result structure
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

  // Additional tests to improve coverage

  test('should implement GET route logic to retrieve a single resource', async () => {
    // Get the handler for the second GET route (single resource)
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Request and reply mock for getting a specific resource
    const request = {
      params: { id: 'user-123' },
      query: { populate: 'posts' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    const result = await getHandler(request, reply);
    
    // Verify that findById was called correctly
    expect(modelMock.findById).toHaveBeenCalledWith('user-123');
    expect(modelMock.findById().populate).toHaveBeenCalledWith('posts');
    expect(transformDocument).toHaveBeenCalled();
    
    // Verify the result
    expect(result).toEqual({ id: 'mocked-id', _id: 'mocked-id', name: 'Test' });
  });

  test('should return 404 when resource is not found on GET :id route', async () => {
    // Configure findById to return null (resource not found)
    modelMock.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null)
    });
    
    // Get the handler for the single resource GET route
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Request and reply mock
    const request = {
      params: { id: 'nonexistent-id' },
      query: {}
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    await getHandler(request, reply);
    
    // Verify that 404 code was returned
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('should implement POST route logic to create a resource', async () => {
    // Get the POST route handler
    const postHandler = fastifyMock.post.mock.calls[0][1];
    
    // Request mock
    const request = {
      body: { name: 'New User', email: 'new@example.com' }
    };
    
    // Call the handler
    const result = await postHandler(request);
    
    // Verify that the model was created and saved correctly
    expect(modelMock).toHaveBeenCalledWith(request.body);
    expect(modelMock().save).toHaveBeenCalled();
    expect(transformDocument).toHaveBeenCalled();
    
    // Verify the result
    expect(result).toBeDefined();
  });

  test('should handle errors during saving in POST route', async () => {
    // Get the POST route handler
    const postHandler = fastifyMock.post.mock.calls[0][1];
    
    // Request mock
    const request = {
      body: { name: 'Error User' }
    };
    
    // Simulate error during saving
    const saveError = new Error('Error saving');
    const errorInstance = {
      _id: 'error-id',
      save: jest.fn().mockRejectedValue(saveError)
    };
    
    // Override the mock implementation only for this test
    modelMock.mockImplementationOnce(() => errorInstance);
    
    // Verify that the function propagates the error
    await expect(postHandler(request)).rejects.toThrow('Error saving');
    
    // Verify that the save method was called
    expect(errorInstance.save).toHaveBeenCalled();
  });

  test('should implement PUT route logic to update a resource', async () => {
    // Get the PUT route handler
    const putHandler = fastifyMock.put.mock.calls[0][1];
    
    // Request and reply mock
    const request = {
      params: { id: 'user-123' },
      body: { name: 'Updated Name' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    const result = await putHandler(request, reply);
    
    // Verify that findByIdAndUpdate was called correctly
    expect(modelMock.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-123',
      { name: 'Updated Name' },
      { new: true, runValidators: true }
    );
    expect(transformDocument).toHaveBeenCalled();
    
    // Verify the result
    expect(result).toEqual({ id: 'mocked-id', _id: 'mocked-id', name: 'Updated' });
  });

  test('should return 404 when resource is not found on PUT route', async () => {
    // Configure findByIdAndUpdate to return null (resource not found)
    modelMock.findByIdAndUpdate.mockResolvedValue(null);
    
    // Get the PUT route handler
    const putHandler = fastifyMock.put.mock.calls[0][1];
    
    // Request and reply mock
    const request = {
      params: { id: 'nonexistent-id' },
      body: { name: 'Updated Name' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    await putHandler(request, reply);
    
    // Verify that 404 code was returned
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('should implement DELETE route logic to remove a resource', async () => {
    // Get the DELETE route handler
    const deleteHandler = fastifyMock.delete.mock.calls[0][1];
    
    // Request and reply mock
    const request = {
      params: { id: 'user-123' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    const result = await deleteHandler(request, reply);
    
    // Verify that findByIdAndDelete was called correctly
    expect(modelMock.findByIdAndDelete).toHaveBeenCalledWith('user-123');
    
    // Verify the result
    expect(result).toEqual({ success: true });
  });

  test('should return 404 when resource is not found on DELETE route', async () => {
    // Configure findByIdAndDelete to return null (resource not found)
    modelMock.findByIdAndDelete.mockResolvedValue(null);
    
    // Get the DELETE route handler
    const deleteHandler = fastifyMock.delete.mock.calls[0][1];
    
    // Request and reply mock
    const request = {
      params: { id: 'nonexistent-id' }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    await deleteHandler(request, reply);
    
    // Verify that 404 code was returned
    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NotFound',
      message: 'Resource not found'
    });
  });

  test('should handle GET for single resource without populate', async () => {
    // Get the single resource GET route handler
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Request and reply mock without populate parameter
    const request = {
      params: { id: 'user-123' },
      query: {}
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Call the handler
    await getHandler(request, reply);
    
    // Verify that findById was called, but populate wasn't
    expect(modelMock.findById).toHaveBeenCalledWith('user-123');
    expect(modelMock.findById().populate).not.toHaveBeenCalled();
  });

  test('should handle populate as array in GET route for single resource', async () => {
    // Get the second GET route handler (single resource)
    const getHandler = fastifyMock.get.mock.calls[1][1];
    
    // Request and reply mock with populate as array
    const request = {
      params: { id: 'user-123' },
      query: { populate: ['author', 'comments'] }
    };
    const reply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Reset the populate mock to verify multiple calls
    const populateMock = jest.fn().mockReturnThis();
    modelMock.findById.mockReturnValue({
      populate: populateMock,
      exec: jest.fn().mockResolvedValue({ _id: 'mocked-id', name: 'Test' })
    });
    
    // Call the handler
    const result = await getHandler(request, reply);
    
    // Verify that findById was called correctly
    expect(modelMock.findById).toHaveBeenCalledWith('user-123');
    
    // Verify that populate was called for each item in the array
    expect(populateMock).toHaveBeenCalledWith('author');
    expect(populateMock).toHaveBeenCalledWith('comments');
    
    // Verify the result
    expect(result).toEqual({ id: 'mocked-id', _id: 'mocked-id', name: 'Test' });
  });

  test('should support empty referenceFields', () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create model without reference fields
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
    
    // Call setupCrudRoutes
    const result = setupCrudRoutes(fastifyMock, noRefModel, '/api/simple', options);
    
    // Verify that it returned an empty array of reference fields
    expect(result.referenceFields).toEqual([]);
    
    // Verify that routes were still registered
    expect(fastifyMock.get).toHaveBeenCalled();
  });

  test('should use default pagination and sorting values in GET listing route', async () => {
    // Get the first GET route handler (listing)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock with empty query (using default values)
    const request = {
      query: {}
    };
    
    // Reset buildQuery to verify default values
    buildQuery.mockClear();
    
    // Call the handler
    await listHandler(request);
    
    // Verify that buildQuery was called with default values
    expect(buildQuery).toHaveBeenCalledWith(
      modelMock,
      {},
      expect.objectContaining({
        page: 1,
        limit: 10,
        sort: { _id: -1 } // Ordenação padrão
      })
    );
  });

  test('should handle errors during query execution in GET listing route', async () => {
    // Get the first GET route handler (listing)
    const listHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock
    const request = {
      query: {}
    };
    
    // Simulate error during query execution
    const queryError = new Error('Error executing query');
    buildQuery.mockReturnValue({
      exec: jest.fn().mockRejectedValue(queryError)
    });
    
    // Verify that the function propagates the error
    await expect(listHandler(request)).rejects.toThrow('Error executing query');
  });

  test('should handle options not provided', () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Call setupCrudRoutes without options parameter
    setupCrudRoutes(fastifyMock, modelMock, '/api/users');
    
    // Verify that routes were registered correctly
    // even without options parameter
    expect(fastifyMock.get).toHaveBeenCalled();
    expect(fastifyMock.post).toHaveBeenCalled();
    expect(fastifyMock.put).toHaveBeenCalled();
    expect(fastifyMock.delete).toHaveBeenCalled();
  });

  test('should handle methods not provided in options', () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Call setupCrudRoutes with options without methods
    setupCrudRoutes(fastifyMock, modelMock, '/api/users', {});
    
    // Verify that routes were registered correctly
    // even without methods defined in options
    expect(fastifyMock.get).toHaveBeenCalled();
    expect(fastifyMock.post).toHaveBeenCalled();
    expect(fastifyMock.put).toHaveBeenCalled();
    expect(fastifyMock.delete).toHaveBeenCalled();
  });
});
