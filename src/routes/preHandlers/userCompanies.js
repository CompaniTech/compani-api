const Boom = require('@hapi/boom');
const get = require('lodash/get');
const { ObjectId } = require('mongodb');
const {
  TRAINEE_ADDITION,
  DD_MM_YYYY,
  VENDOR_ADMIN,
  TRAINING_ORGANISATION_MANAGER,
  TRAINEE_DELETION,
  DAY,
} = require('../../helpers/constants');
const UserCompany = require('../../models/UserCompany');
const User = require('../../models/User');
const Company = require('../../models/Company');
const CourseHistory = require('../../models/CourseHistory');
const UtilsHelper = require('../../helpers/utils');
const translate = require('../../helpers/translate');
const { CompaniDate } = require('../../helpers/dates/companiDates');

const { language } = translate;

const DETACHMENT_ALLOWED_COMPANY_IDS =
  process.env.DETACHMENT_ALLOWED_COMPANY_IDS.split(',').map(id => new ObjectId(id));

exports.authorizeUserCompanyCreation = async (req) => {
  const { auth: { credentials }, payload } = req;
  const loggedUserVendorRole = get(credentials, 'role.vendor.name');

  const userExists = await User.countDocuments({ _id: payload.user });
  if (!userExists) throw Boom.notFound();

  const companyExists = await Company.countDocuments({ _id: payload.company });
  if (!companyExists) throw Boom.notFound();

  if (!loggedUserVendorRole) {
    const sameCompany = UtilsHelper.hasUserAccessToCompany(credentials, payload.company);
    if (!sameCompany) throw Boom.notFound();
  }

  return null;
};

exports.authorizeUserCompanyEdit = async (req) => {
  const { auth: { credentials }, params, payload } = req;
  const userClientRole = get(credentials, 'role.client.name');

  const isRofOrAdmin = [VENDOR_ADMIN, TRAINING_ORGANISATION_MANAGER].includes(get(credentials, 'role.vendor.name'));
  if (!isRofOrAdmin && !userClientRole) throw Boom.forbidden('Error: user\'s role does\'nt allow this action.');

  // we can only detach EPS trainee for now
  const userCompany = await UserCompany
    .findOne({
      _id: params._id,
      startDate: { $lte: CompaniDate().toISO() },
      endDate: { $exists: false },
      company: { $in: DETACHMENT_ALLOWED_COMPANY_IDS },
    })
    .populate({ path: 'company' })
    .lean();
  if (!userCompany) throw Boom.forbidden(translate[language].userCompanyNotFound);

  const { company, user, startDate } = userCompany;

  const isSameCompany = UtilsHelper.areObjectIdsEquals(company._id, get(credentials, 'company._id'));
  if (!isRofOrAdmin && !isSameCompany) throw Boom.forbidden('Error: user is not from right company.');

  const userExists = await User.countDocuments({ _id: user, role: { $exists: false } });
  if (!userExists) throw Boom.notFound();

  if (CompaniDate(payload.endDate).isBefore(startDate)) {
    throw Boom.forbidden(translate[language].userCompanyDetachmentBeforeAttachment);
  }

  const courseHistories = await CourseHistory
    .find({
      action: { $in: [TRAINEE_ADDITION, TRAINEE_DELETION] },
      trainee: user,
      createdAt: { $gte: CompaniDate(payload.endDate).endOf(DAY).toISO() },
    })
    .sort({ createdAt: -1 })
    .limit(1);

  if (courseHistories.length) {
    if (courseHistories[0].action === TRAINEE_DELETION) return null;

    const errorMessage = translate[language].userDetachmentBeforeLastSubscription
      .replace('{DATE}', CompaniDate(courseHistories[0].createdAt).format(DD_MM_YYYY));
    throw Boom.forbidden(errorMessage);
  }

  return null;
};
