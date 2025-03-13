const { isMethodAllowed } = require('../../src/validators/method');

describe('Method Validators', () => {
  describe('isMethodAllowed', () => {
    test('should not allow any methods when allowedMethods is null', () => {
      expect(isMethodAllowed('users', 'GET', null)).toBe(false);
      expect(isMethodAllowed('posts', 'POST', null)).toBe(false);
      expect(isMethodAllowed('comments', 'DELETE', null)).toBe(false);
    });

    test('should not allow any methods when allowedMethods is empty', () => {
      expect(isMethodAllowed('users', 'GET', {})).toBe(false);
      expect(isMethodAllowed('posts', 'POST', {})).toBe(false);
      expect(isMethodAllowed('comments', 'DELETE', {})).toBe(false);
    });

    test('should not allow any methods when model is not listed in allowedMethods', () => {
      const allowedMethods = {
        users: ['GET', 'POST']
      };
      
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(false);
      expect(isMethodAllowed('comments', 'POST', allowedMethods)).toBe(false);
      expect(isMethodAllowed('categories', 'PUT', allowedMethods)).toBe(false);
    });

    test('should check allowed methods for a specific model', () => {
      const allowedMethods = {
        users: ['GET', 'POST'],
        posts: ['GET']
      };
      
      // Allowed methods
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(true);
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(true);
      
      // Not allowed methods
      expect(isMethodAllowed('users', 'PUT', allowedMethods)).toBe(false);
      expect(isMethodAllowed('users', 'DELETE', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'POST', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'PUT', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'DELETE', allowedMethods)).toBe(false);
    });

    test('should be case insensitive when checking model name', () => {
      const allowedMethods = {
        Users: ['GET', 'POST'],
        POSTS: ['GET']
      };
      
      // Lowercase model
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'DELETE', allowedMethods)).toBe(false);
      
      // Mixed case model
      expect(isMethodAllowed('Posts', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('posts', 'POST', allowedMethods)).toBe(false);
      
      // Uppercase model
      expect(isMethodAllowed('USERS', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('POSTS', 'DELETE', allowedMethods)).toBe(false);
    });

    test('should handle empty or undefined allowedMethods[key] values', () => {
      const allowedMethods = {
        users: undefined,
        posts: null,
        comments: []
      };
      
      // Should not allow any methods when array is undefined
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(false);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(false);
      
      // Should not allow any methods when array is null
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'DELETE', allowedMethods)).toBe(false);
      
      // Should not allow any methods when array is empty
      expect(isMethodAllowed('comments', 'GET', allowedMethods)).toBe(false);
      expect(isMethodAllowed('comments', 'POST', allowedMethods)).toBe(false);
    });
  });
});
