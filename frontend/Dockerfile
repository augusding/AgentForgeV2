# AgentForge Frontend — Multi-stage build
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Build (mock disabled for production)
COPY . .
ENV VITE_USE_MOCK=false
RUN npm run build

# Production — Nginx serving static files
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
