exports.routes = [
  {
    plugin: require('./users'),
    routes: {
      prefix: '/users'
    }
  },
  {
    plugin: require('./roles'),
    routes: {
      prefix: '/roles'
    }
  },
  {
    plugin: require('./upload'),
    routes: {
      prefix: '/upload'
    }
  }
];
