/**
 * Build query with filters and apply pagination, sorting, search and population
 * @param {Object} model - Mongoose model
 * @param {Object} filters - Query filters
 * @param {Object} options - Query options
 * @param {Number} options.page - Page number
 * @param {Number} options.limit - Items per page
 * @param {Object} options.sort - Sort criteria
 * @param {String} options.search - Search term
 * @param {Array} options.searchFields - Fields to search in
 * @param {String|Array} options.populate - Fields to populate
 * @returns {Object} Mongoose query
 */
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

module.exports = { buildQuery };
