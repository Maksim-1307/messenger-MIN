# 1. dependencies installation
FROM node:lts-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# 2. development hot reload server
FROM base AS development
WORKDIR /app
COPY . .

ARG VITE_API_URL
ARG VITE_SOCKET_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# default vite port, --host to allow connections from outside the container
EXPOSE 5173
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]

# 3. build
FROM base AS builder
WORKDIR /app
COPY . .

# buildtime env vars
ARG VITE_API_URL
ARG VITE_SOCKET_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# 4. runner (static files distribution via nginx)
FROM nginx:stable-alpine AS runner

# copy from build
COPY --from=builder /app/dist /usr/share/nginx/html
# copy config
COPY nginx.conf /etc/nginx/templates/default.conf.template

# variables for nginx config (proxying)
ARG API_URL
ARG SOCKET_URL
ENV API_URL=$API_URL
ENV SOCKET_URL=$SOCKET_URL

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]