const CompletionCertificate = require('../models/CompletionCertificate');

exports.list = async (query) => {
  const { months, course } = query;

  const findQuery = course
    ? { course }
    : { month: { $in: Array.isArray(months) ? months : [months] } };

  const completionCertificates = await CompletionCertificate
    .find(findQuery, { course: 1, trainee: 1, month: 1 })
    .populate([
      ...(months
        ? [{
          path: 'course',
          select: 'companies subProgram misc',
          populate: [
            { path: 'companies', select: 'name' },
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
          ],
        }]
        : []),
      { path: 'trainee', select: 'identity' }]
    )
    .setOptions({ isVendorUser: true })
    .lean();

  return completionCertificates;
};
