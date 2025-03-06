const CompletionCertificate = require('../models/CompletionCertificate');

exports.getCompletionCertificates = async (query) => {
  const { months } = query;

  const completionCertificates = await CompletionCertificate.find({ month: { $in: months } }, { course: 1, trainee: 1 })
    .populate({
      path: 'course',
      select: 'companies subProgram misc',
      populate: [
        { path: 'companies', select: 'name' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .populate({ path: 'trainee', select: 'identity' })
    .lean();

  return completionCertificates;
};
