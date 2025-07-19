FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build
RUN npm run server:build

EXPOSE 3000

CMD [ "node", "server/dist/index.js" ]
