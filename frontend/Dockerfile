# Stage 1: Build the application
FROM node:18-alpine as build-stage

WORKDIR /usr/src/app/frontend

COPY package*.json ./
RUN npm install

COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using a lightweight server
FROM nginx:stable-alpine as production-stage

# Copy the built assets from the build stage
COPY --from=build-stage /usr/src/app/frontend/dist /usr/share/nginx/html

# Copy nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 