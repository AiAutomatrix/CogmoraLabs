# IMPORTANT NOTE: This Dockerfile is designed for a long-running Node.js service,
# such as a Cloud Run worker for persistent WebSockets. It is NOT configured
# for deploying Firebase Cloud Functions.

# Use an official Node.js runtime as a parent image.
# Using Node.js 20, which is a Long Term Support (LTS) version.
FROM node:20-slim

# Set the working directory in the container.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory.
# This step is separated to leverage Docker's layer caching.
COPY package*.json ./

# Install app dependencies.
# Using 'npm ci' which is generally faster and safer for production builds.
RUN npm ci --only=production

# Bundle app source code inside the Docker image.
COPY . .

# Your app binds to port 8080, so it needs to be exposed.
# Cloud Run automatically sets the PORT environment variable.
EXPOSE 8080

# Define the command to run your app.
# This assumes your main script is in 'lib/index.js' after being compiled from TypeScript.
CMD ["node", "lib/index.js"]
