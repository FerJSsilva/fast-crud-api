const { buildQuery } = require('../../src/utils/query');

describe('Query Utilities', () => {
  describe('buildQuery', () => {
    // Mock of Mongoose model
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

    test('should apply basic filters correctly', () => {
      const modelMock = createModelMock();
      const filters = { status: 'active', category: 'tech' };
      
      buildQuery(modelMock, filters);
      
      expect(modelMock.find).toHaveBeenCalledWith(filters);
    });

    test('should apply pagination with default values when not specified', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {});
      
      expect(queryMock.skip).toHaveBeenCalledWith(0); // page 1 => skip 0
      expect(queryMock.limit).toHaveBeenCalledWith(10); // default limit = 10
    });

    test('should apply pagination with provided values', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { page: 3, limit: 20 });
      
      expect(queryMock.skip).toHaveBeenCalledWith(40); // page 3, limit 20 => skip (3-1)*20 = 40
      expect(queryMock.limit).toHaveBeenCalledWith(20);
    });

    test('should apply sorting correctly', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      const sortCriteria = { createdAt: -1, name: 1 };
      
      buildQuery(modelMock, {}, { sort: sortCriteria });
      
      expect(queryMock.sort).toHaveBeenCalledWith(sortCriteria);
    });

    test('should apply text search when search term and search fields are provided', () => {
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

    test('should not apply search when there is no search term', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { searchFields: ['title', 'description'] });
      
      expect(queryMock.or).not.toHaveBeenCalled();
    });

    test('should not apply search when there are no search fields', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { search: 'test query' });
      
      expect(queryMock.or).not.toHaveBeenCalled();
    });

    test('should apply population of a single field', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { populate: 'author' });
      
      expect(queryMock.populate).toHaveBeenCalledWith('author');
    });

    test('should apply population of multiple fields', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      buildQuery(modelMock, {}, { populate: ['author', 'category'] });
      
      expect(queryMock.populate).toHaveBeenCalledWith('author');
      expect(queryMock.populate).toHaveBeenCalledWith('category');
    });

    // Additional test to cover all branches in query.js
    test('should work correctly even without passing any parameters', () => {
      const modelMock = createModelMock();
      const queryMock = modelMock.find();
      
      // Calling buildQuery with just the model, no filters or options
      buildQuery(modelMock);
      
      // Verify that default values were applied correctly
      expect(modelMock.find).toHaveBeenCalledWith({});
      expect(queryMock.sort).toHaveBeenCalledWith({ _id: -1 });
      expect(queryMock.skip).toHaveBeenCalledWith(0);
      expect(queryMock.limit).toHaveBeenCalledWith(10);
      expect(queryMock.or).not.toHaveBeenCalled();
      expect(queryMock.populate).not.toHaveBeenCalled();
    });
  });
});
