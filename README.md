# Fast CRUD API

A lightweight and flexible REST API generator for Fastify and MongoDB. Create fully-featured CRUD APIs with minimal configuration.

## Quick Install

```bash
npm install fast-crud-api
```

### Dependencies

- fastify
- mongoose
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

## How to Use

### Basic Setup

```javascript
const fastify = require('fastify')()
const mongoose = require('mongoose')
const fastCrudApi = require('fast-crud-api')

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

## Issues and Contact

If you encounter any issues or have suggestions for improvements, please open an issue on our GitHub repository. We appreciate your feedback and contributions!

[Open an Issue](https://github.com/yourusername/fast-crud-api/issues)

## License

MIT License - feel free to use this in your projects!
