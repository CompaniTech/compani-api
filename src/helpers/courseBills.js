const get = require('lodash/get');
const omit = require('lodash/omit');
const mapValues = require('lodash/mapValues');
const keyBy = require('lodash/keyBy');
const { ObjectId } = require('mongodb');
const NumbersHelper = require('./numbers');
const Course = require('../models/Course');
const CourseBill = require('../models/CourseBill');
const CourseBillsNumber = require('../models/CourseBillsNumber');
const BalanceHelper = require('./balances');
const UtilsHelper = require('./utils');
const CourseHistoriesHelper = require('./courseHistories');
const VendorCompaniesHelper = require('./vendorCompanies');
const CourseBillPdf = require('../data/pdf/courseBilling/courseBill');
const {
  LIST,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
  DD_MM_YYYY,
  BALANCE,
  COURSE,
  TRAINEE,
  SINGLE,
  MONTH_YEAR,
} = require('./constants');
const { CompaniDate } = require('./dates/companiDates');

exports.getNetInclTaxes = (bill) => {
  const mainFeeTotal = NumbersHelper.oldMultiply(bill.mainFee.price, bill.mainFee.count);
  const billingPurchaseTotal = bill.billingPurchaseList
    ? bill.billingPurchaseList.map(p => NumbersHelper.oldMultiply(p.price, p.count)).reduce((acc, val) => acc + val, 0)
    : 0;

  return NumbersHelper.oldAdd(mainFeeTotal, billingPurchaseTotal);
};

const getTimeProgress = (course) => {
  const pastSlotsCount = course.slots.filter(slot => CompaniDate().isAfter(slot.startDate)).length;

  return pastSlotsCount / (course.slots.length + course.slotsToPlan.length);
};

exports.computeAmounts = (courseBill) => {
  if (!courseBill) return { netInclTaxes: 0, paid: 0, total: 0 };

  const netInclTaxes = exports.getNetInclTaxes(courseBill);
  const totalPayments = BalanceHelper.computePayments(courseBill.coursePayments);
  const creditNote = courseBill.courseCreditNote ? netInclTaxes : 0;
  const paid = totalPayments + creditNote;

  return { netInclTaxes, paid, total: paid - netInclTaxes };
};

exports.formatCourseBill = (courseBill) => {
  const { netInclTaxes, paid, total } = this.computeAmounts(courseBill);

  return {
    progress: getTimeProgress(courseBill.course),
    netInclTaxes,
    ...omit(courseBill, ['course.slots', 'course.slotsToPlan']),
    paid,
    total,
  };
};

const balance = async (company, credentials) => {
  const courseBills = await CourseBill
    .find({ $or: [{ companies: company }, { 'payer.company': company }], billedAt: { $exists: true, $type: 'date' } })
    .populate({
      path: 'course',
      select: 'misc slots slotsToPlan subProgram companies',
      populate: [
        { path: 'slots' },
        { path: 'slotsToPlan' },
        { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
      ],
    })
    .populate({ path: 'companies', select: 'name' })
    .populate({ path: 'payer.company', select: 'name' })
    .populate({ path: 'payer.fundingOrganisation', select: 'name' })
    .populate({
      path: 'courseCreditNote',
      options: {
        isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
        requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
      },
    })
    .populate({
      path: 'coursePayments',
      options: {
        isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
        requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
      },
    })
    .setOptions({
      isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
      requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company),
    })
    .lean();

  return courseBills.map(bill => exports.formatCourseBill(bill));
};

const formatCourse = async (course) => {
  const traineesCompanyAtCourseRegistration = await CourseHistoriesHelper
    .getCompanyAtCourseRegistrationList({ key: COURSE, value: course._id }, { key: TRAINEE, value: course.trainees });
  const traineesCompany = mapValues(keyBy(traineesCompanyAtCourseRegistration, 'trainee'), 'company');
  const courseTrainees = course.trainees
    .map(traineeId => ({ _id: traineeId, registrationCompany: traineesCompany[traineeId] }));
  const coursePrices = course.companies.map((c) => {
    const companyPrice = (course.prices || []).find(p => UtilsHelper.areObjectIdsEquals(p.company, c._id)) ||
      { company: c._id, global: '' };
    return companyPrice;
  });
  return { ...course, trainees: courseTrainees, prices: coursePrices };
};

