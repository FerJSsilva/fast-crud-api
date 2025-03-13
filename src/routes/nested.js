const { transformDocument } = require('../utils/document');
const { buildQuery } = require('../utils/query');
const { isMethodAllowed } = require('../validators/method');

/**
 * Setup nested routes for model references
 * @param {Object} fastify - Fastify instance
 * @param {Object} model - Mongoose model
 * @param {String} prefix - API prefix
 * @param {Array} referenceFields - Reference fields
 * @param {Object} options - Route options
 * @param {Object} options.methods - Allowed methods per model
 */
function setupNestedRoutes(fastify, model, prefix, referenceFields, options = {}) {
  const { methods = {} } = options;
  const modelName = model.collection.name;

  // Only setup nested routes if GET is allowed
  if (!isMethodAllowed(modelName, 'GET', methods)) {
    return;
  }

  // Get searchable fields from schema
  const searchableFields = Object.keys(model.schema.paths).filter(
    path => model.schema.paths[path].instance === 'String'
  );

  // Setup nested routes for each reference field
  referenceFields.forEach(refField => {
    const refModel = model.schema.paths[refField].options.ref.toLowerCase();
    const nestedRoute = `${prefix}/${refModel}/:refId/${model.collection.name}`;

    // GET /api/users/:userId/posts
    fastify.get(nestedRoute, async (request) => {
      const {
        page = 1,
        limit = 10,
        sort,
        search,
        populate,
        ...filters
      } = request.query;

      const { refId } = request.params;
      filters[refField] = model.schema.paths[refField].cast(refId);

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
  });
}

module.exports = { setupNestedRoutes };
