FROM node:20-alpine

WORKDIR /app

# Dependencies installieren
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

# Quellcode kopieren
COPY server/ ./server/
COPY client/ ./client/

# Datenverzeichnis
RUN mkdir -p /app/server/data

EXPOSE 3000

CMD ["node", "server/index.js"]
