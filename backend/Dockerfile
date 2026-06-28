FROM node:20-alpine

# Routes use require('../../database') which resolves to /app/database
# so we set WORKDIR to /app/backend — database/ will sit at /app/database/
WORKDIR /app/backend

# Install production deps only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy shared database module (referenced as ../../database from routes)
COPY database/ /app/database/

EXPOSE 5000

CMD ["node", "server.js"]
