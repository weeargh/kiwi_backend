# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app/backend

# Install git (some npm packages might need it)
# We removed alpine-sdk, python3, python3-dev as bcrypt was removed
# RUN apk add --no-cache git # Temporarily removing due to apk errors

# Copy package.json and package-lock.json (or npm-shrinkwrap.json) first
# This leverages Docker cache to avoid reinstalling dependencies on every code change
COPY package*.json ./

# Install app dependencies
# RUN npm ci --omit=dev # Use clean install, omit devDependencies for smaller image
RUN npm install --omit=dev --force # Force install all dependencies including uuid
# If you have native dependencies, you might need build tools:
# RUN apk add --no-cache make gcc g++ python3

# Bundle app source inside Docker image
COPY . .

# Make port available to the world outside this container
# Use the same port as defined in the app (e.g., 3001 or from env var)
EXPOSE 3001

# Define environment variable (optional, can be overridden)
ENV NODE_ENV development

# Command to run the application
CMD [ "npm", "run", "dev" ]
# For production, use: CMD [ "npm", "start" ]
