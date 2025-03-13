const { setupErrorHandler } = require('../../src/middleware/error-handler');

describe('Error Handler Middleware', () => {
  describe('setupErrorHandler', () => {
    let fastifyMock;
    let replyMock;
    let errorHandler;

    beforeEach(() => {
      // Mock reply object
      replyMock = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis()
      };

      // Mock fastify object
      fastifyMock = {
        setErrorHandler: jest.fn(handler => {
          errorHandler = handler;
        }),
        log: {
          error: jest.fn()
        }
      };

      // Setup the error handler
      setupErrorHandler(fastifyMock);
    });

    test('should register the error handler in fastify', () => {
      expect(fastifyMock.setErrorHandler).toHaveBeenCalled();
      expect(typeof errorHandler).toBe('function');
    });

    test('should log the error', async () => {
      const error = new Error('Test error');
      await errorHandler(error, {}, replyMock);
      
      expect(fastifyMock.log.error).toHaveBeenCalledWith(error);
    });

    test('should handle validation error (ValidationError)', async () => {
      const validationError = {
        name: 'ValidationError',
        errors: {
          field1: { path: 'field1', message: 'Required field' },
          field2: { path: 'field2', message: 'Invalid format' }
        }
      };

      await errorHandler(validationError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(400);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'ValidationError',
        message: 'Invalid data provided',
        details: [
          { field: 'field1', message: 'Required field' },
          { field: 'field2', message: 'Invalid format' }
        ]
      });
    });

    test('should handle cast error (CastError)', async () => {
      const castError = {
        name: 'CastError'
      };

      await errorHandler(castError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(400);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'InvalidId',
        message: 'Invalid ID format provided'
      });
    });

    test('should handle duplicate error (code 11000)', async () => {
      const duplicateError = {
        code: 11000
      };

      await errorHandler(duplicateError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(409);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'DuplicateError',
        message: 'A record with this value already exists'
      });
    });

    test('should handle generic internal error', async () => {
      const genericError = new Error('Internal server error');

      await errorHandler(genericError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(500);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'InternalError',
        message: 'An internal server error occurred'
      });
    });
  });
});
