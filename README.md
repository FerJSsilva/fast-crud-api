# Fast CRUD API

A lightweight and flexible REST API generator for Fastify and MongoDB. Create fully-featured CRUD APIs with minimal configuration.

## Quick Install

```bash
npm install @ferjssilva/fast-crud-api
```

### Dependencies

- fastify (peer dependency)
- mongoose (peer dependency)
- fastify-plugin

## Features

- 🚀 Full CRUD operations out of the box
- 📄 Automatic pagination
- 🔍 Text search across string fields
- 🔗 Reference population support
- 📱 Nested routes for relationships
- 🎯 Method restrictions per model
- 🛠 Query building with filtering and sorting
- ⚡ MongoDB integration with proper document transformation
- 🔄 Clean REST API endpoints
- 🚨 Comprehensive error handling
- ✅ 100% Test Coverage

## How to Use

### Basic Setup

```javascript
const fastify = require('fastify')()
const mongoose = require('mongoose')
const fastCrudApi = require('@ferjssilva/fast-crud-api')

// Your mongoose models
const User = require('./models/User')
const Post = require('./models/Post')

// Register the plugin
fastify.register(fastCrudApi, {
  prefix: '/api',
  models: [User, Post],
  methods: {
    // Optional: restrict methods per model
    users: ['GET', 'POST', 'PUT', 'DELETE'],
    posts: ['GET', 'POST']
  }
})
```

### API Usage

#### List Resources
```http
GET /api/users?page=1&limit=10
GET /api/users?sort={"createdAt":-1}
GET /api/users?name=John&age=25
GET /api/users?search=john
```

#### Get Single Resource
```http
GET /api/users/:id
GET /api/users/:id?populate=posts
```

#### Create Resource
```http
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Update Resource
```http
PUT /api/users/:id
Content-Type: application/json

{
  "name": "John Updated"
}
```

#### Delete Resource
```http
DELETE /api/users/:id
```

#### Nested Routes
```http
GET /api/users/:userId/posts
```

### Response Format

#### List Response
```javascript
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

#### Single Resource Response
```javascript
{
  "id": "...",
  "field1": "value1",
  "field2": "value2"
}
```

#### Error Response
```javascript
{
  "error": "ErrorType",
  "message": "Error description",
  "details": [] // Optional validation details
}
```

## Project Structure

The library is organized in a modular structure for better maintainability:

```
src/
├── index.js               # Main plugin module
├── utils/
│   ├── document.js        # Document transformation utilities
│   └── query.js           # Query building utilities
├── middleware/
│   └── error-handler.js   # Error handling middleware
├── routes/
│   ├── crud.js            # CRUD route handlers
│   └── nested.js          # Nested route handlers
└── validators/
    └── method.js          # Method validation utilities
```

## Issues and Contact

If you encounter any issues or have suggestions for improvements, please open an issue on our GitHub repository. We appreciate your feedback and contributions!

[Open an Issue](https://github.com/ferjssilva/fast-crud-api/issues)

## Testing

The library includes comprehensive unit tests to ensure the correct functioning of all components:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (useful during development)
npm run test:watch
```

Code coverage results:
- Lines of code: 100%
- Functions: 100%
- Branches: 100%
- Statements: 100%

We've achieved complete coverage for all components:
- Utils: 100% 
- Validators: 100%
- Middleware: 100%
- Routes: 100%

## License

ISC License
