FROM node:20-alpine AS base

WORKDIR /app

# Install native dependencies needed for compilation if any (e.g., node-gyp)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js app
RUN npm run build

# We expose 7000 for the Next.js app
EXPOSE 7000

# Set Node environment to production
ENV NODE_ENV=production

# Because we have CLI commands that rely on ts-node and the original source files,
# we use the standard Next.js start command rather than the isolated standalone server,
# or we can run the standalone server while keeping the source files available for the CLI.
# The easiest approach for this mixed Next.js + CLI app is using 'npm run start'.
CMD ["npm", "run", "start"]
