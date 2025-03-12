const Boom = require('@hapi/boom');
const Course = require('../../models/Course');

exports.authorizeGetCompletionCertificates = async (req) => {
  const { course } = req.query;

  if (course) {
    const courseExists = await Course.countDocuments({ _id: course }, { limit: 1 });
    if (!courseExists) throw Boom.notFound();
  }

  return null;
};
