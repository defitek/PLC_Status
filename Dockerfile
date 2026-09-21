FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY server.js database.js schema.sql ./
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/plc-status.db

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
