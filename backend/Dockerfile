FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and migrations
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Set entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start the application
CMD ["npm", "run", "dev"]
