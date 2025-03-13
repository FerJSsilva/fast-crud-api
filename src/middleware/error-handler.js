/**
 * Setup Fastify error handler for MongoDB and validation errors
 * @param {Object} fastify - Fastify instance
 */
function setupErrorHandler(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.name === 'ValidationError') {
      reply.code(400).send({
        error: 'ValidationError',
        message: 'Invalid data provided',
        details: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
      return;
    }

    if (error.name === 'CastError') {
      reply.code(400).send({
        error: 'InvalidId',
        message: 'Invalid ID format provided'
      });
      return;
    }

    if (error.code === 11000) {
      reply.code(409).send({
        error: 'DuplicateError',
        message: 'A record with this value already exists'
      });
      return;
    }

    reply.code(500).send({
      error: 'InternalError',
      message: 'An internal server error occurred'
    });
  });
}

module.exports = { setupErrorHandler };
