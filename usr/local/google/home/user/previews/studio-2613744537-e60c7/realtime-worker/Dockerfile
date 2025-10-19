
# Use the official Node.js 20 slim image as a base
FROM node:20-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application's code
COPY . .

# Build the TypeScript code
RUN npm run build

# Command to run the application
CMD [ "node", "dist/index.js" ]

    