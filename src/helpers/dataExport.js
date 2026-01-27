const get = require('lodash/get');
const has = require('lodash/has');
const isEmpty = require('lodash/isEmpty');
const {
  CIVILITY_LIST,
  HELPER,
  AUXILIARY_ROLES,
  CARE_DAYS_INDEX,
  FUNDING_FREQUENCIES,
  CUSTOMER_SITUATIONS,
  FUNDING_NATURES,
  SERVICE_NATURES,
  STOPPED,
  ARCHIVED,
  ACTIVATED,
  EVENT_TRANSPORT_MODE_LIST,
  CUSTOMER_STATUS,
} = require('./constants');
const { CompaniDate } = require('./dates/companiDates');
const UtilsHelper = require('./utils');
const Customer = require('../models/Customer');
const Role = require('../models/Role');
const User = require('../models/User');
const UserCompany = require('../models/UserCompany');
const SectorHistory = require('../models/SectorHistory');
const ReferentHistory = require('../models/ReferentHistory');
const Service = require('../models/Service');
const ContractRepository = require('../repositories/ContractRepository');
const CustomerRepository = require('../repositories/CustomerRepository');
const { nationalities } = require('../data/nationalities');
const { countries } = require('../data/countries');

const getServicesNameList = (subscriptions) => {
  let list = `${UtilsHelper.getLastVersion(subscriptions[0].service.versions, 'startDate').name}`;
  if (subscriptions.length > 1) {
    for (const sub of subscriptions.slice(1)) {
      list = list.concat(`\r\n ${UtilsHelper.getLastVersion(sub.service.versions, 'startDate').name}`);
    }
  }
  return list;
};

const customerExportHeader = [
  'Id Bénéficiaire',
  'Titre',
  'Nom',
  'Prenom',
  'Date de naissance',
  'Adresse',
  'Ville',
  '1ère intervention',
  'Id Auxiliaire référent(e)',
  'Auxiliaire référent(e)',
  'Situation',
  'Environnement',
  'Objectifs',
  'Autres',
  'Nom associé au compte bancaire',
  'IBAN',
  'BIC',
  'RUM',
  'Date de signature du mandat',
  'Nombre de souscriptions',
  'Souscriptions',
  'Nombre de financements',
  'Date de création',
  'Statut',
];

const formatIdentity = person => `${person.firstname} ${person.lastname}`;

const getStatus = (customer) => {
  if (isEmpty(customer)) return '';
  if (customer.archivedAt) return CUSTOMER_STATUS[ARCHIVED];
  if (customer.stoppedAt) return CUSTOMER_STATUS[STOPPED];

  return CUSTOMER_STATUS[ACTIVATED];
};

exports.exportCustomers = async (credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const customers = await Customer.find({ company: companyId })
    .populate({ path: 'subscriptions.service' })
    .populate({ path: 'firstIntervention', select: 'startDate', match: { company: companyId } })
    .populate({ path: 'referent', match: { company: companyId } })
    .lean({ autopopulate: true });
  const rows = [customerExportHeader];

  for (const cus of customers) {
    const birthDate = get(cus, 'identity.birthDate');
    const lastname = get(cus, 'identity.lastname');
    const mandates = get(cus, 'payment.mandates') || [];
    const lastMandate = UtilsHelper.getLastVersion(mandates, 'createdAt') || {};
    const signedAt = lastMandate.signedAt ? CompaniDate(lastMandate.signedAt).format('dd/LL/yyyy') : '';
    const subscriptionsCount = get(cus, 'subscriptions.length') || 0;
    const firstIntervention = get(cus, 'firstIntervention.startDate');
    const situation = CUSTOMER_SITUATIONS.find(sit => sit.value === get(cus, 'followUp.situation'));

    const cells = [
      get(cus, '_id') || '',
      CIVILITY_LIST[get(cus, 'identity.title')] || '',
      lastname ? lastname.toUpperCase() : '',
      get(cus, 'identity.firstname') || '',
      birthDate ? CompaniDate(birthDate).format('dd/LL/yyyy') : '',
      get(cus, 'contact.primaryAddress.fullAddress') || '',
      get(cus, 'contact.primaryAddress.city') || '',
      firstIntervention ? CompaniDate(firstIntervention).format('dd/LL/yyyy') : '',
      get(cus, 'referent._id') || '',
      has(cus, 'referent.identity') ? formatIdentity(get(cus, 'referent.identity')) : '',
      situation ? situation.label : '',
      get(cus, 'followUp.environment') || '',
      get(cus, 'followUp.objectives') || '',
      get(cus, 'followUp.misc') || '',
      get(cus, 'payment.bankAccountOwner') || '',
      get(cus, 'payment.iban') || '',
      get(cus, 'payment.bic') || '',
      lastMandate.rum || '',
      signedAt,
      subscriptionsCount,
      subscriptionsCount ? getServicesNameList(cus.subscriptions) : '',
      get(cus, 'fundings.length') || 0,
      cus.createdAt ? CompaniDate(cus.createdAt).format('dd/LL/yyyy') : '',
      getStatus(cus),
    ];

    rows.push(cells);
  }

  return rows;
};

