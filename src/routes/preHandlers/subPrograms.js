const Boom = require('@hapi/boom');
const get = require('lodash/get');
const SubProgram = require('../../models/SubProgram');
const Program = require('../../models/Program');
const Company = require('../../models/Company');
const Step = require('../../models/Step');
const CourseSlot = require('../../models/CourseSlot');
const { PUBLISHED, DRAFT, TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN } = require('../../helpers/constants');
const translate = require('../../helpers/translate');
const UtilsHelper = require('../../helpers/utils');

const { language } = translate;

exports.authorizeStepDetachment = async (req) => {
  const subProgram = await SubProgram.findOne({ _id: req.params._id, steps: req.params.stepId }).lean();
  if (!subProgram) throw Boom.notFound();
  if (subProgram.status !== DRAFT) throw Boom.forbidden();

  const courseSlot = await CourseSlot.countDocuments({ step: req.params.stepId });
  if (courseSlot) throw Boom.conflict();

  return null;
};

exports.authorizeStepAdditionAndGetSubProgram = async (req) => {
  const subProgram = await SubProgram.findOne({ _id: req.params._id }, { steps: 1, status: 1 }).lean();
  if (!subProgram) throw Boom.notFound();
  if (subProgram.status !== DRAFT) throw Boom.forbidden();

  return subProgram;
};

exports.authorizeSubProgramUpdate = async (req) => {
  const subProgram = await SubProgram.findOne({ _id: req.params._id })
    .populate({ path: 'program', select: '_id' })
    .populate({ path: 'steps', select: '_id type', populate: { path: 'activities', populate: 'cards' } })
    .lean({ virtuals: true });

  if (!subProgram) throw Boom.notFound();

  if (subProgram.status !== DRAFT) throw Boom.forbidden();

  if (req.payload.status === PUBLISHED && !subProgram.areStepsValid) throw Boom.forbidden();

  if (req.payload.steps) {
    const onlyOrderIsUpdated = subProgram.steps.length === req.payload.steps.length &&
      subProgram.steps.every(value => req.payload.steps.includes(value._id.toHexString())) &&
      req.payload.steps.every(value => subProgram.steps.map(s => s._id.toHexString()).includes(value));
    if (!onlyOrderIsUpdated) return Boom.badRequest();
  }

  if (req.payload.status === PUBLISHED && subProgram.isStrictlyELearning) {
    if (req.payload.accessCompany) {
      const company = await Company.countDocuments({ _id: req.payload.accessCompany });
      if (!company) throw Boom.badRequest();
    }

    const prog = await Program.findOne({ _id: subProgram.program })
      .populate({
        path: 'subPrograms',
        select: 'steps',
        match: { status: PUBLISHED, _id: { $ne: subProgram._id } },
        populate: { path: 'steps', select: 'type' },
      })
      .lean({ virtuals: true });

    if (prog.subPrograms.some(sp => sp.isStrictlyELearning)) {
      throw Boom.conflict(translate[language].eLearningSubProgramAlreadyExists);
    }
  }

  return null;
};

exports.authorizeGetSubProgram = async (req) => {
  const subProgram = await SubProgram.findOne({ _id: req.params._id })
    .populate({ path: 'program', select: 'testers' })
    .lean();
  if (!subProgram) throw Boom.notFound();

  const loggedUserVendorRole = get(req, 'auth.credentials.role.vendor.name');
  if ([TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole)) return null;

  const loggedUserId = get(req, 'auth.credentials._id');
  const testerList = subProgram.program.testers.map(tester => tester.toHexString());
  if (!testerList.includes(loggedUserId)) throw Boom.forbidden();

  return null;
};

exports.authorizeGetDraftELearningSubPrograms = async (req) => {
  const loggedUserVendorRole = get(req, 'auth.credentials.role.vendor.name');
  if ([TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(loggedUserVendorRole)) return null;

  const loggedUserId = get(req, 'auth.credentials._id');
  const testerRestrictedPrograms = await Program.find({ testers: loggedUserId }, { _id: 1 }).lean();

  return testerRestrictedPrograms.map(program => program._id);
};

exports.authorizeStepReuse = async (req) => {
  const { subProgram } = req.pre;
  const { steps } = req.payload;

  const stepsExist = await Step.countDocuments({ _id: steps });
  if (!stepsExist) throw Boom.notFound();

  const stepsAlreadyAttached = UtilsHelper.doesArrayIncludeId(subProgram.steps, steps);
  if (stepsAlreadyAttached) throw Boom.forbidden();

  return null;
};
