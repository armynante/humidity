# Stage 1: Build Stage
FROM --platform=linux/amd64 node:20.12.2-alpine3.18 AS build-stage

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and pnpm-lock.yaml files to the container
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install

# Copy the rest of the application code to the container
COPY . .

# Compile TypeScript code to JavaScript
RUN pnpm run build

# Stage 2: Production Stage
FROM  --platform=linux/amd64 node:20.12.2-alpine3.18 AS production-stage

# Set the working directory inside the container
WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Copy the compiled code from the build stage
COPY --from=build-stage /app/dist ./dist

# Copy the necessary files from the build stage
COPY --from=build-stage /app/package.json ./
COPY --from=build-stage /app/pnpm-lock.yaml ./

# Install only production dependencies
RUN npm install -g pnpm && pnpm install --prod

# Expose the port the app will run on
EXPOSE 3000

# Command to run the application
CMD ["pm2-runtime", "dist/index.js"]
