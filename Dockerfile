# Stage 1: クライアントビルド
FROM node:24-alpine AS client-builder

WORKDIR /usr/src/app/client

COPY client/package*.json ./

RUN npm install --cache .npm-cache

COPY client/ .

RUN npm run build

# Stage 2: サーバビルド
FROM node:24-alpine AS server-builder

WORKDIR /usr/src/app/server

COPY server/package*.json ./

RUN npm install --cache .npm-cache

COPY server/ .

RUN npm run build

# Stage 3: 最終イメージ
FROM node:24-alpine

RUN addgroup -g 1321 mygroup && adduser -D -u 1321 -G mygroup myuser

WORKDIR /usr/src/app

COPY --from=client-builder /usr/src/app/client/dist ./client/dist
COPY --from=server-builder /usr/src/app/server/dist ./server/dist
COPY client/key.pem ./client/
COPY client/cert.pem ./client/
COPY server/package*.json ./server/

RUN chown -R myuser:mygroup /usr/src/app
USER myuser

RUN cd server && npm install --only=production --cache .npm-cache

EXPOSE 3000
EXPOSE 3001

CMD [ "node", "server/dist/index.js" ]