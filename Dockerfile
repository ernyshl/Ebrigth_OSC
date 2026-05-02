FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown nodejs:nodejs /app
USER nodejs
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci
COPY --chown=nodejs:nodejs prisma ./prisma/
RUN npx prisma generate
COPY --chown=nodejs:nodejs . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
