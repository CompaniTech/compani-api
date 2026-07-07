const Boom = require('@hapi/boom');
const has = require('lodash/has');
const CourseBillingItem = require('../../models/CourseBillingItem');
const translate = require('../../helpers/translate');

const { language } = translate;

exports.authorizeCourseBillingItemCreation = async (req) => {
  const nameAlreadyExists = await CourseBillingItem
    .countDocuments({ name: req.payload.name, type: req.payload.type }, { limit: 1 })
    .collation({ locale: 'fr', strength: 1 });
  if (nameAlreadyExists) throw Boom.conflict(translate[language].courseBillingItemExists);

  return null;
};

exports.authorizeBillingItemsDeletion = async (req) => {
  const { credentials } = req.auth;

  const courseBillingItem = await CourseBillingItem
    .findOne(req.params)
    .populate([
      { path: 'courseBillCount', options: { isVendorUser: has(credentials, 'role.vendor') } },
      { path: 'courseCount', options: { isVendorUser: has(credentials, 'role.vendor') } },
    ])
    .lean();

  if (!courseBillingItem) throw Boom.notFound();

  if (courseBillingItem.courseBillCount || courseBillingItem.courseCount) throw Boom.forbidden();

  return null;
};
