FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install app dependencies
COPY package.json tsconfig.json ./
COPY wire-apps-js-sdk ./wire-apps-js-sdk
RUN npm install --omit=dev

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build

# Default command
CMD ["npm", "run", "start"]

