# Revenge Bomber - Fixed for Vercel

This project has been fixed to work properly with Vercel's serverless environment.

## What Was Fixed

### 1. **Vercel Configuration**
- Added `vercel.json` to properly route all requests to the Express app
- Configured `@vercel/node` builder for serverless function support

### 2. **Server Export**
- Modified `server.js` to export the Express app as a module instead of calling `app.listen()`
- Added conditional logic to support both Vercel (serverless) and local development

### 3. **Session Configuration**
- Updated session middleware to use secure cookies in production
- Added `httpOnly`, `sameSite`, and `maxAge` options for security
- Made session secret configurable via environment variables

### 4. **Error Handling**
- Added global error handler middleware to return JSON errors instead of HTML
- Added 404 handler to return JSON responses
- This fixes the "Unexpected token '<'" error that occurred when HTML error pages were returned

### 5. **Environment Configuration**
- Created `.env.example` for environment variables
- Made the app production-ready with proper security settings

## Deployment to Vercel

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy
```bash
vercel
```

### Step 3: Set Environment Variables
In your Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add `SESSION_SECRET` with a secure random string
3. Add `NODE_ENV` = `production`

## Local Development

```bash
npm install
npm start
```

The app will run on `http://localhost:3000`

## API Endpoints

- `GET /login` - Login page
- `POST /login` - Submit login credentials (username: `admin`, password: `revenge`)
- `GET /dashboard` - Dashboard (requires authentication)
- `POST /api/bomb` - Trigger SMS bombing (requires authentication)

## Credentials

- **Username**: `admin`
- **Password**: `revenge`

## Notes

- All API responses now return proper JSON format
- The "Unexpected token '<'" error has been resolved
- The app is now fully compatible with Vercel's serverless platform