const getDataForAuxiliariesExport = (aux, contractsLength, contract) => {
  const nationality = get(aux, 'identity.nationality');
  const lastname = get(aux, 'identity.lastname');
  const birthDate = get(aux, 'identity.birthDate');
  const address = get(aux, 'contact.address.fullAddress');
  const birthCountry = get(aux, 'identity.birthCountry');
  const { inactivityDate, createdAt } = aux;
  const transport = get(aux, 'administrative.transportInvoice.transportType');

  return {
    Email: get(aux, 'local.email') || '',
    Équipe: get(aux, 'sector.name') || '',
    'Id Auxiliaire': aux._id || '',
    Titre: CIVILITY_LIST[get(aux, 'identity.title')] || '',
    Nom: lastname ? lastname.toUpperCase() : '',
    Prénom: get(aux, 'identity.firstname') || '',
    'Date de naissance': birthDate ? CompaniDate(birthDate).format('dd/LL/yyyy') : '',
    'Pays de naissance': countries[birthCountry] || '',
    'Departement de naissance': get(aux, 'identity.birthState') || '',
    'Ville de naissance': get(aux, 'identity.birthCity') || '',
    Nationalité: nationality ? nationalities[nationality] : '',
    'N° de sécurité sociale': get(aux, 'identity.socialSecurityNumber') || '',
    Addresse: address || '',
    Téléphone: get(aux, 'contact.phone') || '',
    'Nombre de contrats': contractsLength,
    Établissement: get(aux, 'establishment.name') || '',
    'Date de début de contrat prestataire': get(contract, 'startDate', null)
      ? CompaniDate(contract.startDate).format('dd/LL/yyyy')
      : '',
    'Date de fin de contrat prestataire': get(contract, 'endDate', null)
      ? CompaniDate(contract.endDate).format('dd/LL/yyyy')
      : '',
    'Date d\'inactivité': inactivityDate ? CompaniDate(inactivityDate).format('dd/LL/yyyy') : '',
    'Date de création': createdAt ? CompaniDate(createdAt).format('dd/LL/yyyy') : '',
    'Mode de transport par défaut': EVENT_TRANSPORT_MODE_LIST[transport] || '',
  };
};

exports.exportAuxiliaries = async (credentials) => {
  const rows = [];

  const companyId = get(credentials, 'company._id');
  const userCompanies = await UserCompany.find({ company: companyId }, { user: 1 }).lean();
  if (!userCompanies.length) return rows;

  const roles = await Role.find({ name: { $in: AUXILIARY_ROLES } }).lean();
  const auxiliaries = await User
    .find({ 'role.client': { $in: roles.map(role => role._id) }, _id: { $in: userCompanies.map(u => u.user) } })
    .populate({ path: 'sector', populate: { path: 'sector', select: 'name' }, match: { company: companyId } })
    .populate({ path: 'contracts', select: '_id startDate endDate' })
    .populate({ path: 'establishment', select: 'name', match: { company: companyId } })
    .lean();

  if (!auxiliaries.length) rows.push(getDataForAuxiliariesExport({}, 0));
  else {
    for (const aux of auxiliaries) {
      const { contracts } = aux;
      if (contracts && contracts.length) {
        for (const contract of contracts) {
          rows.push(getDataForAuxiliariesExport(aux, contracts.length, contract));
        }
      } else {
        rows.push(getDataForAuxiliariesExport(aux, 0));
      }
    }
  }
  return [Object.keys(rows[0]), ...rows.map(d => Object.values(d))];
};

