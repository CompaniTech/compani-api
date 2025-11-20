'use strict';

/* eslint-disable no-console */
require('dotenv').config();
const Hapi = require('@hapi/hapi');
const Boom = require('@hapi/boom');

const { mongooseConnection } = require('./src/config/mongoose');
const { routes } = require('./src/routes/index');
const { plugins } = require('./src/plugins/index');
const { DEVELOPMENT, TEST, PRODUCTION } = require('./src/helpers/constants');

const server = Hapi.server({
  port: process.env.NODE_ENV === TEST ? 3001 : (process.env.PORT || 3000),
  routes: {
    log: {
      collect: true,
    },
    cors: {
      origin: ['*'],
      credentials: true,
      additionalHeaders: ['accept-language', 'accept-encoding', 'access-control-request-headers', 'x-access-token'],
    },
    validate: {
      async failAction(request, h, err) {
        request.log('validationError', err.message);
        if (process.env.NODE_ENV === PRODUCTION) throw Boom.badRequest();
        throw err;
      },
    },
  },
});

const init = async () => {
  await server.register([...plugins]);
  await server.register([...routes]);

  const isDevelopment = process.env.NODE_ENV === DEVELOPMENT;
  if (isDevelopment) {
    server.ext('onPostStart', () => { console.log('memoryLog - onPostStart', JSON.stringify(process.memoryUsage())); });
    server.ext(
      'onPostResponse',
      (req, h) => {
        console.log('memoryLog - onPostResponse', req.path, JSON.stringify(process.memoryUsage()));
        return h.continue;
      }
    );
  }

  server.ext(
    'onRequest',
    (req, h) => {
      console.log('memoryLog - onRequest', req.path, isDevelopment ? JSON.stringify(process.memoryUsage()) : '');
      return h.continue;
    }
  );

  server.state(
    process.env.ALENVI_TOKEN,
    {
      isHttpOnly: true,
      ttl: 24 * 60 * 60 * 1000,
      isSecure: !['test', 'development'].includes(process.env.NODE_ENV),
      isSameSite: 'Strict',
      path: '/',
      domain: process.env.TOKEN_DOMAIN,
    }
  );

  server.state(
    process.env.REFRESH_TOKEN,
    {
      isHttpOnly: true,
      ttl: 365 * 24 * 60 * 60 * 1000,
      isSecure: !['test', 'development'].includes(process.env.NODE_ENV),
      isSameSite: 'Strict',
      path: '/',
      domain: process.env.TOKEN_DOMAIN,
    }
  );

  await mongooseConnection(server);

  await server.start();
  server.log('info', `Server running at: ${server.info.uri}`);
};

module.exports = server;

process.on(
  'unhandledRejection',
  (err) => { console.error(err); process.exit(1); }
);

init();
