const { CompaniDate } = require('../helpers/dates/companiDates');
const { MM_YYYY } = require('../helpers/constants');
const { completionCertificateCreationJob } = require('../jobs/completionCertificateCreation');
const { sendingPendingBillsByEmailJob } = require('../jobs/sendingPendingBillsByEmail');
const { sendingSmsRemindersJob } = require('../jobs/sendingSmsReminders');
const { notionCourseSlotsUpdateJob } = require('../jobs/notionCourseSlotsUpdate');
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
          env: 'production',
        },
        {
          name: 'sendingPendingBillsByEmail',
          time: '0 0 9 * * *',
          request: {
            method: 'GET',
            url: '/scripts/sending-pendingcoursebills-by-email',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: sendingPendingBillsByEmailJob.onComplete,
          env: 'production',
        },
        {
          name: 'sendingSmsReminders',
          time: '0 0 19 * * *',
          request: {
            method: 'GET',
            url: '/scripts/sending-sms-reminders',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: sendingSmsRemindersJob.onComplete,
          env: 'production',
        },
        {
          name: 'notionCourseSlotsUpdate',
          time: '0 0 3 5 * *',
          request: {
            method: 'GET',
            url: '/scripts/notion-course-slots-update',
            auth: { credentials: { scope: ['scripts:run'] }, strategy: 'jwt' },
          },
          onComplete: notionCourseSlotsUpdateJob.onComplete,
          env: 'production',
        },
      ],
    },
  },
];

exports.plugins = plugins;