const helperExportHeader = [
  'Email',
  'Téléphone',
  'Id Aidant(e)',
  'Aidant(e) - Nom',
  'Aidant(e) - Prénom',
  'Id Bénéficiaire',
  'Bénéficiaire - Titre',
  'Bénéficiaire - Nom',
  'Bénéficiaire - Prénom',
  'Bénéficiaire - Rue',
  'Bénéficiaire - Code postal',
  'Bénéficiaire - Ville',
  'Date de création',
];

exports.exportHelpers = async (credentials) => {
  const rows = [helperExportHeader];

  const companyId = get(credentials, 'company._id');
  const userCompanies = await UserCompany.find({ company: companyId }, { user: 1 }).lean();
  if (!userCompanies.length) return rows;

  const role = await Role.findOne({ name: HELPER }).lean();
  const helpers = await User
    .find({ 'role.client': role._id, _id: { $in: userCompanies.map(u => u.user) } })
    .populate({
      path: 'customers',
      populate: { path: 'customer', select: 'identity contact' },
      match: { company: companyId },
    })
    .lean();

  for (const hel of helpers) {
    const customer = hel.customers && hel.customers.customer;

    rows.push([
      get(hel, 'local.email') || '',
      get(hel, 'contact.phone', '') !== '' ? `+33${hel.contact.phone.substring(1)}` : '',
      get(hel, '_id') || '',
      get(hel, 'identity.lastname', '').toUpperCase(),
      get(hel, 'identity.firstname') || '',
      get(customer, '_id') || '',
      CIVILITY_LIST[get(customer, 'identity.title')] || '',
      get(customer, 'identity.lastname', '').toUpperCase(),
      get(customer, 'identity.firstname') || '',
      get(customer, 'contact.primaryAddress.street') || '',
      get(customer, 'contact.primaryAddress.zipCode') || '',
      get(customer, 'contact.primaryAddress.city') || '',
      hel.createdAt ? CompaniDate(hel.createdAt).format('dd/LL/yyyy') : '',
    ]);
  }

  return rows;
};

const sectorExportHeader = [
  'Equipe',
  'Id Auxiliaire',
  'Nom',
  'Prénom',
  'Date d\'arrivée dans l\'équipe',
  'Date de départ de l\'équipe',
];

exports.exportSectors = async (credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const sectorHistories = await SectorHistory
    .find({ company: companyId, startDate: { $exists: true } })
    .populate({ path: 'sector', select: '_id name' })
    .populate({ path: 'auxiliary', select: '_id identity.firstname identity.lastname' })
    .lean();
  const data = [sectorExportHeader];

  for (const sectorHistory of sectorHistories) {
    data.push([
      get(sectorHistory, 'sector.name', null) || '',
      get(sectorHistory, 'auxiliary._id', null) || '',
      get(sectorHistory, 'auxiliary.identity.lastname', null) || '',
      get(sectorHistory, 'auxiliary.identity.firstname', null) || '',
      CompaniDate(sectorHistory.startDate).format('dd/LL/yyyy'),
      sectorHistory.endDate ? CompaniDate(sectorHistory.endDate).format('dd/LL/yyyy') : '',
    ]);
  }

  return data;
};

const staffRegisterHeader = [
  'Id Auxiliaire',
  'Nom',
  'Prénom',
  'Civilité',
  'Date de naissance',
  'Nationalité',
  'Emploi',
  'Type de contrat',
  'Date de début',
  'Date de fin',
];

