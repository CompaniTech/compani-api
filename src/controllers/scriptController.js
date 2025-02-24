const Boom = require('@hapi/boom');
const completionCertificateCreationJob = require('../jobs/completionCertificateCreation');

const completionCertificateCreation = async (req) => {
  try {
    const { certificateCreated, errors } = await completionCertificateCreationJob.completionCertificateCreation(req);

    return {
      message: `Completion Certificate creation : ${certificateCreated.length} certificats créés et
        ${errors.length} erreurs`,
      data: certificateCreated,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { completionCertificateCreation };
