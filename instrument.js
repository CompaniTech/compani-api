const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

if (['staging', 'production'].includes(process.env.NODE_ENV)) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    sendDefaultPii: true,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: 0.1,
    profileSessionSampleRate: 0.1,
    enableLogs: true,
  });
}
