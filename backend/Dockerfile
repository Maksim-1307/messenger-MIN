# 1. dependencies installation
FROM node:lts AS deps
WORKDIR /app
COPY package*.json ./
# all
RUN npm ci

# 2. development: run via tsx with hot reload
FROM deps AS development
WORKDIR /app
COPY . .
CMD ["npx", "tsx", "watch", "src/index.ts"]

# 3. build ts into js
FROM deps AS build
WORKDIR /app
COPY . .
# compile
RUN npm run build
# remove dev dependencies
RUN npm prune --production

# 4. runner (for production)
FROM node:lts-alpine AS runner
WORKDIR /app

RUN mkdir -p /app/uploads/images /app/uploads/files && \
    chown -R node:node /app

USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules 
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# static files
# COPY --from=build --chown=node:node /app/public ./public 

EXPOSE 5001
CMD ["node", "dist/index.js"]