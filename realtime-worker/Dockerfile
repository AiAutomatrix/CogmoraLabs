FROM node:20-slim

# Install CA certificates for secure WebSocket (WSS) and HTTPS connections
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
