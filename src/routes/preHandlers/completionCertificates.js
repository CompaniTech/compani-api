const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Course = require('../../models/Course');
const CompletionCertificate = require('../../models/CompletionCertificate');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeGetCompletionCertificates = async (req) => {
  const { course } = req.query;

  if (course) {
    const courseExists = await Course.countDocuments({ _id: course });
    if (!courseExists) throw Boom.notFound();
  }

  return null;
};

exports.authorizeCompletionCertificateEdit = async (req) => {
  const { _id: completionCertificateId } = req.params;

  const completionCertificate = await CompletionCertificate.findOne({ _id: completionCertificateId }).lean();
  if (!completionCertificate) throw Boom.notFound();

  if (get(completionCertificate, 'file.link')) {
    throw Boom.conflict(translate[language].completionCertificateAlreadyGenerated);
  }

  return null;
};
