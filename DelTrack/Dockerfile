FROM node:latest

COPY . /app

WORKDIR /app

RUN npm i

EXPOSE 3000

ENTRYPOINT [ "npm", "start" ]