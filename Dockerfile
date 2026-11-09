FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs opera.mjs warnings.mjs station-history.mjs location-search.mjs ./
COPY src/data/searchCountries.json ./src/data/searchCountries.json
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]

FROM caddy:2-alpine AS web
COPY --from=frontend-build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/weather-app.caddy /etc/caddy/weather-app.caddy
