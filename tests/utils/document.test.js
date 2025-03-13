const { transformDocument } = require('../../src/utils/document');

describe('Document Utilities', () => {
  describe('transformDocument', () => {
    test('deve retornar null quando o documento for null', () => {
      expect(transformDocument(null)).toBeNull();
    });

    test('deve transformar documento com método toObject', () => {
      const mockDocument = {
        _id: { toString: () => '123abc' },
        __v: 0,
        name: 'Test',
        email: 'test@example.com',
        toObject: function() {
          return {
            _id: this._id,
            __v: this.__v,
            name: this.name,
            email: this.email
          };
        }
      };

      const result = transformDocument(mockDocument);
      
      expect(result).toEqual({
        id: '123abc',
        name: 'Test',
        email: 'test@example.com'
      });
    });

    test('deve transformar objeto plano sem método toObject', () => {
      const plainObject = {
        _id: { toString: () => '456def' },
        __v: 0,
        title: 'Test Post',
        content: 'Test Content'
      };

      const result = transformDocument(plainObject);
      
      expect(result).toEqual({
        id: '456def',
        title: 'Test Post',
        content: 'Test Content'
      });
    });

    test('deve converter campos ObjectId para string', () => {
      const objectWithObjectId = {
        _id: { toString: () => '789ghi' },
        __v: 0,
        name: 'Test',
        author: { 
          constructor: { name: 'ObjectId' },
          toString: () => 'author123' 
        },
        category: { 
          constructor: { name: 'ObjectId' },
          toString: () => 'category456' 
        }
      };

      const result = transformDocument(objectWithObjectId);
      
      expect(result).toEqual({
        id: '789ghi',
        name: 'Test',
        author: 'author123',
        category: 'category456'
      });
    });
  });
});
