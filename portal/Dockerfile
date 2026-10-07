# Cổng phản ánh cư dân (Next.js). Start = migrate → seed (only when empty) → next start.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The pool connects lazily: a placeholder URL is enough to build, the real one comes from compose at runtime
ENV DATABASE_URL=postgres://build:build@localhost:5432/build NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 TZ=Asia/Ho_Chi_Minh
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npx next start -p 3000"]
