const { CompaniDate } = require('../helpers/dates/companiDates');
const { MM_YYYY } = require('../helpers/constants');
const { completionCertificateCreationJob } = require('../jobs/completionCertificateCreation');
const good = require('./good');
const hapiAuthJwt2 = require('./hapiAuthJwt2');
const cron = require('./cron');

const plugins = [
  { plugin: require('@hapi/good'), options: { reporters: good.reporters } },
  { plugin: hapiAuthJwt2 },
  { plugin: require('@hapi/inert') },
  {
    plugin: cron,
    options: {
      jobs: [
        {
          name: 'completionCertificateCreation',
          time: '0 0 5 5 * *',
          request: {
            method: 'GET',
            url: `/scripts/completioncertificates-generation?month=${CompaniDate().format(MM_YYYY)}`,
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: completionCertificateCreationJob.onComplete,
          env: 'development',
        },
      ],
    },
  },
];

if (['production', 'staging'].includes(process.env.NODE_ENV)) {
  plugins.push({
    plugin: require('hapi-sentry'),
    options: {
      client: {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
      },
      trackUser: false,
    },
  });
}

exports.plugins = plugins;
