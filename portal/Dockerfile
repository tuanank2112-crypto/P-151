# Cổng phản ánh cư dân (Next.js). All data lives in the Python backend (BACKEND_URL); the portal has no database.
FROM node:24-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -- --webpack

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Ho_Chi_Minh
COPY --from=build /app ./
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
