FROM node:22.14.0-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN npm install -g yarn
RUN yarn install

# Copy application code
COPY . .

# Build the application
RUN yarn build

# Command will be provided by smithery.yaml
CMD ["node", "dist/index.js"]
