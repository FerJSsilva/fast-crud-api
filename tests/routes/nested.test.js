const { setupNestedRoutes } = require('../../src/routes/nested');
const { isMethodAllowed } = require('../../src/validators/method');
const { transformDocument } = require('../../src/utils/document');
const { buildQuery } = require('../../src/utils/query');

// Mock external modules
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
      exec: jest.fn().mockResolvedValue([
        { _id: 'post-1', title: 'Post 1' },
        { _id: 'post-2', title: 'Post 2' }
      ])
    });

    // Mock Fastify
    fastifyMock = {
      get: jest.fn()
    };

    // Mock Mongoose model
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

    // Parameters for setupNestedRoutes
    prefix = '/api';
    referenceFields = ['author', 'category'];
    options = {
      methods: {
        posts: ['GET', 'POST', 'PUT', 'DELETE']
      }
    };
  });

  test('should check if GET method is allowed', () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    expect(isMethodAllowed).toHaveBeenCalledWith('posts', 'GET', options.methods);
  });

  test('should not register routes if GET method is not allowed', () => {
    // Configure isMethodAllowed to deny GET
    isMethodAllowed.mockReturnValue(false);
    
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    expect(fastifyMock.get).not.toHaveBeenCalled();
  });

  test('should register a nested route for each reference field', () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Should create two routes (one for author and one for category)
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    
    // Verify created routes
    expect(fastifyMock.get.mock.calls[0][0]).toBe('/api/user/:refId/posts');
    expect(fastifyMock.get.mock.calls[1][0]).toBe('/api/category/:refId/posts');
  });

  test('should implement correct logic in the nested route handler', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the handler for the first route (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock for the nested route
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
    
    // Call the handler
    const result = await authorRouteHandler(request);
    
    // Verify that buildQuery was called with the correct parameters
    expect(buildQuery).toHaveBeenCalledWith(
      modelMock,
      expect.objectContaining({
        author: 'cast-user-123', // Verify that the reference field was applied correctly
        status: 'published'
      }),
      expect.objectContaining({
        page: 2,
        limit: 5,
        sort: { createdAt: -1 },
        search: 'test'
      })
    );
    
    // Verify the result structure
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(result.pagination).toEqual({
      total: 2,
      page: 2,
      limit: 5,
      pages: 1
    });
    
    // Verify that transformDocument was called for each item
    expect(transformDocument).toHaveBeenCalledTimes(2);
  });

  test('should use String type search fields from the model', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the handler for the first route (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock with search
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {
        search: 'test'
      }
    };
    
    // Call the handler
    await authorRouteHandler(request);
    
    // Verify that buildQuery was called with the correct search fields
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        searchFields: ['title', 'content']
      })
    );
  });

  // Additional tests to improve coverage

  test('should ignore empty referenceFields', () => {
    // Call the function with an empty array of reference fields
    setupNestedRoutes(fastifyMock, modelMock, prefix, [], options);
    
    // There should be no registered routes
    expect(fastifyMock.get).not.toHaveBeenCalled();
  });

  test('should handle default options values', () => {
    // Call the function without options parameter
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields);
    
    // Should register routes as usual
    expect(fastifyMock.get).toHaveBeenCalledTimes(2);
    expect(isMethodAllowed).toHaveBeenCalledWith('posts', 'GET', {});
  });

  test('should apply pagination with default values when not specified', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the handler for the first route (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock without pagination parameters
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {}
    };
    
    // Call the handler
    await authorRouteHandler(request);
    
    // Verify that buildQuery was called with default values
    expect(buildQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        page: 1,
        limit: 10
      })
    );
  });

  test('should handle different formats of populate fields', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the handler for the first route (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Test cases for different populate formats
    const testCases = [
      { 
        description: 'populate as single string',
        populate: 'comments',
        expected: 'comments'
      },
      {
        description: 'populate as array',
        populate: ['comments', 'likes'],
        expected: ['comments', 'likes']
      }
    ];
    
    for (const testCase of testCases) {
      // Reset mocks
      jest.clearAllMocks();
      
      // Request mock with the test case
      const request = {
        params: {
          refId: 'user-123'
        },
        query: {
          populate: testCase.populate
        }
      };
      
      // Call the handler
      await authorRouteHandler(request);
      
      // Verify that buildQuery was called with the correct populate field
      expect(buildQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          populate: testCase.expected
        })
      );
    }
  });

  test('should process all types of query parameters', async () => {
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the handler for the first route (author)
    const authorRouteHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock with multiple different query parameters
    const request = {
      params: {
        refId: 'user-123'
      },
      query: {
        // Pagination
        page: '3',
        limit: '15',
        
        // Sorting
        sort: '{"updatedAt":-1,"title":1}',
        
        // Filters
        status: 'active',
        type: 'article',
        featured: 'true',
        
        // Search
        search: 'example',
        
        // Population
        populate: ['author', 'comments']
      }
    };
    
    // Call the handler
    const result = await authorRouteHandler(request);
    
    // Verify that buildQuery was called with all parameters processed correctly
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
        search: 'example',
        populate: ['author', 'comments']
      })
    );
    
    // Verify the complete result structure
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

  test('should handle errors in query and propagate to the caller', async () => {
    // Prepare an error to be thrown by the query
    const queryError = new Error('Query error');
    buildQuery.mockReturnValue({
      exec: jest.fn().mockRejectedValue(queryError)
    });
    
    setupNestedRoutes(fastifyMock, modelMock, prefix, referenceFields, options);
    
    // Get the route handler
    const routeHandler = fastifyMock.get.mock.calls[0][1];
    
    // Request mock
    const request = {
      params: { refId: 'user-123' },
      query: {}
    };
    
    // Call the handler and verify that the error is propagated
    await expect(routeHandler(request)).rejects.toThrow('Query error');
  });
});
