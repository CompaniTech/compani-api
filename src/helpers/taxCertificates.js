const get = require('lodash/get');
const pick = require('lodash/pick');
const PdfHelper = require('./pdf');
const UtilsHelper = require('./utils');
const SubscriptionsHelper = require('./subscriptions');
const User = require('../models/User');
const moment = require('../extensions/moment');
const TaxCertificate = require('../models/TaxCertificate');
const EventRepository = require('../repositories/EventRepository');
const PaymentRepository = require('../repositories/PaymentRepository');

exports.generateTaxCertificatesList = async (customer, credentials) => {
  const companyId = get(credentials, 'company._id', null);

  return TaxCertificate.find({ customer, company: companyId }).lean();
};

exports.formatInterventions = interventions => interventions.map((int) => {
  const service = SubscriptionsHelper.populateService(int.subscription.service);

  return {
    auxiliary: UtilsHelper.formatIdentity(int.auxiliary.identity, 'FL'),
    serialNumber: User.serialNumber(int.auxiliary),
    subscription: service.name,
    month: moment(int.month, 'M').format('MMMM'),
    hours: UtilsHelper.formatHour(int.duration),
  };
});

exports.formatPdf = (taxCertificate, company, interventions, payments) => {
  const formattedInterventions = exports.formatInterventions(interventions);
  const subscriptions = new Set(formattedInterventions.map(int => int.subscription));
  const totalHours = interventions.reduce((acc, int) => acc + int.duration, 0);
  const totalPaid = payments ? payments.paid + payments.cesu : 0;

  return {
    taxCertificate: {
      totalHours: UtilsHelper.formatHour(totalHours),
      totalPaid: UtilsHelper.formatPrice(totalPaid),
      cesu: UtilsHelper.formatPrice(payments.cesu ? payments.cesu : 0),
      subscriptions: [...subscriptions].join(', '),
      interventions: formattedInterventions,
      company: {
        ...pick(company, ['logo', 'name', 'address', 'rcs']),
        legalRepresentative: {
          name: UtilsHelper.formatIdentity(company.legalRepresentative, 'FL'),
          position: get(company, 'legalRepresentative.position') || '',
        },
      },
      year: taxCertificate.year,
      date: moment(taxCertificate.date).format('DD/MM/YYYY'),
      customer: {
        name: UtilsHelper.formatIdentity(taxCertificate.customer.identity, 'TFL'),
        address: get(taxCertificate, 'customer.contact.primaryAddress', {}),
      },
    },
  };
};

exports.generateTaxCertificatePdf = async (taxCertificateId, credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const taxCertificate = await TaxCertificate.findOne({ _id: taxCertificateId })
    .populate({
      path: 'customer',
      select: 'identity contact subscriptions',
      populate: { path: 'subscriptions.service' },
    })
    .lean();
  const interventions = await EventRepository.getTaxCertificateInterventions(taxCertificate, companyId);
  const payments = await PaymentRepository.getTaxCertificatesPayments(taxCertificate, companyId);

  const data = exports.formatPdf(taxCertificate, credentials.company, interventions, payments);
  const pdf = await PdfHelper.generatePdf(data, './src/data/taxCertificates.html');

  return pdf;
};
