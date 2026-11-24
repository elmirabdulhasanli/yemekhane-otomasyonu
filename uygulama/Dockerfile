# Yemekhane uygulama servisi · Node.js 22 + Express (Web API, yalnızca JSON döner)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8000/api/saglik || exit 1
CMD ["node", "src/index.js"]
