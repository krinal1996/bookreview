FROM node:latest
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000
ENTRYPOINT [ "node" ]
CMD ["server.js"]