exports.exportStaffRegister = async (credentials) => {
  const staffRegister = await ContractRepository.getStaffRegister(credentials.company._id);

  const rows = [staffRegisterHeader];
  for (const contract of staffRegister) {
    const birthDate = get(contract, 'user.identity.birthDate');

    rows.push([
      get(contract, 'user._id') || '',
      get(contract, 'user.identity.lastname', '').toUpperCase(),
      get(contract, 'user.identity.firstname') || '',
      CIVILITY_LIST[get(contract, 'user.identity.title')] || '',
      birthDate ? CompaniDate(birthDate).format('dd/LL/yyyy') : '',
      nationalities[get(contract, 'user.identity.nationality')] || '',
      'Auxiliaire de vie',
      'CDI',
      CompaniDate(contract.startDate).format('dd/LL/yyyy'),
      contract.endDate ? CompaniDate(contract.endDate).format('dd/LL/yyyy') : '',
    ]);
  }

  return rows;
};

const referentsHeader = [
  'Id Bénéficiaire',
  'Bénéficiaire - Titre',
  'Bénéficiaire - Nom',
  'Bénéficiaire - Prénom',
  'Id Auxiliaire',
  'Auxiliaire - Titre',
  'Auxiliaire - Nom',
  'Auxiliaire - Prénom',
  'Date de début',
  'Date de fin',
];

exports.exportReferents = async (credentials) => {
  const referentsHistories = await ReferentHistory.find({ company: get(credentials, 'company._id', '') })
    .populate({ path: 'auxiliary' })
    .populate({ path: 'customer' })
    .lean();

  const rows = [referentsHeader];
  for (const referentHistory of referentsHistories) {
    rows.push([
      get(referentHistory, 'customer._id') || '',
      CIVILITY_LIST[get(referentHistory, 'customer.identity.title')] || '',
      get(referentHistory, 'customer.identity.lastname', '').toUpperCase(),
      get(referentHistory, 'customer.identity.firstname') || '',
      get(referentHistory, 'auxiliary._id') || '',
      CIVILITY_LIST[get(referentHistory, 'auxiliary.identity.title')] || '',
      get(referentHistory, 'auxiliary.identity.lastname', '').toUpperCase(),
      get(referentHistory, 'auxiliary.identity.firstname') || '',
      CompaniDate(referentHistory.startDate).format('dd/LL/yyyy'),
      referentHistory.endDate ? CompaniDate(referentHistory.endDate).format('dd/LL/yyyy') : '',
    ]);
  }

  return rows;
};

const serviceHeader = [
  'Nature',
  'Entreprise',
  'Nom',
  'Montant unitaire par défaut',
  'TVA (%)',
  'Plan de majoration',
  'Date de début',
  'Date de création',
  'Date de mise a jour',
];

exports.exportServices = async (credentials) => {
  const companyId = get(credentials, 'company._id', null);
  const services = await Service.find({ company: companyId })
    .populate({ path: 'company' })
    .populate({ path: 'versions.surcharge', match: { company: companyId } })
    .lean();
  const data = [serviceHeader];

  for (const service of services) {
    const lastVersion = UtilsHelper.getLastVersion(service.versions, 'startDate');
    data.push([
      SERVICE_NATURES.find(nat => nat.value === service.nature).label,
      service.company.name,
      lastVersion.name,
      UtilsHelper.formatFloatForExport(lastVersion.defaultUnitAmount),
      UtilsHelper.formatFloatForExport(lastVersion.vat),
      lastVersion.surcharge ? lastVersion.surcharge.name : '',
      CompaniDate(lastVersion.startDate).format('dd/LL/yyyy'),
      CompaniDate(service.createdAt).format('dd/LL/yyyy'),
      CompaniDate(service.updatedAt).format('dd/LL/yyyy')]);
  }

  return data;
};

