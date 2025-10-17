FROM node:20-slim
WORKDIR /usr/src/app

# Ensure HTTPS and WebSocket TLS connections succeed
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
