const { buildQuery } = require('../../src/utils/query');

describe('Query Utilities', () => {
  describe('buildQuery', () => {
    // Mock do modelo do Mongoose
    const createModelMock = () => {
      const queryMock = {
        find: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      };
      
      return {
        find: jest.fn().mockImplementation(() => queryMock)
      };
    };

    test('deve aplicar filtros básicos corretamente', () => {
      const modelMock = createModelMock();
      const filters = { status: 'active', category: 'tech' };
      
      buildQuery(modelMock, filters);
      
      expect(modelMock.find).toHaveBeenCalledWith(filters);
    });

    test('deve aplicar paginação com valores padrão quando não especificados', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {});
      
      expect(queryMock.skip).toHaveBeenCalledWith(0); // page 1 => skip 0
      expect(queryMock.limit).toHaveBeenCalledWith(10); // default limit = 10
    });

    test('deve aplicar paginação com valores fornecidos', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { page: 3, limit: 20 });
      
      expect(queryMock.skip).toHaveBeenCalledWith(40); // page 3, limit 20 => skip (3-1)*20 = 40
      expect(queryMock.limit).toHaveBeenCalledWith(20);
    });

    test('deve aplicar ordenação corretamente', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      const sortCriteria = { createdAt: -1, name: 1 };
      
      buildQuery(modelMock, {}, { sort: sortCriteria });
      
      expect(queryMock.sort).toHaveBeenCalledWith(sortCriteria);
    });

    test('deve aplicar busca de texto quando fornecido termo e campos de busca', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      const searchFields = ['title', 'description'];
      
      buildQuery(modelMock, {}, { search: 'test query', searchFields });
      
      const expectedSearchConditions = [
        { title: { $regex: 'test query', $options: 'i' } },
        { description: { $regex: 'test query', $options: 'i' } }
      ];
      
      expect(queryMock.or).toHaveBeenCalledWith(expectedSearchConditions);
    });

    test('não deve aplicar busca quando não há termo de busca', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { searchFields: ['title', 'description'] });
      
      expect(queryMock.or).not.toHaveBeenCalled();
    });

    test('não deve aplicar busca quando não há campos de busca', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { search: 'test query' });
      
      expect(queryMock.or).not.toHaveBeenCalled();
    });

    test('deve aplicar população de um único campo', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { populate: 'author' });
      
      expect(queryMock.populate).toHaveBeenCalledWith('author');
    });

    test('deve aplicar população de múltiplos campos', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { populate: ['author', 'category'] });
      
      expect(queryMock.populate).toHaveBeenCalledWith('author');
      expect(queryMock.populate).toHaveBeenCalledWith('category');
    });

    // Teste adicional para cobrir todos os branches de query.js
    test('deve funcionar corretamente mesmo sem passar nenhum parâmetro', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      // Chamando buildQuery apenas com o modelo, sem filtros nem opções
      buildQuery(modelMock);
      
      // Verificar que os valores padrão foram aplicados corretamente
      expect(modelMock.find).toHaveBeenCalledWith({});
      expect(queryMock.sort).toHaveBeenCalledWith({ _id: -1 });
      expect(queryMock.skip).toHaveBeenCalledWith(0);
      expect(queryMock.limit).toHaveBeenCalledWith(10);
      expect(queryMock.or).not.toHaveBeenCalled();
      expect(queryMock.populate).not.toHaveBeenCalled();
    });
  });
});
