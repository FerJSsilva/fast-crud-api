const { setupErrorHandler } = require('../../src/middleware/error-handler');

describe('Error Handler Middleware', () => {
  describe('setupErrorHandler', () => {
    let fastifyMock;
    let replyMock;
    let errorHandler;

    beforeEach(() => {
      // Mock do objeto reply
      replyMock = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis()
      };

      // Mock do objeto fastify
      fastifyMock = {
        setErrorHandler: jest.fn(handler => {
          errorHandler = handler;
        }),
        log: {
          error: jest.fn()
        }
      };

      // Configurar o tratador de erros
      setupErrorHandler(fastifyMock);
    });

    test('deve registrar o tratador de erros no fastify', () => {
      expect(fastifyMock.setErrorHandler).toHaveBeenCalled();
      expect(typeof errorHandler).toBe('function');
    });

    test('deve registrar o erro no log', async () => {
      const error = new Error('Erro de teste');
      await errorHandler(error, {}, replyMock);
      
      expect(fastifyMock.log.error).toHaveBeenCalledWith(error);
    });

    test('deve lidar com erro de validação (ValidationError)', async () => {
      const validationError = {
        name: 'ValidationError',
        errors: {
          field1: { path: 'field1', message: 'Campo obrigatório' },
          field2: { path: 'field2', message: 'Formato inválido' }
        }
      };

      await errorHandler(validationError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(400);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'ValidationError',
        message: 'Invalid data provided',
        details: [
          { field: 'field1', message: 'Campo obrigatório' },
          { field: 'field2', message: 'Formato inválido' }
        ]
      });
    });

    test('deve lidar com erro de cast (CastError)', async () => {
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

    test('deve lidar com erro de duplicidade (código 11000)', async () => {
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

    test('deve lidar com erro interno genérico', async () => {
      const genericError = new Error('Erro interno do servidor');

      await errorHandler(genericError, {}, replyMock);
      
      expect(replyMock.code).toHaveBeenCalledWith(500);
      expect(replyMock.send).toHaveBeenCalledWith({
        error: 'InternalError',
        message: 'An internal server error occurred'
      });
    });
  });
});
