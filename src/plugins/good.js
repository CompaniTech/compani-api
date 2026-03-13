let reporters;
if (process.env.NODE_ENV !== 'test') {
  reporters = {
    console: [{
      module: '@hapi/good-squeeze',
      name: 'Squeeze',
      args: [{ log: '*', response: '*', request: '*' }],
    },
    { module: '@hapi/good-console' },
    'stdout',
    ],
  };
} else {
  reporters = {
    console: [{
      module: '@hapi/good-squeeze',
      name: 'Squeeze',
      args: [{ log: '*', request: { include: ['request', 'error'], exclude: ['db'] } }],
    },
    {
      module: '@hapi/good-console',
      args: [{ format: 'DDMMYYYY-HH:MM:ss' }],
    },
    'stdout',
    ],
  };
}

module.exports = { reporters };
