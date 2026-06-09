FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY client/package.json ./client/
RUN cd client && npm install

COPY server ./server
COPY client ./client
COPY ["болашак табель", "болашак табель"]

RUN cd client && npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DB_DRIVER=sqlite
ENV SQLITE_PATH=/app/server/data/bolashak_hr.db

EXPOSE 3002

CMD ["node", "server/src/bootstrap.js"]
