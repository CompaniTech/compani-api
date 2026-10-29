const { ObjectId } = require('mongodb');
const get = require('lodash/get');
const has = require('lodash/has');
const pick = require('lodash/pick');
const CompletionCertificatePdf = require('../data/pdf/completionCertificate');
const CompletionCertificate = require('../models/CompletionCertificate');
const TrainingContract = require('../models/TrainingContract');
const Course = require('../models/Course');
const CourseBill = require('../models/CourseBill');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');
const { MM_YYYY, MONTH, DD_MM_YYYY, SHORT_DURATION_H_MM, OFFICIAL } = require('./constants');
const UtilsHelper = require('./utils');
const HourlyPaymentPlansHelper = require('./hourlyPaymentPlans');
const CourseSlotsHelper = require('./courseSlots');
const CoursesHelper = require('./courses');
const GCloudStorageHelper = require('./gCloudStorage');

exports.list = async (query, credentials) => {
  const { months, course } = query;

  let companies = [];

  if (query.companies) companies = Array.isArray(query.companies) ? query.companies : [query.companies];

  const findQuery = course
    ? { course }
    : { month: { $in: Array.isArray(months) ? months : [months] } };

  const requestingOwnInfos = companies.every(company => UtilsHelper.hasUserAccessToCompany(credentials, company));
  const completionCertificates = await CompletionCertificate
    .find(findQuery)
    .populate([
      ...(months
        ? [{
          path: 'course',
          select: 'companies subProgram misc tradeName',
          populate: [
            {
              path: 'companies',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
            { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
          ],
        }]
        : []),
      {
        path: 'trainee',
        select: 'identity',
        populate: { path: 'company', populate: { path: 'company', select: ' _id' } },
      }]
    )
    .sort({ createdAt: 1 })
    .setOptions({ isVendorUser: has(credentials, 'role.vendor.name'), ...(companies.length && { requestingOwnInfos }) })
    .lean();

  if (companies.length) {
    const filteredCertificates = completionCertificates.filter((certificate) => {
      const traineeCompanyId = get(certificate, 'trainee.company._id');
      return !!certificate.file && UtilsHelper.doesArrayIncludeId(companies, traineeCompanyId);
    });

    return filteredCertificates;
  }

  return completionCertificates;
};

const computeMonthDurations = async (course, month, traineeId) => {
  const startOfMonth = CompaniDate(month, MM_YYYY).startOf(MONTH).toISO();
  const endOfMonth = CompaniDate(month, MM_YYYY).endOf(MONTH).toISO();

  const dates = { startDate: startOfMonth, endDate: endOfMonth };
  const { slotsWithAttendance, eLearningDuration } = await CoursesHelper.getTraineeDurations(course, traineeId, dates);

  const unsubscribedAttendances = await CoursesHelper.getUnsubscribedAttendances(
    { ...pick(course, ['_id', 'trainees', 'companies']), subPrograms: get(course, 'subProgram.program.subPrograms') },
    true
  );
  const slotsWithUnsubscribedAttendance = unsubscribedAttendances
    .filter(a => CompaniDate(a.courseSlot.startDate).isSameOrBetween(startOfMonth, endOfMonth))
    .map(a => a.courseSlot);

  const allSlotsWithAttendance = [...slotsWithAttendance, ...slotsWithUnsubscribedAttendance];
  const durationPerStep = CourseSlotsHelper.getDurationPerStep(allSlotsWithAttendance);
  const traineePresence = Object.values(durationPerStep)
    .reduce((acc, duration) => acc.add(duration), CompaniDuration());

  return { startOfMonth, endOfMonth, traineePresence, eLearningDuration, durationPerStep };
};

exports.generate = async (completionCertificateId) => {
  const VAEI_SUBPROGRAM_IDS = process.env.VAEI_SUBPROGRAM_IDS.split(',').map(id => new ObjectId(id));
  const PRI_SUBPROGRAM_IDS = process.env.PRI_SUBPROGRAM_IDS.split(',').map(id => new ObjectId(id));

  const completionCertificate = await CompletionCertificate
    .findOne({ _id: completionCertificateId })
    .populate([
      {
        path: 'course',
        select: 'subProgram slots companies trainees tradeName hourlyPaymentPlan',
        populate: [
          {
            path: 'slots',
            select: 'startDate endDate trainers step',
            options: { sort: { startDate: 1 } },
            populate: { path: 'step', select: 'durationCountedPerTrainer' },
          },
          {
            path: 'subProgram',
            select: 'program steps hourlyPaymentPlans',
            populate: [
              { path: 'program', select: 'subPrograms' },
              { path: 'steps', select: 'activities type theoreticalDuration' },
            ],
          },
        ],
      },
      {
        path: 'trainee',
        select: 'identity',
        populate: { path: 'company', populate: { path: 'company', select: 'name' } },
      },
    ])
    .setOptions({ isVendorUser: true })
    .lean();

  const { course, month, trainee } = completionCertificate;

  const certificates = await CompletionCertificate
    .find({ course: course._id, trainee: trainee._id, _id: { $ne: completionCertificate._id } }, { month: 1 })
    .setOptions({ isVendorUser: true })
    .lean();
  const is1stCertificate = certificates.every(c => CompaniDate(month, MM_YYYY).isBefore(CompaniDate(c.month, MM_YYYY)));

  let trainingContractStartDate;
  if (is1stCertificate) {
    const trainingContract = await TrainingContract
      .findOne({ course: course._id, company: trainee.company._id }, { startDate: 1 })
      .sort({ startDate: 1 })
      .lean();
    if (trainingContract && trainingContract.startDate) {
      trainingContractStartDate = CompaniDate(trainingContract.startDate).format(DD_MM_YYYY);
    }
  }

  const durations = await computeMonthDurations(course, month, trainee._id);
  const { startOfMonth, endOfMonth, traineePresence, durationPerStep, eLearningDuration } = durations;

  const formattedELearningDuration = CompaniDuration(eLearningDuration).format(SHORT_DURATION_H_MM);

  const vaeSupportConfig = UtilsHelper.getVAESupportConfigs(course.subProgram._id);

  let vaeSupportData;
  let newVAESupportRemainingMinutes;

  if (vaeSupportConfig) {
    const firstSlotStartDate = course.slots[0].startDate;
    const vaeSupportStartMonth = CompaniDate(firstSlotStartDate)
      .startOf(MONTH)
      .add(`P${vaeSupportConfig.offsetMonths}M`)
      .toISO();

    if (CompaniDate(startOfMonth).isSameOrAfter(vaeSupportStartMonth)) {
      const otherCertificatesWithVAESupport = await CompletionCertificate
        .find(
          {
            _id: { $ne: completionCertificate._id },
            course: course._id,
            trainee: trainee._id,
            vaeSupportRemainingMinutes: { $exists: true },
          },
          { vaeSupportRemainingMinutes: 1 }
        )
        .setOptions({ isVendorUser: true })
        .sort({ vaeSupportRemainingMinutes: 1 })
        .lean();
      const lastCertificateWithVAESupport = otherCertificatesWithVAESupport[0];

      if (!lastCertificateWithVAESupport || lastCertificateWithVAESupport.vaeSupportRemainingMinutes > 0) {
        const remainingMinutes = lastCertificateWithVAESupport
          ? lastCertificateWithVAESupport.vaeSupportRemainingMinutes
          : vaeSupportConfig.vaeDurationMinutes;
        const remainingBudget = CompaniDuration({ minutes: remainingMinutes });

        const vaeSupportThisMonth = traineePresence.isLongerThan(remainingBudget)
          ? remainingBudget
          : traineePresence;
        const regularThisMonth = traineePresence.subtract(vaeSupportThisMonth);

        vaeSupportData = {
          vaeDuration: vaeSupportThisMonth.format(SHORT_DURATION_H_MM),
          regularDuration: regularThisMonth.asMinutes() > 0 ? regularThisMonth.format(SHORT_DURATION_H_MM) : null,
        };
        newVAESupportRemainingMinutes = Math.max(0, remainingMinutes - Math.round(traineePresence.asMinutes()));
      }
    }
  }

  const traineeIdentity = UtilsHelper.formatIdentity(trainee.identity, 'FL');
  const data = {
    trainee: {
      identity: traineeIdentity,
      attendanceDuration: traineePresence.format(SHORT_DURATION_H_MM),
      eLearningDuration: formattedELearningDuration,
      companyName: trainee.company.name,
    },
    startDate: CompaniDate(startOfMonth).format(DD_MM_YYYY),
    endDate: CompaniDate(endOfMonth).format(DD_MM_YYYY),
    date: CompaniDate().format(DD_MM_YYYY),
    isVAEISubProgram: UtilsHelper.doesArrayIncludeId(VAEI_SUBPROGRAM_IDS, course.subProgram._id),
    isPRISubProgram: UtilsHelper.doesArrayIncludeId(PRI_SUBPROGRAM_IDS, course.subProgram._id),
    certificateGenerationModeIsMonthly: true,
    programName: (course.tradeName || '').toUpperCase(),
    ...vaeSupportData && { vaeSupportData },
    ...trainingContractStartDate && { trainingContractStartDate },
  };

  const pdf = await CompletionCertificatePdf.getPdf(data, OFFICIAL);
  const fileName = `certificat_realisation_${traineeIdentity}_${month}`;
  const fileUploaded = await GCloudStorageHelper
    .uploadCourseFile({ fileName, file: pdf, contentType: 'application/pdf' });

  const updatePayload = { file: fileUploaded };
  if (newVAESupportRemainingMinutes !== undefined) {
    updatePayload.vaeSupportRemainingMinutes = newVAESupportRemainingMinutes;
  }
  await CompletionCertificate.updateOne({ _id: completionCertificateId }, { $set: updatePayload });

  if (course.hourlyPaymentPlan) {
    const billsToUpdate = await CourseBill
      .find(
        {
          course: course._id,
          maturityDate: { $gte: startOfMonth, $lte: endOfMonth },
          'mainFee.price': { $in: [0, null] },
        },
        { _id: 1 }
      )
      .setOptions({ isVendorUser: true })
      .lean();

    if (billsToUpdate.length) {
      const hourlyPaymentPlan = course.subProgram.hourlyPaymentPlans
        .find(hpp => UtilsHelper.areObjectIdsEquals(hpp._id, course.hourlyPaymentPlan));
      const price = HourlyPaymentPlansHelper
        .getPriceFromDurations(hourlyPaymentPlan, durationPerStep, eLearningDuration);

      await CourseBill
        .updateMany({ _id: { $in: billsToUpdate.map(b => b._id) } }, { $set: { 'mainFee.price': price } });
    }
  }
};

exports.create = async payload => CompletionCertificate.create(payload);

exports.deleteFile = async (completionCertificateId) => {
  const completionCertificate = await CompletionCertificate
    .findOne({ _id: completionCertificateId })
    .populate({ path: 'course', select: 'hourlyPaymentPlan' })
    .lean();

  let certificatesToDelete = [completionCertificate];
  if (completionCertificate.vaeSupportRemainingMinutes) {
    const { course, trainee, vaeSupportRemainingMinutes } = completionCertificate;
    const completionCertificateWithRemainingMinutes = await CompletionCertificate
      .find({
        course: course._id,
        trainee,
        vaeSupportRemainingMinutes: { $lt: vaeSupportRemainingMinutes },
      })
      .setOptions({ isVendorUser: true })
      .lean();
    certificatesToDelete = [completionCertificate, ...completionCertificateWithRemainingMinutes];
    await CompletionCertificate.updateMany(
      { _id: { $in: certificatesToDelete.map(c => c._id) } },
      { $unset: { file: '', vaeSupportRemainingMinutes: '' } }
    );
    for (const certificate of certificatesToDelete) {
      await GCloudStorageHelper.deleteCourseFile(certificate.file.publicId);
    }
  } else {
    await CompletionCertificate.updateOne(
      { _id: completionCertificateId },
      { $unset: { file: '', vaeSupportRemainingMinutes: '' } }
    );

    await GCloudStorageHelper.deleteCourseFile(completionCertificate.file.publicId);
  }

  if (completionCertificate.course.hourlyPaymentPlan) {
    const course = await Course
      .findOne(
        { _id: completionCertificate.course._id },
        { subProgram: 1, slots: 1, companies: 1, trainees: 1, hourlyPaymentPlan: 1 }
      )
      .populate({
        path: 'slots',
        select: 'startDate endDate trainers step',
        populate: { path: 'step', select: 'durationCountedPerTrainer' },
      })
      .populate({
        path: 'subProgram',
        select: 'program steps hourlyPaymentPlans',
        populate: [
          { path: 'program', select: 'subPrograms' },
          { path: 'steps', select: 'activities type theoreticalDuration' },
        ],
      })
      .lean();

    for (const certificate of certificatesToDelete) {
      const durations = await computeMonthDurations(course, certificate.month, certificate.trainee);
      const { startOfMonth, endOfMonth, durationPerStep, eLearningDuration } = durations;

      const hourlyPaymentPlan = course.subProgram.hourlyPaymentPlans
        .find(hpp => UtilsHelper.areObjectIdsEquals(hpp._id, course.hourlyPaymentPlan));
      const price = HourlyPaymentPlansHelper
        .getPriceFromDurations(hourlyPaymentPlan, durationPerStep, eLearningDuration);

      const billsToReset = await CourseBill
        .find(
          { course: course._id, maturityDate: { $gte: startOfMonth, $lte: endOfMonth }, 'mainFee.price': price },
          { _id: 1 }
        )
        .setOptions({ isVendorUser: true })
        .lean();

      if (billsToReset.length) {
        await CourseBill.updateMany({ _id: { $in: billsToReset.map(b => b._id) } }, { $set: { 'mainFee.price': 0 } });
      }
    }
  }
};
