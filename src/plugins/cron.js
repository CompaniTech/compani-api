'use strict';

const { CronJob } = require('cron');
const Joi = require('joi');

const internals = {};

internals.callJob = (server, job) => async () => {
  const res = await server.inject(job.request);

  if (job.onComplete) job.onComplete(server, res.result.data);
};

internals.jobSchema = Joi.object({
  name: Joi.string().required(),
  time: Joi.string().required(),
  request: Joi.object().required(),
  onComplete: Joi.func().required(),
  env: Joi.string().valid('production', 'development', 'staging'),
});

exports.plugin = {
  name: 'cron',
  register(server, options) {
    const jobs = {};
    server.log('options.job', options);
    if (!options.jobs || !options.jobs.length) {
      server.log(['cron'], 'No Jobs provided.');
    } else {
      for (const job of options.jobs) {
        const validationResults = internals.jobSchema.validate(job);
        if (validationResults.error) throw validationResults.error;
        if (jobs[job.name]) throw new Error('Job already defined.');
        if (job.env && job.env !== process.env.NODE_ENV) {
          server.log(['cron'], `${job.name} job can only run on ${job.env} env.`);
          continue;
        }
        try {
          jobs[job.name] = new CronJob(job.time, internals.callJob(server, job), job.onComplete, false, 'Europe/Paris');
        } catch (e) {
          server.log(['error', 'cron'], e);
        }
      }

      server.ext('onPostStart', () => {
        for (const key in jobs) {
          jobs[key].start();
        }
      });

      server.ext('onPreStop', () => {
        for (const key in jobs) {
          jobs[key].stop();
        }
      });
    }
  },
};
