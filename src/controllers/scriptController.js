const Boom = require('@hapi/boom');
const { completionCertificateCreationJob } = require('../jobs/completionCertificateCreation');
const { sendingPendingBillsByEmailJob } = require('../jobs/sendingPendingBillsByEmail');

const completionCertificateCreation = async (req) => {
  try {
    const { certificateCreated, errors, month } = await completionCertificateCreationJob.method(req);

    return {
      message: `Completion certificate creation : ${certificateCreated.length} certificates created and
        ${errors.length} errors`,
      data: { certificateCreated, errors, month },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const sendingPendingBillsByEmail = async (req) => {
  try {
    const { day, emailSent, pendingCourseBillDeleted } = await sendingPendingBillsByEmailJob.method(req);

    return { data: { day, emailSent, pendingCourseBillDeleted } };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { completionCertificateCreation, sendingPendingBillsByEmail };
