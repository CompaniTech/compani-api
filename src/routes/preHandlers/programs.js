const Boom = require('@hapi/boom');
const get = require('lodash/get');
const Program = require('../../models/Program');
const Category = require('../../models/Category');
const User = require('../../models/User');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');
const { TRAINER } = require('../../helpers/constants');

const { language } = translate;

exports.checkProgramExists = async (req) => {
  const program = await Program.countDocuments({ _id: req.params._id });
  if (!program) throw Boom.notFound();

  return null;
};

exports.getProgramImagePublicId = async (req) => {
  const program = await Program.findOne({ _id: req.params._id }).lean();
  if (!program) throw Boom.notFound();

  return get(program, 'image.publicId') || '';
};

exports.checkCategoryExists = async (req) => {
  const categoryId = get(req, 'payload.categories[0]') ||
    get(req, 'payload.categoryId') || get(req, 'params.categoryId');
  const category = await Category.countDocuments({ _id: categoryId });

  if (!category) throw Boom.notFound();

  return null;
};

exports.authorizeTesterAddition = async (req) => {
  const { payload } = req;
  const user = await User.findOne({ 'local.email': payload.local.email }, { contact: 1, identity: 1 }).lean();
  if (!user && !(get(payload, 'identity.lastname') && get(payload, 'contact.phone'))) throw Boom.badRequest();

  if (user) {
    const program = await Program.countDocuments({ _id: req.params._id, testers: user._id });
    if (program) throw Boom.conflict(translate[language].testerConflict);
  }

  return null;
};

exports.checkTesterInProgram = async (req) => {
  const { _id: programId, testerId } = req.params;
  const program = await Program.countDocuments({ _id: programId, testers: testerId });
  if (!program) throw Boom.conflict(translate[language].testerNotFound);

  return null;
};

exports.authorizeTradeNameAddition = async (req) => {
  const { credentials } = req.auth;
  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  if (vendorRole === TRAINER && !credentials.isProgramEditor) throw Boom.forbidden();

  const tradeNameExists = await Program
    .countDocuments({
      _id: req.params._id,
      'tradeNames.name': {
        $regex: new RegExp(`^${UtilsHelper.escapeRegex(req.payload.tradeName.replace(/\s\s+/g, ' '))}$`, 'i'),
      },
    });
  if (tradeNameExists) throw Boom.conflict(translate[language].tradeNameExists);

  return null;
};

exports.authorizeTradeNameDeletion = async (req) => {
  const { credentials } = req.auth;
  const { _id: programId, tradeNameId } = req.params;

  const vendorRole = get(req, 'auth.credentials.role.vendor.name');
  if (vendorRole === TRAINER && !credentials.isProgramEditor) throw Boom.forbidden();

  const program = await Program.countDocuments({ _id: programId, 'tradeNames._id': tradeNameId });
  if (!program) throw Boom.notFound();

  return null;
};