exports.exportSubscriptions = async (credentials) => {
  const customers = await Customer
    .find({ subscriptions: { $exists: true, $not: { $size: 0 } }, company: get(credentials, 'company._id') })
    .populate({ path: 'subscriptions.service' })
    .lean();
  const data = [];

  if (!customers.length) return data;

  for (const cus of customers) {
    for (const sub of cus.subscriptions) {
      const lastServiceVersion = UtilsHelper.getLastVersion(sub.service.versions, 'startDate');
      const lastVersion = UtilsHelper.getLastVersion(sub.versions, 'createdAt');

      data.push({
        'Id Bénéficiaire': get(cus, '_id') || '',
        Titre: CIVILITY_LIST[get(cus, 'identity.title')] || '',
        Nom: get(cus, 'identity.lastname', '').toUpperCase() || '',
        Prénom: get(cus, 'identity.firstname', '') || '',
        Service: lastServiceVersion ? lastServiceVersion.name : '',
        'Prix unitaire TTC': lastVersion ? UtilsHelper.formatFloatForExport(lastVersion.unitTTCRate) : '',
        'Volume horaire hebdomadaire estimatif': has(lastVersion, 'weeklyHours')
          ? UtilsHelper.formatFloatForExport(lastVersion.weeklyHours)
          : '',
        'Nombre d\'interventions hebdomadaire estimatif': has(lastVersion, 'weeklyCount')
          ? UtilsHelper.formatFloatForExport(lastVersion.weeklyCount)
          : '',
        'Dont soirées': lastVersion ? UtilsHelper.formatFloatForExport(get(lastVersion, 'evenings')) : '',
        'Dont samedis': lastVersion ? UtilsHelper.formatFloatForExport(get(lastVersion, 'saturdays')) : '',
        'Dont dimanches': lastVersion ? UtilsHelper.formatFloatForExport(get(lastVersion, 'sundays')) : '',
      });
    }
  }

  return [Object.keys(data[0]), ...data.map(d => Object.values(d))];
};

const fundingExportHeader = [
  'Id Bénéficiaire',
  'Titre',
  'Nom',
  'Prénom',
  'Id tiers payeur',
  'Tiers payeur',
  'Code EPA',
  'Nature',
  'Service',
  'Date de début',
  'Date de fin',
  'Numéro de dossier',
  'Fréquence',
  'Montant TTC',
  'Montant unitaire TTC',
  'Nombre d\'heures',
  'Jours',
  'Participation du/de la bénéficiaire',
];

exports.exportFundings = async (credentials) => {
  const customerFundings = await CustomerRepository.getCustomerFundings(get(credentials, 'company._id', null));
  const data = [fundingExportHeader];

  for (const cus of customerFundings) {
    const funding = UtilsHelper.mergeLastVersionWithBaseObject(cus.funding, 'createdAt');
    const nature = FUNDING_NATURES.find(nat => nat.value === funding.nature);
    const lastServiceVersion = has(funding, 'subscription.service.versions')
      ? UtilsHelper.getLastVersion(funding.subscription.service.versions, 'startDate')
      : null;
    const frequency = FUNDING_FREQUENCIES.find(freq => freq.value === funding.frequency);
    let careDays = '';
    if (funding.careDays) {
      careDays = funding.careDays.map(dayIndex => CARE_DAYS_INDEX[dayIndex]).join(' ');
    }

    data.push([
      cus._id || '',
      CIVILITY_LIST[get(cus, 'identity.title')] || '',
      get(cus, 'identity.lastname', '').toUpperCase() || '',
      get(cus, 'identity.firstname', '') || '',
      get(funding, 'thirdPartyPayer._id') || '',
      get(funding, 'thirdPartyPayer.name') || '',
      get(funding, 'fundingPlanId') || '',
      nature ? nature.label : '',
      lastServiceVersion ? lastServiceVersion.name : '',
      funding.startDate ? CompaniDate(funding.startDate).format('dd/LL/yyyy') : '',
      funding.endDate ? CompaniDate(funding.endDate).format('dd/LL/yyyy') : '',
      funding.folderNumber || '',
      frequency ? frequency.label : '',
      UtilsHelper.formatFloatForExport(funding.amountTTC),
      UtilsHelper.formatFloatForExport(funding.unitTTCRate),
      UtilsHelper.formatFloatForExport(funding.careHours),
      careDays || '',
      UtilsHelper.formatFloatForExport(funding.customerParticipationRate),
    ]);
  }

  return data;
};
