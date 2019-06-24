const Boom = require('boom');

const CreditNote = require('../models/CreditNote');
const Company = require('../models/Company');
const translate = require('../helpers/translate');
const { updateEventAndFundingHistory, createCreditNotes } = require('../helpers/creditNotes');
const { populateSubscriptionsServices } = require('../helpers/subscriptions');
const { getDateQuery } = require('../helpers/utils');
const { formatPDF } = require('../helpers/creditNotes');
const { generatePdf } = require('../helpers/pdf');
const { COMPANI } = require('../helpers/constants');

const { language } = translate;

const list = async (req) => {
  try {
    const { startDate, endDate, ...rest } = req.query;
    const query = rest;
    if (startDate || endDate) query.date = getDateQuery({ startDate, endDate });

    const creditNotes = await CreditNote.find(query)
      .populate({ path: 'customer', select: '_id identity subscriptions', populate: { path: 'subscriptions.service' } })
      .populate({ path: 'thirdPartyPayer', select: '_id name' })
      .populate('events')
      .lean();

    for (let i = 0, l = creditNotes.length; i < l; i++) {
      creditNotes[i].customer = await populateSubscriptionsServices({ ...creditNotes[i].customer });
    }

    return {
      message: creditNotes.length === 0 ? translate[language].creditNotesNotFound : translate[language].creditNotesFound,
      data: { creditNotes },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.badImplementation(e);
  }
};

const getById = async (req) => {
  try {
    const creditNote = await CreditNote.findById(req.params._id)
      .populate({ path: 'customer', select: '_id identity subscriptions', populate: { path: 'subscriptions.service' } })
      .populate('events');
    if (!creditNote) return Boom.notFound(translate[language].creditNoteNotFound);

    return {
      message: translate[language].creditNoteFound,
      data: { creditNote }
    };
  } catch (e) {
    req.log('error', e);
    return Boom.badImplementation(e);
  }
};

const create = async (req) => {
  try {
    const creditNotes = await createCreditNotes(req.payload);

    return {
      message: translate[language].creditNoteCreated,
      data: { creditNotes },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.badImplementation(e);
  }
};

const update = async (req) => {
  try {
    let creditNote = await CreditNote.findOne({ _id: req.params._id }).lean();
    if (!creditNote) return Boom.notFound(translate[language].creditNoteNotFound);
    if (creditNote.origin !== COMPANI) return Boom.badRequest(translate[language].creditNoteNotCompani);

    if (creditNote.events) await updateEventAndFundingHistory(creditNote.events, true);

    if (!creditNote.linkedCreditNote) creditNote = await CreditNote.findByIdAndUpdate(req.params._id, { $set: req.payload }, { new: true });
    else {
      const tppPayload = { ...req.payload, inclTaxesCustomer: 0, exclTaxesCustomer: 0 };
      const customerPayload = { ...req.payload, inclTaxesTpp: 0, exclTaxesTpp: 0 };
      delete customerPayload.thirdPartyPayer;

      if (creditNote.thirdPartyPayer) {
        Promise.all([
          CreditNote.findByIdAndUpdate(req.params._id, { $set: tppPayload }, { new: true }),
          CreditNote.findByIdAndUpdate(creditNote.linkedCreditNote, { $set: customerPayload }, { new: true }),
        ]);
      } else {
        Promise.all([
          CreditNote.findByIdAndUpdate(req.params._id, { $set: customerPayload }, { new: true }),
          CreditNote.findByIdAndUpdate(creditNote.linkedCreditNote, { $set: tppPayload }, { new: true })
        ]);
      }
    }

    if (req.payload.events) await updateEventAndFundingHistory(req.payload.events, false);

    return {
      message: translate[language].creditNoteUpdated,
      data: { creditNote },
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const remove = async (req) => {
  try {
    const creditNote = await CreditNote.findOne({ _id: req.params._id });
    if (!creditNote) return Boom.notFound(translate[language].creditNoteNotFound);
    if (creditNote.origin !== COMPANI) return Boom.badRequest(translate[language].creditNoteNotCompani);

    await updateEventAndFundingHistory(creditNote.events, true);
    await CreditNote.findByIdAndRemove(req.params._id);
    if (creditNote.linkedCreditNote) await CreditNote.findByIdAndRemove(creditNote.linkedCreditNote);

    return {
      message: translate[language].creditNoteDeleted,
    };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

const generateCreditNotePdf = async (req, h) => {
  try {
    const creditNote = await CreditNote.findOne({ _id: req.params._id })
      .populate({ path: 'customer', select: '_id identity contact subscriptions', populate: { path: 'subscriptions.service' } })
      .populate({ path: 'thirdPartyPayer', select: '_id name address' })
      .populate({ path: 'events', populate: { path: 'auxiliary', select: 'identity' } })
      .lean();

    if (!creditNote) return Boom.notFound(translate[language].creditNoteNotFound);
    if (creditNote.origin !== COMPANI) return Boom.badRequest(translate[language].creditNoteNotCompani);

    const company = await Company.findOne();
    const data = formatPDF(creditNote, company);
    const pdf = await generatePdf(data, './data/creditNote.html');

    return h.response(pdf).type('application/pdf');
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = {
  list,
  create,
  update,
  remove,
  getById,
  generateCreditNotePdf,
};
