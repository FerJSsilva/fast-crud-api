const fp = require('fastify-plugin');
const { setupErrorHandler } = require('./middleware/error-handler');
const { setupCrudRoutes } = require('./routes/crud');
const { setupNestedRoutes } = require('./routes/nested');

/**
 * Fast CRUD API plugin for Fastify and MongoDB
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Plugin options
 * @param {Array} options.models - Array of Mongoose models
 * @param {String} options.prefix - API prefix
 * @param {Object} options.methods - Allowed methods per model
 */
async function createRoutes(fastify, options) {
  const { models, prefix = '/api', methods = {} } = options;

  // Setup error handler
  setupErrorHandler(fastify);

  // Setup routes for each model
  models.forEach(model => {
    const modelName = model.collection.name;
    const baseRoute = `${prefix}/${model.collection.name}`;
    
    // Setup basic CRUD routes and get reference fields
    const { referenceFields } = setupCrudRoutes(fastify, model, baseRoute, { methods });
    
    // Setup nested routes for references
    setupNestedRoutes(fastify, model, prefix, referenceFields, { methods });
  });
}

module.exports = fp(createRoutes);
