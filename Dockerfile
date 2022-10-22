# STAGE: INSTALL DEPENDENCIES
FROM node:16-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
#RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm i

# STAGE: BUILD ARTIFACTS
FROM node:16-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY config/config.example.js ./config/config.js
RUN npm run build

# STAGE: RUN
FROM node:16-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

#RUN addgroup --system --gid 5001 nodejs
#RUN adduser --system --uid 5001 nodejs
USER node

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY . .


VOLUME ['/app/logs', '/app/config']
EXPOSE 3000

ENV PORT 3000

CMD ["node", "server/index.js"]
