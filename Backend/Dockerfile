FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Use a non-root user for better security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser || true
USER appuser

ENV PORT 3000
EXPOSE ${PORT}

CMD [ "node", "server.js" ]
