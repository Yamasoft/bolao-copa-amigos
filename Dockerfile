FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY app.js ./
COPY index.html ./
COPY styles.css ./
COPY tabela-exemplo.json ./
RUN mkdir -p /data
ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.js"]
