'use strict';

const { validate } = require('../helpers/authorization');

exports.plugin = {
  name: 'hapi-auth-jwt-2',
  register: (server) => {
    server.register(require('hapi-auth-jwt2'));

    server.auth.strategy('jwt', 'jwt', {
      key: process.env.TOKEN_SECRET,
      headerKey: 'x-access-token',
      cookieKey: process.env.ALENVI_TOKEN,
      verifyOptions: { algorithms: ['HS256'] },
      validate,
    });

    server.auth.default('jwt');
  },
};
