/**
 * Check if a method is allowed for a specific model
 * @param {String} modelName - Model name
 * @param {String} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {Object} allowedMethods - Object mapping model names to allowed methods
 * @returns {Boolean} Whether the method is allowed
 */
function isMethodAllowed(modelName, method, allowedMethods) {
  if (!allowedMethods) return true;
  
  // Find the matching key regardless of case
  const key = Object.keys(allowedMethods).find(
    k => k.toLowerCase() === modelName.toLowerCase()
  );
  
  if (!key || !allowedMethods[key]) return true;
  return allowedMethods[key].includes(method);
}

module.exports = { isMethodAllowed };
