const { isMethodAllowed } = require('../../src/validators/method');

describe('Method Validators', () => {
  describe('isMethodAllowed', () => {
    test('deve permitir todos os métodos quando allowedMethods for null', () => {
      expect(isMethodAllowed('users', 'GET', null)).toBe(true);
      expect(isMethodAllowed('posts', 'POST', null)).toBe(true);
      expect(isMethodAllowed('comments', 'DELETE', null)).toBe(true);
    });

    test('deve permitir todos os métodos quando allowedMethods estiver vazio', () => {
      expect(isMethodAllowed('users', 'GET', {})).toBe(true);
      expect(isMethodAllowed('posts', 'POST', {})).toBe(true);
      expect(isMethodAllowed('comments', 'DELETE', {})).toBe(true);
    });

    test('deve permitir todos os métodos quando o modelo não estiver listado em allowedMethods', () => {
      const allowedMethods = {
        users: ['GET', 'POST']
      };
      
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('comments', 'POST', allowedMethods)).toBe(true);
      expect(isMethodAllowed('categories', 'PUT', allowedMethods)).toBe(true);
    });

    test('deve verificar métodos permitidos para um modelo específico', () => {
      const allowedMethods = {
        users: ['GET', 'POST'],
        posts: ['GET']
      };
      
      // Métodos permitidos
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(true);
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(true);
      
      // Métodos não permitidos
      expect(isMethodAllowed('users', 'PUT', allowedMethods)).toBe(false);
      expect(isMethodAllowed('users', 'DELETE', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'POST', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'PUT', allowedMethods)).toBe(false);
      expect(isMethodAllowed('posts', 'DELETE', allowedMethods)).toBe(false);
    });

    test('deve ser insensível a maiúsculas/minúsculas ao verificar o nome do modelo', () => {
      const allowedMethods = {
        Users: ['GET', 'POST'],
        POSTS: ['GET']
      };
      
      // Modelo em minúsculas
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'DELETE', allowedMethods)).toBe(false);
      
      // Modelo com diferentes casos
      expect(isMethodAllowed('Posts', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('posts', 'POST', allowedMethods)).toBe(false);
      
      // Modelo em maiúsculas
      expect(isMethodAllowed('USERS', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('POSTS', 'DELETE', allowedMethods)).toBe(false);
    });

    test('deve lidar com valores allowedMethods[key] vazios ou indefinidos', () => {
      const allowedMethods = {
        users: undefined,
        posts: null,
        comments: []
      };
      
      // Deve permitir todos os métodos quando o array é indefinido
      expect(isMethodAllowed('users', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('users', 'POST', allowedMethods)).toBe(true);
      
      // Deve permitir todos os métodos quando o array é null
      expect(isMethodAllowed('posts', 'GET', allowedMethods)).toBe(true);
      expect(isMethodAllowed('posts', 'DELETE', allowedMethods)).toBe(true);
      
      // Não deve permitir nenhum método quando o array está vazio
      expect(isMethodAllowed('comments', 'GET', allowedMethods)).toBe(false);
      expect(isMethodAllowed('comments', 'POST', allowedMethods)).toBe(false);
    });
  });
});