exports.list = async (query, credentials) => {
  if (query.action === LIST) {
    const courseBills = await CourseBill
      .find({ course: query.course })
      .populate({ path: 'companies', select: 'name' })
      .populate({ path: 'payer.fundingOrganisation', select: 'name' })
      .populate({ path: 'payer.company', select: 'name' })
      .populate({ path: 'courseCreditNote', options: { isVendorUser: !!get(credentials, 'role.vendor') } })
      .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
      .lean();

    return courseBills.map(bill => ({ ...bill, netInclTaxes: exports.getNetInclTaxes(bill) }));
  }

  if (query.action === BALANCE) return balance(query.company, credentials);

  let formattedQuery = {};
  if (query.startDate && query.endDate) {
    formattedQuery = query.isValidated
      ? { billedAt: { $gte: query.startDate, $lte: query.endDate } }
      : { maturityDate: { $gte: query.startDate, $lte: query.endDate } };
  } else if (query.isValidated) formattedQuery = { billedAt: { $exists: true } };
  const courseBills = await CourseBill
    .find(formattedQuery)
    .populate([
      ...(query.startDate && query.endDate
        ? [{
          path: 'course',
          select: 'companies trainees subProgram type expectedBillsCount prices interruptedAt',
          populate: [
            { path: 'companies', select: 'name' },
            { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
            { path: 'slots', select: 'startDate endDate' },
            { path: 'slotsToPlan', select: '_id' },
          ],
        },
        {
          path: 'companies',
          select: 'name',
          populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
        },
        ]
        : []
      ),
      { path: 'payer.fundingOrganisation', select: 'name' },
      { path: 'payer.company', select: 'name' },
      { path: 'courseCreditNote', options: { isVendorUser: !!get(credentials, 'role.vendor') } },
    ])
    .setOptions({ isVendorUser: !!get(credentials, 'role.vendor') })
    .lean();

  return Promise.all(
    courseBills
      .filter(bill => query.isValidated || !get(bill, 'course.interruptedAt'))
      .map(async bill => ({
        ...bill,
        ...(query.startDate && query.endDate && { course: await formatCourse(bill.course) }),
        netInclTaxes: exports.getNetInclTaxes(bill),
      }))
  );
};

exports.createBillList = async (payload) => {
  const course = await Course
    .findOne({ _id: payload.course }, { type: 1, prices: 1, trainees: 1, trainers: 1 })
    .populate({ path: 'trainees', select: 'identity' })
    .populate({ path: 'trainers', select: 'identity' })
    .lean();

  if (payload.quantity === 1) {
    const billCreated = await CourseBill.create(omit(payload, 'quantity'));

    if (payload.mainFee.percentage) {
      const trainerFees = (course.prices || []).reduce((acc, price) => {
        if (price.trainerFees && UtilsHelper.doesArrayIncludeId(payload.companies, price.company)) {
          return NumbersHelper.add(acc, price.trainerFees);
        }
        return acc;
      }, 0);

      if (trainerFees) {
        const trainerFeesPayload = {
          price: NumbersHelper.toFixedToFloat(
            NumbersHelper.divide(NumbersHelper.multiply(payload.mainFee.percentage, trainerFees), 100)
          ),
          count: 1,
          percentage: payload.mainFee.percentage,
          billingItem: new ObjectId(process.env.TRAINER_FEES_BILLING_ITEM),
        };
        await exports.addBillingPurchase(billCreated._id, trainerFeesPayload);
      }
    }
  } else if (course.type !== SINGLE) {
    const billsToCreate = new Array(payload.quantity).fill({
      course: payload.course,
      mainFee: payload.mainFee,
      companies: payload.companies,
      payer: payload.payer,
    });
    await CourseBill.insertMany(billsToCreate);
  } else {
    const traineeName = course.trainees.length
      ? UtilsHelper.formatIdentity(get(course.trainees[0], 'identity'), 'FL')
      : '';

    const trainersName = course.trainers
      .map(trainer => UtilsHelper.formatIdentity(get(trainer, 'identity'), 'FL')).join(', ');

    for (let i = 0; i < payload.quantity; i++) {
      const billMaturityDate = CompaniDate(payload.maturityDate).add(`P${i}M`);
      const description = 'Facture liée à des frais pédagogiques \r\n'
        + 'Contrat de professionnalisation \r\n'
        + `ACCOMPAGNEMENT ${billMaturityDate.format(MONTH_YEAR)} \r\n`
        + `Nom de l'apprenant·e: ${traineeName} \r\n`
        + `Nom du / des intervenants: ${trainersName}`;

      await CourseBill.create({
        ...omit(payload, ['quantity', 'maturityDate']),
        mainFee: { ...payload.mainFee, description },
        maturityDate: billMaturityDate.toISO(),
      });
    }
  }
};

exports.updateCourseBill = async (courseBillId, payload) => {
  let formattedPayload = {};

  if (payload.billedAt) {
    const lastBillNumber = await CourseBillsNumber
      .findOneAndUpdate({}, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true })
      .lean();

    formattedPayload = {
      $set: { billedAt: payload.billedAt, number: `FACT-${lastBillNumber.seq.toString().padStart(5, '0')}` },
      $unset: { maturityDate: '' },
    };
  } else {
    let payloadToSet = payload;
    const payloadToUnset = {};
    if (get(payload, 'mainFee.description') === '') {
      payloadToSet = omit(payloadToSet, 'mainFee.description');
      payloadToUnset['mainFee.description'] = '';
    }

    if (get(payload, 'payer.company')) payloadToUnset['payer.fundingOrganisation'] = '';
    else if (get(payload, 'payer.fundingOrganisation')) payloadToUnset['payer.company'] = '';

    formattedPayload = {
      ...(Object.keys(payloadToSet).length && { $set: UtilsHelper.flatQuery(payloadToSet) }),
      ...(Object.keys(payloadToUnset).length && { $unset: payloadToUnset }),
    };
  }

  const courseBill = await CourseBill.findOneAndUpdate({ _id: courseBillId }, formattedPayload);
  if (get(payload, 'mainFee.percentage')) {
    const billingPurchase = courseBill.billingPurchaseList.find(bp =>
      UtilsHelper.areObjectIdsEquals(bp.billingItem, process.env.TRAINER_FEES_BILLING_ITEM) && bp.percentage
    );
    if (billingPurchase) {
      const billingPurchasePayload = {
        count: 1,
        price: NumbersHelper.toFixedToFloat(
          NumbersHelper.multiply(
            billingPurchase.price,
            NumbersHelper.divide(get(payload, 'mainFee.percentage'), billingPurchase.percentage)
          )
        ),
        percentage: get(payload, 'mainFee.percentage'),
      };

      await exports.updateBillingPurchase(courseBill._id, billingPurchase._id, billingPurchasePayload);
    }
  }
};

