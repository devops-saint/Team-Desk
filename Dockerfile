# Team Desk — central server image
#   docker compose up -d        (see docker-compose.yml)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
# optional file readers (PDF / Word / Excel uploads) served locally so browsers don't need the internet
RUN npm install --omit=dev --no-audit --no-fund || echo "Optional readers not installed — browsers will download them when needed"
COPY app ./app
COPY server ./server
COPY scripts ./scripts
ENV TEAMDESK_DATA_DIR=/data \
    TEAMDESK_KEY_FILE=/secrets/teamdesk.key \
    TEAMDESK_HOST=0.0.0.0 \
    TEAMDESK_PORT=8080
RUN mkdir -p /data /secrets && chown -R node:node /data /secrets
USER node
EXPOSE 8080
VOLUME ["/data", "/secrets"]
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/api/ping >/dev/null || exit 1
CMD ["node", "server/central.js"]
