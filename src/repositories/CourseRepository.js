const get = require('lodash/get');
const Course = require('../models/Course');
const CourseSlot = require('../models/CourseSlot');
const { WEBAPP, MOBILE, TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN, SINGLE } = require('../helpers/constants');

exports.findCourseAndPopulate = (query, origin, populateVirtual = false) => Course
  .find(
    query,
    origin === WEBAPP
      ? 'misc type archivedAt estimatedStartDate createdAt maxTrainees trainees hasCertifyingTest interruptedAt'
      : 'misc'
  )
  .populate([
    {
      path: 'companies',
      select: 'name',
      ...!query.companies && { populate: { path: 'holding', populate: { path: 'holding', select: 'name' } } },
    },
    { path: 'holding', select: 'name' },
    {
      path: 'subProgram',
      select: 'program',
      populate: [
        { path: 'program', select: origin === WEBAPP ? 'name' : 'name image description' },
        { path: 'steps', select: 'theoreticalDuration type' },
      ],
    },
    {
      path: 'slots',
      select: origin === MOBILE ? 'startDate endDate step' : 'startDate endDate step address',
      populate: { path: 'step', select: 'type' },
      options: { sort: { startDate: 1 } },
    },
    { path: 'slotsToPlan', select: '_id' },
    ...(origin === WEBAPP
      ? [
        { path: 'trainers', select: 'identity' },
        ...(query.accessRules || query.type === SINGLE ? [{
          path: 'trainees',
          select: '_id company identity',
          populate: { path: 'company', populate: { path: 'company', select: 'name' } },
        }] : []
        ),
        { path: 'operationsRepresentative', select: 'identity.firstname identity.lastname' },
        { path: 'salesRepresentative', select: 'identity.firstname identity.lastname' },
      ]
      : []
    ),
  ])
  .lean({ virtuals: populateVirtual });

exports.findCoursesForExport = async (startDate, endDate, credentials, courseType) => {
  const slots = await CourseSlot.find({ startDate: { $lte: endDate }, endDate: { $gte: startDate } }).lean();
  const courseIds = slots.map(slot => slot.course);
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  return Course
    .find(
      {
        $or: [
          { _id: { $in: courseIds } },
          { estimatedStartDate: { $lte: endDate, $gte: startDate }, archivedAt: { $exists: false } },
        ],
        ...(courseType === SINGLE ? { type: SINGLE } : { type: { $ne: SINGLE } }),
      }
    )
    .select('_id type misc estimatedStartDate expectedBillsCount archivedAt createdAt prices')
    .populate({
      path: 'companies',
      select: 'name',
      populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
    })
    .populate({ path: 'holding', select: 'name' })
    .populate({
      path: 'subProgram',
      select: 'name steps program',
      populate: [{ path: 'program', select: 'name' }, { path: 'steps', select: 'type activities' }],
    })
    .populate({ path: 'trainers', select: 'identity' })
    .populate({ path: 'operationsRepresentative', select: 'identity' })
    .populate({ path: 'contact', select: 'identity' })
    .populate({
      path: 'slots',
      select: 'attendances startDate endDate',
      populate: { path: 'attendances', options: { isVendorUser } },
    })
    .populate({ path: 'slotsToPlan', select: '_id' })
    .populate({ path: 'trainees', select: 'firstMobileConnectionDate' })
    .populate({
      path: 'bills',
      select: 'payer billedAt mainFee billingPurchaseList',
      options: { isVendorUser },
      populate: [
        { path: 'payer.fundingOrganisation', select: 'name' },
        { path: 'payer.company', select: 'name' },
        { path: 'courseCreditNote', options: { isVendorUser }, select: '_id' },
        { path: 'coursePayments', options: { isVendorUser }, select: 'netInclTaxes nature status' },
      ],
    })
    .lean();
};
