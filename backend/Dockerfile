# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app/backend

# Copy package.json and package-lock.json (or npm-shrinkwrap.json) first
# This leverages Docker cache to avoid reinstalling dependencies on every code change
COPY package*.json ./

# Install app dependencies
RUN npm install
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