FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY app.js ./
COPY index.html ./
COPY styles.css ./
COPY tabela-exemplo.json ./
COPY manifest.json ./
COPY sw.js ./
COPY icon.svg ./
COPY icon-192.png ./
COPY icon-512.png ./
RUN mkdir -p /data
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
