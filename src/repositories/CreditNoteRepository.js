const { ObjectID } = require('mongodb');
const moment = require('moment');
const CreditNote = require('../models/CreditNote');

exports.findAmountsGroupedByCustomer = async (companyId, customerId = null, dateMax = null) => {
  const rules = [];
  if (customerId) rules.push({ customer: new ObjectID(customerId) });
  if (dateMax) rules.push({ date: { $lt: new Date(dateMax) } });

  const customerCreditNotesAmounts = await CreditNote.aggregate([
    { $match: rules.length === 0 ? {} : { $and: rules } },
    {
      $group: { _id: '$customer', refund: { $sum: '$inclTaxesCustomer' } },
    },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer' } },
    {
      $project: {
        _id: { customer: '$_id', tpp: null },
        customer: { _id: 1, identity: 1, fundings: 1 },
        refund: 1,
      },
    },
  ]).option({ company: companyId });

  return customerCreditNotesAmounts;
};

exports.findAmountsGroupedByTpp = async (companyId, customerId = null, dateMax = null) => {
  const rules = [];
  if (customerId) rules.push({ customer: new ObjectID(customerId) });
  if (dateMax) rules.push({ date: { $lt: new Date(dateMax) } });

  const tppCreditNotesAmounts = await CreditNote.aggregate([
    { $match: rules.length === 0 ? {} : { $and: rules } },
    {
      $group: {
        _id: { tpp: '$thirdPartyPayer', customer: '$customer' },
        refund: { $sum: '$inclTaxesTpp' },
      },
    },
    { $lookup: { from: 'thirdpartypayers', localField: '_id.tpp', foreignField: '_id', as: 'thirdPartyPayer' } },
    { $unwind: { path: '$thirdPartyPayer' } },
    { $lookup: { from: 'customers', localField: '_id.customer', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer' } },
    {
      $project: {
        _id: 1,
        thirdPartyPayer: { name: 1, _id: 1 },
        customer: { _id: 1, identity: 1, fundings: 1 },
        refund: 1,
      },
    },
  ]).option({ company: companyId });

  return tppCreditNotesAmounts;
};

exports.getCreditNoteList = async companyId => CreditNote.aggregate([
  { $match: { thirdPartyPayer: { $exists: true } } },
  {
    $group: {
      _id: { thirdPartyPayer: '$thirdPartyPayer', year: { $year: '$date' }, month: { $month: '$date' } },
      creditNotes: { $push: '$$ROOT' },
      firstCreditNote: { $first: '$$ROOT' },
    },
  },
  {
    $addFields: {
      netInclTaxes: {
        $reduce: {
          input: '$creditNotes',
          initialValue: 0,
          in: { $add: ['$$value', '$$this.inclTaxesTpp'] },
        },
      },
      month: { $substr: [{ $dateToString: { date: '$firstCreditNote.date', format: '%d-%m-%Y' } }, 3, -1] },
    },
  },
  {
    $lookup: {
      from: 'billslips',
      as: 'billSlip',
      let: { thirdPartyPayerId: '$_id.thirdPartyPayer', month: '$month' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [{ $eq: ['$thirdPartyPayer', '$$thirdPartyPayerId'] }, { $eq: ['$month', '$$month'] }],
            },
          },
        },
      ],
    },
  },
  { $unwind: { path: '$billSlip' } },
  {
    $lookup: {
      from: 'thirdpartypayers',
      localField: '_id.thirdPartyPayer',
      foreignField: '_id',
      as: 'thirdPartyPayer',
    },
  },
  { $unwind: { path: '$thirdPartyPayer' } },
  {
    $project: {
      _id: '$billSlip._id',
      netInclTaxes: 1,
      thirdPartyPayer: { _id: 1, name: 1 },
      month: 1,
      number: '$billSlip.number',
    },
  },
]).option({ company: companyId });

exports.getCreditNoteFromBillSlip = async (billSlip, companyId) => {
  const query = {
    thirdPartyPayer: billSlip.thirdPartyPayer,
    date: {
      $gte: moment(billSlip.month, 'MM-YYYY').startOf('month').toDate(),
      $lte: moment(billSlip.month, 'MM-YYYY').endOf('month').toDate(),
    },
    company: companyId,
  };

  return CreditNote.find(query)
    .populate({ path: 'customer', select: 'fundings identity' })
    .lean();
};
