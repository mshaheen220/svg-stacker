# syntax=docker/dockerfile:1

## ---- Dependencies ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

## ---- Dev server (Vite with hot reload; source is bind-mounted) ----
FROM deps AS dev
ENV VITE_POLL=1
EXPOSE 5181
CMD ["npm", "run", "dev", "--", "--host"]

## ---- Build static assets ----
FROM deps AS build
COPY . .
RUN npm run build

## ---- Runtime: static files only, there is no backend ----
FROM nginx:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost/ >/dev/null || exit 1
