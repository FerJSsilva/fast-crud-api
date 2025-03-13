/**
 * Transform MongoDB document for API response
 * Removes MongoDB-specific fields and converts ObjectId to strings
 * @param {Object} doc - Mongoose document or plain object
 * @returns {Object} Transformed document
 */
function transformDocument(doc) {
  if (!doc) return null;
  
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, ...rest } = obj;
  
  return {
    id: _id.toString(),
    ...Object.entries(rest).reduce((acc, [key, value]) => {
      if (value && value.constructor && value.constructor.name === 'ObjectId') {
        acc[key] = value.toString();
      } else {
        acc[key] = value;
      }
      return acc;
    }, {})
  };
}

module.exports = { transformDocument };
