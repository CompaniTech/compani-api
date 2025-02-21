const Boom = require('@hapi/boom');
const completionCertificateCreationJob = require('../jobs/completionCertificateCreation');

const completionCertificateCreation = async (req) => {
  try {
    await completionCertificateCreationJob.completionCertificateCreation(req);

    return { message: 'Completion Certificate creation done' };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { completionCertificateCreation };
