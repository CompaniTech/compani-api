const Boom = require('@hapi/boom');
const { completionCertificateCreationJob } = require('../jobs/completionCertificateCreation');

const completionCertificateCreation = async (req) => {
  try {
    const { certificateCreated, errors } = await completionCertificateCreationJob.method(req);

    return {
      message: `Completion certificate creation : ${certificateCreated.length} certificates created and
        ${errors.length} errors`,
      data: certificateCreated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { completionCertificateCreation };
