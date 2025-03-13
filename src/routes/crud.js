const { transformDocument } = require('../utils/document');
const { buildQuery } = require('../utils/query');
const { isMethodAllowed } = require('../validators/method');

/**
 * Setup basic CRUD routes for a model
 * @param {Object} fastify - Fastify instance
 * @param {Object} model - Mongoose model
 * @param {String} baseRoute - Base route path
 * @param {Object} options - Route options
 * @param {Object} options.methods - Allowed methods per model
 */
function setupCrudRoutes(fastify, model, baseRoute, options = {}) {
  const { methods = {} } = options;
  const modelName = model.collection.name;
  
  // Get searchable fields from schema
  const searchableFields = Object.keys(model.schema.paths).filter(
    path => model.schema.paths[path].instance === 'String'
  );

  // Get reference fields
  const referenceFields = Object.keys(model.schema.paths).filter(path => {
    const schemaType = model.schema.paths[path];
    return schemaType.options && schemaType.options.ref;
  });

  // List route (GET /api/resource)
  if (isMethodAllowed(modelName, 'GET', methods)) {
    fastify.get(baseRoute, async (request) => {
      const {
        page = 1,
        limit = 10,
        sort,
        search,
        populate,
        ...filters
      } = request.query;

      // Convert string values to ObjectId for reference fields
      referenceFields.forEach(field => {
        if (filters[field]) {
          filters[field] = model.schema.paths[field].cast(filters[field]);
        }
      });

      const sortQuery = sort ? JSON.parse(sort) : { _id: -1 };
      
      const query = buildQuery(model, filters, {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: sortQuery,
        search,
        searchFields: searchableFields,
        populate
      });

      const [data, total] = await Promise.all([
        query.exec(),
        model.countDocuments(filters)
      ]);

      return {
        data: data.map(doc => transformDocument(doc)),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      };
    });

    // Get single resource (GET /api/resource/:id)
    fastify.get(`${baseRoute}/:id`, async (request, reply) => {
      const { id } = request.params;
      const { populate } = request.query;

      let query = model.findById(id);

      if (populate) {
        const populateFields = Array.isArray(populate) ? populate : [populate];
        populateFields.forEach(field => {
          query = query.populate(field);
        });
      }

      const doc = await query.exec();

      if (!doc) {
        reply.code(404).send({
          error: 'NotFound',
          message: 'Resource not found'
        });
        return;
      }

      return transformDocument(doc);
    });
  }

  // Create resource (POST /api/resource)
  if (isMethodAllowed(modelName, 'POST', methods)) {
    fastify.post(baseRoute, async (request) => {
      const doc = new model(request.body);
      await doc.save();
      return transformDocument(doc);
    });
  }

  // Update resource (PUT /api/resource/:id)
  if (isMethodAllowed(modelName, 'PUT', methods)) {
    fastify.put(`${baseRoute}/:id`, async (request, reply) => {
      const { id } = request.params;
      
      const doc = await model.findByIdAndUpdate(
        id,
        request.body,
        { new: true, runValidators: true }
      );

      if (!doc) {
        reply.code(404).send({
          error: 'NotFound',
          message: 'Resource not found'
        });
        return;
      }

      return transformDocument(doc);
    });
  }

  // Delete resource (DELETE /api/resource/:id)
  if (isMethodAllowed(modelName, 'DELETE', methods)) {
    fastify.delete(`${baseRoute}/:id`, async (request, reply) => {
      const { id } = request.params;
      
      const doc = await model.findByIdAndDelete(id);

      if (!doc) {
        reply.code(404).send({
          error: 'NotFound',
          message: 'Resource not found'
        });
        return;
      }

      return { success: true };
    });
  }
  
  return { referenceFields }; // Return for use in nested routes
}

module.exports = { setupCrudRoutes };
