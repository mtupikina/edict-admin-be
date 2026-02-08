# Edict Admin Backend

NestJS backend for the Edict Admin application.

## Running MongoDB locally (localhost:27017)

The backend expects MongoDB at **`mongodb://localhost:27017/edict`**. Use one of the options below.

### Option A: Docker (any OS)

```bash
docker run -d --name mongodb-edict -p 27017:27017 mongo:7
```

- MongoDB will listen on `localhost:27017`.
- To stop: `docker stop mongodb-edict`
- To start again: `docker start mongodb-edict`
- To remove: `docker rm -f mongodb-edict`

### Option B: macOS (Homebrew)

1. Install MongoDB Community:

```bash
brew tap mongodb/brew
brew install mongodb-community
```

2. Start MongoDB (runs on port 27017 by default):

```bash
brew services start mongodb-community
```

- Stop: `brew services stop mongodb-community`
- Logs: `tail -f /opt/homebrew/var/log/mongodb/mongo.log` (Apple Silicon) or `tail -f /usr/local/var/log/mongodb/mongo.log` (Intel)

### Option C: Windows

1. Download the [MongoDB Community Server](https://www.mongodb.com/try/download/community) MSI.
2. Run the installer; choose “Complete” and install as a service.
3. By default the service listens on `localhost:27017`. Start it from **Services** (e.g. “MongoDB Server”) or:

```bash
net start MongoDB
```

### Option D: Linux (Ubuntu/Debian)

```bash
# Import key and add repo (see https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/)
wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo tee /etc/apt/trusted.gpg.d/mongodb.asc
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod   # start on boot
```

MongoDB will use port **27017** by default. Your `.env` can keep:

```
MONGODB_URI=mongodb://localhost:27017/edict
```

---

## Setup

1. Copy `.env.example` to `.env` and fill in values:
   - `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017/edict`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - `JWT_SECRET` - minimum 32 characters
   - `JWT_EXPIRATION` - default `6h`

2. Configure Google OAuth:
   - Create OAuth 2.0 credentials in Google Cloud Console
   - Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
   - For production, add your production callback URL

3. Install dependencies:

```bash
npm install
```

## Development

```bash
npm run start:dev
```

Runs at `http://localhost:3000`.

## API

- `GET /auth/google` - Initiates Google OAuth
- `GET /auth/google/callback` - OAuth callback (redirects to frontend with token)
- `GET /auth/me` - Get current user (requires JWT)
- `POST /auth/logout` - Logout and invalidate token (requires JWT)
- `GET /users` - List users (requires JWT)
- `POST /users` - Create user (requires JWT)
- `GET /users/:id` - Get user (requires JWT)
- `PATCH /users/:id` - Update user (requires JWT)
- `DELETE /users/:id` - Delete user (requires JWT)

## Admin Access

Only emails in the `allowed_admins` collection can log in. On first run, `mmylymuk@gmail.com` is seeded automatically.

## Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```
