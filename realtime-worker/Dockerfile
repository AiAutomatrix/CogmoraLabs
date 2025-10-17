# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Install CA certificates for secure WebSocket (WSS) and HTTPS connections
RUN apt-get update && apt-get install -y ca-certificates && update-ca-certificates

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

# Build the TypeScript code
RUN npm run build

# Your app binds to port 8080 so you'll use the EXPOSE instruction
EXPOSE 8080

# Define the command to run your app
CMD [ "npm", "start" ]
