const get = require('lodash/get');
const has = require('lodash/has');
const omit = require('lodash/omit');
const mapValues = require('lodash/mapValues');
const keyBy = require('lodash/keyBy');
const groupBy = require('lodash/groupBy');
const { ObjectId } = require('mongodb');
const NumbersHelper = require('./numbers');
const ActivityHistory = require('../models/ActivityHistory');
const Course = require('../models/Course');
const CourseBill = require('../models/CourseBill');
const CourseBillsNumber = require('../models/CourseBillsNumber');
const CoursePaymentNumber = require('../models/CoursePaymentNumber');
const CoursePayment = require('../models/CoursePayment');
const SubProgram = require('../models/SubProgram');
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
  RECEIVED,
  PENDING,
  PAYMENT,
  BANK_TRANSFER,
  DIRECT_DEBIT,
  PRESENT,
} = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const { CompaniDuration } = require('./dates/companiDurations');

exports.getNetInclTaxes = (bill) => {
  const { price, count } = bill.mainFee;
  const mainFeeTotal = NumbersHelper.oldMultiply(price || 0, count || 0);
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
  const totalPayments = BalanceHelper.computePayments(
    (courseBill.coursePayments || []).filter(p => p.status === RECEIVED)
  );
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
  const isVendorUser = [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name'));

  const courseBills = await CourseBill
    .find({ $or: [{ companies: company }, { 'payer.company': company }], billedAt: { $exists: true, $type: 'date' } })
    .populate([
      {
        path: 'course',
        select: 'misc slots slotsToPlan subProgram companies',
        populate: [
          { path: 'slots' },
          { path: 'slotsToPlan' },
          { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
        ],
      },
      { path: 'companies', select: 'name' },
      { path: 'payer.company', select: 'name' },
      { path: 'payer.fundingOrganisation', select: 'name' },
      {
        path: 'courseCreditNote',
        options: { isVendorUser, requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company) },
      },
      {
        path: 'coursePayments',
        options: { isVendorUser, requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company) },
        ...isVendorUser && { populate: { path: 'xmlSEPAFileInfos', select: 'name', options: { isVendorUser } } },
      },
      ...(isVendorUser ? [{ path: 'pendingCourseBill', options: { isVendorUser: true } }] : []),
    ])
    .setOptions({ isVendorUser, requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, company) })
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
          select: 'companies trainees subProgram type expectedBillsCount prices interruptedAt misc type',
          populate: [
            { path: 'companies', select: 'name' },
            { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
            {
              path: 'slots',
              select: 'startDate endDate',
              ...!query.isValidated && {
                populate: {
                  path: 'attendances',
                  select: '_id',
                  match: { status: PRESENT },
                  options: { isVendorUser: true },
                },
              },
            },
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

  let activityHistoriesByTrainee = {};
  if (!query.isValidated) {
    const singleCourseBills = courseBills.filter(bill => bill.course.type === SINGLE && !bill.course.interruptedAt);
    const singleSubProgramIds = [...new Set(singleCourseBills.map(b => b.course.subProgram._id.toHexString()))];
    const subPrograms = await SubProgram
      .find({ _id: { $in: singleSubProgramIds } })
      .populate({ path: 'steps', select: 'activities' })
      .lean();

    const activityIds = subPrograms.flatMap(sp => sp.steps.flatMap(s => s.activities));
    const trainees = singleCourseBills.flatMap(bill => bill.course.trainees);
    const activityHistories = await ActivityHistory
      .find({
        activity: { $in: activityIds },
        user: { $in: trainees },
        date: { $gte: query.startDate, $lte: query.endDate },
      })
      .lean();
    activityHistoriesByTrainee = groupBy(activityHistories, 'user');
  }

  return Promise.all(
    courseBills
      .filter(bill => query.isValidated || !get(bill, 'course.interruptedAt'))
      .map(async bill => ({
        ...bill,
        ...(query.startDate && query.endDate && {
          course: await formatCourse(bill.course),
          ...!query.isValidated && bill.course.type === SINGLE && {
            hasCourseAction: bill.course.trainees.some(t => activityHistoriesByTrainee[t]) ||
              bill.course.slots
                .filter(s => CompaniDate(s.startDate).isSameOrBetween(query.startDate, query.endDate))
                .some(s => s.attendances.length),
          },
        }),
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
    const doBillCompaniesHaveGlobalFees = payload.companies
      .every(company => (course.prices || []).find(p => UtilsHelper.areObjectIdsEquals(p.company, company)));
    const billsToCreate = new Array(payload.quantity).fill({
      course: payload.course,
      mainFee: {
        ...payload.mainFee,
        price: 0,
        ...doBillCompaniesHaveGlobalFees && { percentage: 0 },
      },
      companies: payload.companies,
      payer: payload.payer,
    });
    const createdBills = await CourseBill.insertMany(billsToCreate);

    const doBillCompaniesHaveTrainerFees = payload.companies.some(company =>
      (course.prices || []).find(p => UtilsHelper.areObjectIdsEquals(p.company, company) && p.trainerFees)
    );
    if (doBillCompaniesHaveTrainerFees) {
      const trainerFeesPayload = {
        price: 0,
        count: 1,
        percentage: 0,
        billingItem: new ObjectId(process.env.TRAINER_FEES_BILLING_ITEM),
      };

      for (const createdBill of createdBills) {
        await exports.addBillingPurchase(createdBill._id, trainerFeesPayload);
      }
    }
  } else {
    const traineeName = course.trainees.length
      ? UtilsHelper.formatIdentity(get(course.trainees[0], 'identity'), 'FL')
      : '';

    const trainersName = get(course, 'trainers', [])
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

const formatPaymentPayload = (courseBill, seq) => {
  const paymentPayload = {
    companies: courseBill.companies,
    number: `REG-${seq.toString().padStart(5, '0')}`,
    status: PENDING,
    netInclTaxes: exports.getNetInclTaxes(courseBill),
    nature: PAYMENT,
    courseBill: courseBill._id,
    date: courseBill.billedAt,
  };

  if (courseBill.course.type === SINGLE) {
    paymentPayload.type = courseBill.billingPurchaseList
      .find(p => UtilsHelper.areObjectIdsEquals(p.billingItem, process.env.MANAGEMENT_FEES_BILLING_ITEM))
      ? BANK_TRANSFER
      : DIRECT_DEBIT;
  } else paymentPayload.type = BANK_TRANSFER;

  return paymentPayload;
};

exports.updateCourseBill = async (courseBillId, payload) => {
  let formattedPayload;

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

  const courseBill = await CourseBill
    .findOneAndUpdate({ _id: courseBillId }, formattedPayload, { new: true })
    .populate({ path: 'course', select: 'prices type' })
    .lean();
  if (get(payload, 'mainFee.percentage')) {
    const billingPurchase = courseBill.billingPurchaseList.find(bp =>
      UtilsHelper.areObjectIdsEquals(bp.billingItem, process.env.TRAINER_FEES_BILLING_ITEM) && has(bp, 'percentage')
    );
    if (billingPurchase) {
      const trainerFees = (courseBill.course.prices || []).reduce((acc, price) => {
        if (price.trainerFees && UtilsHelper.doesArrayIncludeId(courseBill.companies, price.company)) {
          return NumbersHelper.add(acc, price.trainerFees);
        }
        return acc;
      }, 0);
      const billingPurchasePayload = {
        count: 1,
        price: NumbersHelper.toFixedToFloat(
          NumbersHelper.divide(NumbersHelper.multiply(get(payload, 'mainFee.percentage'), trainerFees), 100)
        ),
        percentage: get(payload, 'mainFee.percentage'),
      };

      await exports.updateBillingPurchase(courseBill._id, billingPurchase._id, billingPurchasePayload);
    }
  } else if (payload.billedAt) {
    const lastPaymentNumber = await CoursePaymentNumber
      .findOneAndUpdate(
        { nature: PAYMENT },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean();

    const paymentPayload = formatPaymentPayload(courseBill, lastPaymentNumber.seq);

    await CoursePayment.create(paymentPayload);
  }
};

const getMaturityDateDurationToAdd = (initialMaturityDate, newMaturityDate) => {
  const maturityDateDiffInMonth = CompaniDate(newMaturityDate).diff(initialMaturityDate, 'months');
  const monthToAdd = Math.trunc(CompaniDuration(maturityDateDiffInMonth).asMonths());
  const dateAfterAddingMonth = CompaniDate(initialMaturityDate).add(`P${monthToAdd}M`);
  const diffInDay = CompaniDate(newMaturityDate).diff(dateAfterAddingMonth, 'days');
  const dayToAdd = Math.trunc(CompaniDuration(diffInDay).asDays());

  return `P${monthToAdd}M${dayToAdd}D`;
};

exports.updateBillList = async (payload) => {
  if (payload.billedAt) {
    const lastBillNumber = await CourseBillsNumber.findOne({}).lean();
    const promises = [];
    for (let i = 0; i < payload._ids.length; i++) {
      promises.push(
        CourseBill.findOneAndUpdate(
          { _id: payload._ids[i] },
          {
            $set: {
              billedAt: payload.billedAt,
              number: `FACT-${(lastBillNumber.seq + i + 1).toString().padStart(5, '0')}`,
            },
            $unset: { maturityDate: '' },
          },
          { new: true }
        )
          .populate({ path: 'course', select: 'type' })
          .lean()
      );
    }
    const result = await Promise.allSettled(promises);
    const fulfilledResults = result.filter(r => r.status === 'fulfilled');

    await CourseBillsNumber.updateOne(
      {},
      { $inc: { seq: fulfilledResults.length } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const lastPaymentNumber = await CoursePaymentNumber
      .findOneAndUpdate(
        { nature: PAYMENT },
        { $inc: { seq: fulfilledResults.length } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean();
    const paymentsPromises = [];
    fulfilledResults.forEach((courseBill, index) => {
      const paymentPayload = formatPaymentPayload(courseBill.value, lastPaymentNumber.seq - result.length + 1 + index);
      paymentsPromises.push(CoursePayment.create(paymentPayload));
    });
    await Promise.all(paymentsPromises);
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
      payloadToSet = Object.keys(payload.mainFee).length === 1
        ? omit(payloadToSet, 'mainFee')
        : omit(payloadToSet, 'mainFee.description');
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
      let maturityDateDurationToAdd;
      if (payload.maturityDate) {
        maturityDateDurationToAdd = getMaturityDateDurationToAdd(courseBill.maturityDate, payload.maturityDate);
      }

      for (let i = 0; i < payload._ids.length; i++) {
        const currentId = payload._ids[i];
        const isFirstBill = i === 0;

        if (!isFirstBill && payload.maturityDate) {
          const billToUpdate = await CourseBill.findOne({ _id: currentId }, { maturityDate: 1 }).lean();
          const newMaturityDate = CompaniDate(billToUpdate.maturityDate).add(maturityDateDurationToAdd);
          const traineeName = UtilsHelper.formatIdentity(get(course.trainees[0], 'identity'), 'FL');
          const trainersName = course.trainers
            .map(trainer => UtilsHelper.formatIdentity(get(trainer, 'identity'), 'FL')).join(', ');
          const newDescription = 'Facture liée à des frais pédagogiques \r\n'
            + 'Contrat de professionnalisation \r\n'
            + `ACCOMPAGNEMENT ${newMaturityDate.format('LLLL yyyy')}\r\n`
            + `Nom de l'apprenant·e: ${traineeName} \r\n`
            + `Nom du / des intervenants: ${trainersName}`;

          payloadToSet['mainFee.description'] = newDescription;
          payloadToSet.maturityDate = newMaturityDate.toISO();
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
      match: { status: RECEIVED },
      options: { sort: { date: -1 }, isVendorUser, requestingOwnInfos },
    })
    .populate({ path: 'courseCreditNote', options: { isVendorUser, requestingOwnInfos } })
    .lean();

  const data = formatDataForPdf(bill, vendorCompany);

  const pdf = await CourseBillPdf.getPdf(data);

  return { pdf, billNumber: bill.number };
};

exports.deleteBillList = async courseBillIds => CourseBill.deleteMany({ _id: { $in: courseBillIds } });