exports.updateBillList = async (payload) => {
  if (payload.billedAt) {
    const lastBillNumber = await CourseBillsNumber.findOne({}).lean();
    const promises = [];
    for (let i = 0; i < payload._ids.length; i++) {
      promises.push(
        CourseBill.updateOne(
          { _id: payload._ids[i] },
          {
            $set: {
              billedAt: payload.billedAt,
              number: `FACT-${(lastBillNumber.seq + i + 1).toString().padStart(5, '0')}`,
            },
            $unset: { maturityDate: '' },
          }
        )
      );
    }
    const result = await Promise.all(promises);
    const modifiedCount = result.reduce((acc, r) => acc + r.modifiedCount, 0);

    await CourseBillsNumber
      .updateOne({}, { $inc: { seq: modifiedCount } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  } else {
    const courseBill = await CourseBill
      .findOne({ _id: { $in: payload._ids[0] } }, { course: 1, maturityDate: 1 })
      .populate({
        path: 'course',
        select: 'type trainees trainers',
        populate: [{ path: 'trainees', select: 'identity' }, { path: 'trainers', select: 'identity' }],
      })
      .lean();

    let payloadToSet = omit(payload, '_ids');
    const payloadToUnset = {};
    if (get(payload, 'mainFee.description') === '') {
      payloadToSet = omit(payloadToSet, 'mainFee');
      payloadToUnset['mainFee.description'] = '';
    }

    if (get(payload, 'payer.company')) payloadToUnset['payer.fundingOrganisation'] = '';
    else if (get(payload, 'payer.fundingOrganisation')) payloadToUnset['payer.company'] = '';

    const { course } = courseBill;
    const isSingleCourse = course.type === SINGLE;

    if (!isSingleCourse) {
      await CourseBill.updateMany(
        { _id: { $in: payload._ids } },
        {
          ...(Object.keys(payloadToSet).length && { $set: UtilsHelper.flatQuery(payloadToSet) }),
          ...(Object.keys(payloadToUnset).length && { $unset: payloadToUnset }),
        }
      );
    } else {
      const maturityDateDiff = payload.maturityDate
        ? CompaniDate(payload.maturityDate).diff(courseBill.maturityDate, 'days')
        : null;

      for (let i = 0; i < payload._ids.length; i++) {
        const currentId = payload._ids[i];
        const isFirstBill = i === 0;

        if (!isFirstBill && maturityDateDiff) {
          const billToUpdate = await CourseBill.findOne({ _id: currentId }, { maturityDate: 1 }).lean();
          const newMaturityDate = CompaniDate(billToUpdate.maturityDate).add(maturityDateDiff).toISO();
          const newMaturityDateMonthYear = CompaniDate(billToUpdate.maturityDate)
            .add(maturityDateDiff)
            .format('LLLL yyyy');
          const traineeName = UtilsHelper.formatIdentity(get(course.trainees[0], 'identity'), 'FL');
          const trainersName = course.trainers
            .map(trainer => UtilsHelper.formatIdentity(get(trainer, 'identity'), 'FL')).join(', ');
          const newDescription = 'Facture liée à des frais pédagogiques \r\n'
            + 'Contrat de professionnalisation \r\n'
            + `ACCOMPAGNEMENT ${newMaturityDateMonthYear}\r\n`
            + `Nom de l'apprenant·e: ${traineeName} \r\n`
            + `Nom du / des intervenants: ${trainersName}`;

          payloadToSet['mainFee.description'] = newDescription;
          payloadToSet.maturityDate = newMaturityDate;
        }

        const formattedPayload = {
          ...(Object.keys(payloadToSet).length && { $set: UtilsHelper.flatQuery(payloadToSet) }),
          ...(Object.keys(payloadToUnset).length && { $unset: payloadToUnset }),
        };

        await CourseBill.updateOne({ _id: currentId }, formattedPayload);
      }
    }
  }
};

exports.addBillingPurchase = async (courseBillId, payload) =>
  CourseBill.updateOne({ _id: courseBillId }, { $push: { billingPurchaseList: payload } });

exports.updateBillingPurchase = async (courseBillId, billingPurchaseId, payload) => CourseBill.updateOne(
  { _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId },
  {
    $set: {
      'billingPurchaseList.$.price': payload.price,
      'billingPurchaseList.$.count': payload.count,
      ...(!!payload.description && { 'billingPurchaseList.$.description': payload.description }),
      ...(!!payload.percentage && { 'billingPurchaseList.$.percentage': payload.percentage }),
    },
    ...(get(payload, 'description') === '' && { $unset: { 'billingPurchaseList.$.description': '' } }),
  }
);

exports.deleteBillingPurchase = async (courseBillId, billingPurchaseId) => CourseBill.updateOne(
  { _id: courseBillId },
  { $pull: { billingPurchaseList: { _id: billingPurchaseId } } }
);

const formatDataForPdf = (bill, vendorCompany) => {
  const { billedAt, payer } = bill;

  return {
    ...omit(bill, ['_id', 'billedAt']),
    date: CompaniDate(billedAt).format(DD_MM_YYYY),
    vendorCompany,
    payer: { name: payer.name, address: get(payer, 'address.fullAddress') || payer.address },
  };
};

exports.generateBillPdf = async (billId, companies, credentials) => {
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));
  const requestingOwnInfos = companies.some(company => UtilsHelper.hasUserAccessToCompany(credentials, company));

  const vendorCompany = await VendorCompaniesHelper.get();

  const bill = await CourseBill
    .findOne({ _id: billId }, { number: 1, companies: 1, course: 1, mainFee: 1, billingPurchaseList: 1, billedAt: 1 })
    .populate({
      path: 'course',
      select: 'subProgram prices',
      populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
    })
    .populate({ path: 'billingPurchaseList', select: 'billingItem', populate: { path: 'billingItem', select: 'name' } })
    .populate({ path: 'companies', select: 'name address' })
    .populate({ path: 'payer.fundingOrganisation', select: 'name address' })
    .populate({ path: 'payer.company', select: 'name address' })
    .populate({
      path: 'coursePayments',
      select: 'nature netInclTaxes date',
      options: { sort: { date: -1 }, isVendorUser, requestingOwnInfos },
    })
    .populate({ path: 'courseCreditNote', options: { isVendorUser, requestingOwnInfos } })
    .lean();

  const data = formatDataForPdf(bill, vendorCompany);

  const pdf = await CourseBillPdf.getPdf(data);

  return { pdf, billNumber: bill.number };
};

exports.deleteBillList = async courseBillIds => CourseBill.deleteMany({ _id: { $in: courseBillIds } });
