const fp = require('fastify-plugin')

// Transform MongoDB document for API response
function transformDocument(doc) {
  if (!doc) return null;
  
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = obj;
  
  const transformed = {
    id: _id.toString(),
    ...rest
  };

  // Transform nested documents
  Object.keys(transformed).forEach(key => {
    if (Array.isArray(transformed[key])) {
      transformed[key] = transformed[key].map(item => {
        if (item && item._id) return transformDocument(item);
        return item;
      });
    } else if (transformed[key] && transformed[key]._id) {
      transformed[key] = transformDocument(transformed[key]);
    }
  });
  
  return transformed;
}

// Build query with filters
function buildQuery(model, filters = {}, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = { _id: -1 },
    search,
    searchFields = [],
    populate
  } = options;

  let query = model.find(filters);

  // Apply text search if provided
  if (search && searchFields.length > 0) {
    const searchConditions = searchFields.map(field => ({
      [field]: { $regex: search, $options: 'i' }
    }));
    query = query.or(searchConditions);
  }

  // Apply population
  if (populate) {
    const populateFields = Array.isArray(populate) ? populate : [populate];
    populateFields.forEach(field => {
      query = query.populate(field);
    });
  }

  // Apply sorting and pagination
  query = query
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  return query;
}

// Check if method is allowed for model
function isMethodAllowed(modelName, method, allowedMethods) {
  console.log('modelName', modelName);
  console.log('method', method);
  console.log('allowedMethods', allowedMethods[modelName]);
  if (!allowedMethods) return true;
  
  // Find the matching key regardless of case
  const key = Object.keys(allowedMethods).find(
    k => k.toLowerCase() === modelName.toLowerCase()
  );
  
  if (!key || !allowedMethods[key]) return true;
  return allowedMethods[key].includes(method);
}

// Main plugin function
async function createRoutes(fastify, options) {
  const { models, prefix = '/api', methods = {} } = options;

  // Setup error handler
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

  // Setup routes for each model
  models.forEach(model => {
    const modelName = model.collection.name;
    const baseRoute = `${prefix}/${model.collection.name}`;
    
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

    // Setup nested routes for references
    if (isMethodAllowed(modelName, 'GET', methods)) {
      referenceFields.forEach(refField => {
        const refModel = model.schema.paths[refField].options.ref.toLowerCase();
        const nestedRoute = `${prefix}/${refModel}/:refId/${model.collection.name}`;

        // GET /api/users/:userId/habits
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
  });
}

module.exports = fp(createRoutes)
