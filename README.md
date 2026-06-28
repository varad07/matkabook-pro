# MatkaBook Pro

Matka entry management system with boss and broker panels.

## Prerequisites

- PostgreSQL 18 running on localhost:5432
- Node.js 18+

## First-time Setup

```bash
# 1. Create database (one time)
psql -U postgres -c "CREATE DATABASE matkabook;"

# 2. Apply schema
psql -U postgres -d matkabook -f database/schema.sql

# 3. Load seed data
psql -U postgres -d matkabook -f database/seed.sql

# 4. Install all dependencies
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

## Run the App

```bash
# From project root — starts both backend and frontend
npm start
```

Or run separately:

```bash
npm run backend    # nodemon on port 5000
npm run frontend   # Vite dev server on port 5173
```

## Login Credentials

| Role   | Username | Password  |
|--------|----------|-----------|
| Boss   | boss     | boss123   |
| Broker | brk001   | broker123 |
| Broker | brk002   | broker123 |
| Broker | brk003   | broker123 |

## URLs

| Service       | URL                                      |
|---------------|------------------------------------------|
| Backend API   | http://localhost:5000/api                |
| Frontend      | http://localhost:5173                    |
| Boss Panel    | http://localhost:5173/boss/dashboard     |
| Broker Panel  | http://localhost:5173/broker/home        |

## Architecture

- **Backend**: Node.js + Express + Socket.IO on port 5000
- **Database**: PostgreSQL with pgcrypto for password hashing
- **Frontend**: React + Vite + Tailwind CSS on port 5173
- **Auth**: JWT (8-hour expiry), stored in localStorage
- **Real-time**: Socket.IO events — `new_entry`, `open_declared`, `close_declared`
