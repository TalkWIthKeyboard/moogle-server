FROM node:8
MAINTAINER TalkWithKeyboard

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV NODE_ENV production
COPY .npmrc /usr/src/app/
COPY package.json /usr/src/app/
COPY package-lock.json /usr/src/app/
RUN npm install --production && npm cache clean --force
COPY . /usr/src/app

EXPOSE 3000
ENTRYPOINT ["npm", "run"]
CMD ["start"]
