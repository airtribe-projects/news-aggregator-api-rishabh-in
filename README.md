# News Aggregator API

An Express.js API for user-based news aggregation. The app supports user registration and login, JWT-protected routes, preference management, NewsAPI-powered article fetching, in-memory caching, read/favorite article actions, and keyword search.

Data is stored in memory for this assignment, so users, preferences, cached news, and article actions reset when the server restarts.

## Features

- User registration with email/password validation
- Password hashing with bcrypt
- Login with JWT token generation
- JWT authentication middleware for protected routes
- User news preferences
- News fetching with axios and NewsAPI
- In-memory news cache with periodic refresh
- Mark articles as read or favorite
- Search cached/fetched news by keyword
- JSON error responses for invalid input and unauthorized requests

## Installation

```bash
npm install
```

## Environment Variables

Create environment variables before running the server if you want live NewsAPI results:

```bash
JWT_SECRET=your_jwt_secret
NEWS_API_KEY=your_newsapi_key
```

`JWT_SECRET` is optional in local development because the app provides a fallback secret. `NEWS_API_KEY` is optional for local testing; without it, `GET /news` returns an empty `news` array with a configuration message.

## Run the Server

```bash
node app.js
```

The server listens on:

```text
http://localhost:3000
```

## Testing

```bash
npm run test
```

## Authentication

Protected routes require a bearer token from `POST /login`:

```text
Authorization: Bearer <token>
```

## API Endpoints

### Register

```http
POST /register
```

Alias:

```http
POST /users/signup
```

Request body:

```json
{
  "name": "Clark Kent",
  "email": "clark@example.com",
  "password": "secret123",
  "preferences": ["technology", "business"]
}
```

Response:

```json
{
  "message": "User registered successfully"
}
```

### Login

```http
POST /login
```

Alias:

```http
POST /users/login
```

Request body:

```json
{
  "email": "clark@example.com",
  "password": "secret123"
}
```

Response:

```json
{
  "token": "jwt_token_here"
}
```

### Get Preferences

```http
GET /preferences
```

Alias:

```http
GET /users/preferences
```

Requires authentication.

Response:

```json
{
  "preferences": ["technology", "business"]
}
```

### Update Preferences

```http
PUT /preferences
```

Alias:

```http
PUT /users/preferences
```

Requires authentication.

Request body can be an array:

```json
{
  "preferences": ["technology", "sports"]
}
```

Or an object:

```json
{
  "categories": ["technology", "business"],
  "languages": ["en"]
}
```

Response:

```json
{
  "preferences": ["technology", "sports"]
}
```

### Get News

```http
GET /news
```

Requires authentication.

Fetches news based on the logged-in user's preferences. Results are cached in memory for 5 minutes.

Response:

```json
{
  "news": []
}
```

### Mark Article As Read

```http
POST /news/:id/read
```

Requires authentication.

Response:

```json
{
  "message": "Article marked as read",
  "article": {
    "id": "article_id"
  }
}
```

### Mark Article As Favorite

```http
POST /news/:id/favorite
```

Requires authentication.

Response:

```json
{
  "message": "Article marked as favorite",
  "article": {
    "id": "article_id"
  }
}
```

### Get Read Articles

```http
GET /news/read
```

Requires authentication.

Response:

```json
{
  "news": []
}
```

### Get Favorite Articles

```http
GET /news/favorites
```

Requires authentication.

Response:

```json
{
  "news": []
}
```

### Search News

```http
GET /news/search/:keyword
```

Requires authentication.

Response:

```json
{
  "news": []
}
```

## Error Responses

Invalid inputs return `400`, unauthorized requests return `401`, duplicate registration returns `409`, and external news API failures return `502`.

Example:

```json
{
  "message": "Invalid registration input",
  "errors": ["Email must be valid"]
}
```
