const get = require('lodash/get');
const Course = require('../models/Course');
const { WEBAPP, MOBILE, TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN } = require('../helpers/constants');

exports.findCourseAndPopulate = (query, origin, populateVirtual = false) => Course
  .find(
    query,
    origin === WEBAPP
      ? 'misc type archivedAt estimatedStartDate createdAt maxTrainees trainees hasCertifyingTest'
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
        ...(query.accessRules ? [{
          path: 'trainees',
          select: '_id company',
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

exports.findCoursesForExport = async (courseIdsFromSlots, startDate, endDate, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  return Course
    .find(
      {
        $or: [
          { _id: { $in: courseIdsFromSlots } },
          { estimatedStartDate: { $lte: endDate, $gte: startDate }, archivedAt: { $exists: false } },
        ],
      }
    )
    .select('_id type misc estimatedStartDate expectedBillsCount archivedAt createdAt')
    .populate({ path: 'companies', select: 'name' })
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
        { path: 'coursePayments', options: { isVendorUser }, select: 'netInclTaxes nature' },
      ],
    })
    .lean()
    .cursor();
};

exports.findCoursesIdsForExport = async (courseIdsFromSlots, startDate, endDate) => {
  const courses = await Course
    .find(
      {
        $or: [
          { _id: { $in: courseIdsFromSlots } },
          { estimatedStartDate: { $lte: endDate, $gte: startDate }, archivedAt: { $exists: false } },
        ],
      }
    )
    .lean();

  return courses.map(course => course._id);
};
