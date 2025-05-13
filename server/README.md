# RustyPages API Server

This is the API server for RustyPages, providing user authentication and book synchronization using MongoDB.

## Prerequisites

- Node.js (v12.x recommended)
- MongoDB Atlas account or local MongoDB installation

## Setup

1. Clone the repository
2. Navigate to the server directory
3. Install dependencies:

```bash
npm install
```

4. The MongoDB connection string is already set up for the provided Atlas cluster. If you need to change it, update the `MONGODB_URI` in `server.js`.

## Running the Server

For development:

```bash
npm run dev
```

For production:

```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/register`: Register a new user
  - Body: `{ "username": "user", "password": "pass" }`
  
- `POST /api/login`: Login and get token
  - Body: `{ "username": "user", "password": "pass" }`
  - Returns: `{ "success": true, "token": "jwt-token", "userId": "user-id" }`

### Books (All require JWT Authentication)

- `GET /api/books`: Get all user's books
  - Headers: `Authorization: Bearer <token>`
  
- `POST /api/books`: Add a new book or update existing
  - Headers: `Authorization: Bearer <token>`
  - Body: Book object
  
- `PUT /api/books/:id`: Update a book
  - Headers: `Authorization: Bearer <token>`
  - Body: Book object
  
- `DELETE /api/books/:id`: Delete a book
  - Headers: `Authorization: Bearer <token>`

## Deployment

This server can be deployed to any Node.js hosting platform like Heroku, Render, or Vercel.

For Render:
1. Create a new Web Service
2. Connect to your GitHub repository
3. Set the Build Command to `npm install`
4. Set the Start Command to `npm start` 
5. Set environment variables if needed

## Security Considerations

- The JWT secret key is hardcoded for simplicity. In a production environment, set it as an environment variable.
- MongoDB password is included in the connection string. For production, use environment variables.
- CORS is enabled for all origins. For production, restrict to specific origins. 