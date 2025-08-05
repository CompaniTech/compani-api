const Boom = require('@hapi/boom');
const has = require('lodash/has');
const CourseBillingItem = require('../../models/CourseBillingItem');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeCourseBillingItemCreation = async (req) => {
  const nameAlreadyExists = await CourseBillingItem
    .countDocuments({ name: req.payload.name }, { limit: 1 })
    .collation({ locale: 'fr', strength: 1 });
  if (nameAlreadyExists) throw Boom.conflict(translate[language].courseBillingItemExists);

  return null;
};

exports.authorizeBillingItemsDeletion = async (req) => {
  const { credentials } = req.auth;

  const courseBillingItems = await CourseBillingItem
    .countDocuments(req.params)
    .populate({ path: 'courseBillCount', options: { isVendorUser: has(credentials, 'role.vendor') } })
    .leaan();

  if (!courseBillingItems) throw Boom.notFound();

  if (courseBillingItems.courseBillCount) throw Boom.forbidden();

  return null;
};
