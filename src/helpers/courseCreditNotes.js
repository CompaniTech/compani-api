const get = require('lodash/get');
const CourseBill = require('../models/CourseBill');
const CourseCreditNote = require('../models/CourseCreditNote');
const CourseCreditNoteNumber = require('../models/CourseCreditNoteNumber');
const VendorCompaniesHelper = require('./vendorCompanies');
const { CompaniDate } = require('./dates/companiDates');
const CourseCreditNotePdf = require('../data/pdf/courseBilling/courseCreditNote');
const { DD_MM_YYYY } = require('./constants');

exports.createCourseCreditNote = async (payload) => {
  const lastCreditNoteNumber = await CourseCreditNoteNumber
    .findOneAndUpdate({}, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true })
    .lean();

  const courseBill = await CourseBill.findOne({ _id: payload.courseBill }, { companies: 1 }).lean();

  const formattedPayload = {
    ...payload,
    companies: courseBill.companies,
    number: `AV-${lastCreditNoteNumber.seq.toString().padStart(5, '0')}`,
  };

  await CourseCreditNote.create(formattedPayload);
};

exports.generateCreditNotePdf = async (creditNoteId) => {
  const vendorCompany = await VendorCompaniesHelper.get();
  const creditNote = await CourseCreditNote.findOne({ _id: creditNoteId })
    .populate({
      path: 'courseBill',
      select: 'course number date payer billingPurchaseList mainFee billedAt',
      populate: [
        {
          path: 'course',
          select: 'subProgram prices',
          populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
        },
        { path: 'payer.fundingOrganisation', select: 'name address' },
        { path: 'payer.company', select: 'name address' },
        { path: 'billingPurchaseList', select: 'billingItem', populate: { path: 'billingItem', select: 'name' } },
      ],
    })
    .lean();

  const payer = get(creditNote, 'courseBill.payer');
  const data = {
    number: creditNote.number,
    date: CompaniDate(creditNote.date).format(DD_MM_YYYY),
    companies: creditNote.companies.map(c => ({ _id: c })),
    misc: creditNote.misc,
    vendorCompany,
    courseBill: {
      number: creditNote.courseBill.number,
      date: CompaniDate(creditNote.courseBill.billedAt).format(DD_MM_YYYY),
    },
    payer: { name: payer.name, address: get(payer, 'address.fullAddress') || payer.address },
    course: creditNote.courseBill.course,
    mainFee: creditNote.courseBill.mainFee,
    billingPurchaseList: creditNote.courseBill.billingPurchaseList,
  };

  const pdf = await CourseCreditNotePdf.getPdf(data);

  return { pdf, creditNoteNumber: creditNote.number };
};
