FROM node:18-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]

