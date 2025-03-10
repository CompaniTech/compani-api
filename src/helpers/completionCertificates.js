const CompletionCertificate = require('../models/CompletionCertificate');

exports.list = async (query) => {
  const months = Array.isArray(query.months) ? query.months : [query.months];

  const completionCertificates = await CompletionCertificate
    .find({ month: { $in: months } }, { course: 1, trainee: 1, month: 1 })
    .populate({
      path: 'course',
      select: 'companies subProgram misc',
      populate: [
        { path: 'companies', select: 'name' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .populate({ path: 'trainee', select: 'identity' })
    .setOptions({ isVendorUser: true })
    .lean();

  return completionCertificates;
};
