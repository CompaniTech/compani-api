'use strict';

const { validate } = require('../helpers/authentification');

exports.plugin = {
  name: 'hapi-auth-jwt-2',
  register: (server) => {
    server.register(require('hapi-auth-jwt2'));

    server.auth.strategy('jwt', 'jwt', {
      key: process.env.TOKEN_SECRET,
      urlKey: 'x-access-token',
      headerKey: 'x-access-token',
      verifyOptions: { algorithms: ['HS256'] },
      validate,
    });

    server.auth.default('jwt');
  },
};
