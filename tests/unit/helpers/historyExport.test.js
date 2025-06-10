/* eslint-disable max-len */
const { ObjectId } = require('mongodb');
const moment = require('moment');
const { expect } = require('expect');
const sinon = require('sinon');
const Event = require('../../../src/models/Event');
const Bill = require('../../../src/models/Bill');
const CreditNote = require('../../../src/models/CreditNote');
const Contract = require('../../../src/models/Contract');
const Pay = require('../../../src/models/Pay');
const Payment = require('../../../src/models/Payment');
const FinalPay = require('../../../src/models/FinalPay');
const ExportHelper = require('../../../src/helpers/historyExport');
const UtilsHelper = require('../../../src/helpers/utils');
const DraftPayHelper = require('../../../src/helpers/draftPay');
const DistanceMatrixHelper = require('../../../src/helpers/distanceMatrix');
const EventRepository = require('../../../src/repositories/EventRepository');
const UserRepository = require('../../../src/repositories/UserRepository');
const {
  INTERNAL_HOUR,
  INTERVENTION,
  TIME_STAMPING_ACTIONS,
} = require('../../../src/helpers/constants');
const SinonMongoose = require('../sinonMongoose');

describe('getWorkingEventsForExport', () => {
  const auxiliaryId = new ObjectId();
  const customerId = new ObjectId();
  const subId1 = new ObjectId();
  const subId2 = new ObjectId();

  const events = [
    {
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: subId1,
      customer: {
        _id: customerId,
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
        subscriptions: [
          { _id: subId1, service: { versions: [{ name: 'Lala' }] } },
          { _id: subId2, service: { versions: [{ name: 'Lili' }] } },
        ],
      },
      auxiliary: auxiliaryId,
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
    },
    {
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: subId2,
      customer: {
        _id: customerId,
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
        subscriptions: [
          { _id: subId1, service: { versions: [{ name: 'Lala' }] } },
          { _id: subId2, service: { versions: [{ name: 'Lili' }] } },
        ],
      },
      sector: { name: 'Girafes - 75' },
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
    },
    {
      isCancelled: true,
      cancel: { condition: 'invoiced_and_not_paid', reason: 'auxiliary_initiative' },
      isBilled: false,
      type: INTERNAL_HOUR,
      internalHour: { name: 'Formation' },
      repetition: { frequency: 'never' },
      auxiliary: auxiliaryId,
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
      misc: 'brbr',
    },
  ];

  const eventsWithSubscription = [
    {
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: { _id: subId1, service: { versions: [{ name: 'Lala' }] } },
      customer: {
        _id: customerId,
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
        subscriptions: [
          { _id: subId1, service: { versions: [{ name: 'Lala' }] } },
          { _id: subId2, service: { versions: [{ name: 'Lili' }] } },
        ],
      },
      auxiliary: auxiliaryId,
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
    },
    {
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: { _id: subId2, service: { versions: [{ name: 'Lili' }] } },
      customer: {
        _id: customerId,
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
        subscriptions: [
          { _id: subId1, service: { versions: [{ name: 'Lala' }] } },
          { _id: subId2, service: { versions: [{ name: 'Lili' }] } },
        ],
      },
      sector: { name: 'Girafes - 75' },
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
    },
    {
      isCancelled: true,
      cancel: { condition: 'invoiced_and_not_paid', reason: 'auxiliary_initiative' },
      isBilled: false,
      type: INTERNAL_HOUR,
      internalHour: { name: 'Formation' },
      repetition: { frequency: 'never' },
      auxiliary: auxiliaryId,
      startDate: moment('2019-05-20T08:00:00').toDate(),
      endDate: moment('2019-05-20T10:00:00').toDate(),
      misc: 'brbr',
    },
  ];
  const companyId = new ObjectId();
  const startDate = moment('2019-05-20T08:00:00').toDate();
  const endDate = moment('2019-05-20T10:00:00').toDate();

  let find;
  beforeEach(() => {
    find = sinon.stub(Event, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return events for history export', async () => {
    const query = {
      company: companyId,
      type: { $in: [INTERVENTION, INTERNAL_HOUR] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    };

    find.returns(SinonMongoose.stubChainedQueries(events, ['populate', 'sort', 'lean']));

    const result = await ExportHelper.getWorkingEventsForExport(startDate, endDate, companyId);
    expect(result).toStrictEqual(eventsWithSubscription);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [query, ExportHelper.EVENT_PROJECTION_FILEDS] },
        { query: 'sort', args: [{ startDate: -1 }] },
        {
          query: 'populate',
          args: [{
            path: 'customer',
            populate: { path: 'subscriptions', select: 'service', populate: { path: 'service', select: 'versions' } },
            select: 'subscriptions identity',
          }],
        },
        { query: 'populate', args: [{ path: 'internalHour', select: 'name' }] },
        { query: 'populate', args: [{ path: 'sector', select: 'name' }] },
        {
          query: 'populate',
          args: [{
            path: 'histories',
            match: {
              action: { $in: TIME_STAMPING_ACTIONS },
              company: companyId,
              $or: [{ isCancelled: false }, { isCancelled: { $exists: false } }],
            },
            select: 'update action manualTimeStampingReason',
          }],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportWorkingEventsHistory', () => {
  const header = [
    'Type',
    'Heure interne',
    'Service',
    'Début planifié',
    'Début horodaté',
    'Type d\'horodatage',
    'Motif',
    'Fin planifiée',
    'Fin horodatée',
    'Type d\'horodatage',
    'Motif',
    'Durée',
    'Répétition',
    'Déplacement véhiculé avec bénéficiaire',
    'Mode de transport spécifique',
    'Équipe',
    'Id Auxiliaire',
    'Auxiliaire - Titre',
    'Auxiliaire - Prénom',
    'Auxiliaire - Nom',
    'A affecter',
    'Id Bénéficiaire',
    'Bénéficiaire - Titre',
    'Bénéficiaire - Nom',
    'Bénéficiaire - Prénom',
    'Divers',
    'Facturé',
    'Annulé',
    'Statut de l\'annulation',
    'Raison de l\'annulation',
  ];
  const credentials = { company: { _id: '1234567890' } };
  const auxiliaryId = new ObjectId();
  const auxiliaries = [
    {
      _id: auxiliaryId,
      identity: { firstname: 'Jean-Claude', lastname: 'Van Damme' },
      sectorHistory: [
        { startDate: '2018-09-12T00:00:00.000Z', sector: { name: 'Girafes - 75' } },
        { startDate: '2019-09-12T00:00:00.000Z', sector: { name: 'Etoiles - 75' } },
      ],
    },
  ];
  const events = [
    {
      transportMode: 'public',
      kmDuringEvent: 667,
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: {
        service: { versions: [{ name: 'Lala' }] },
      },
      customer: {
        _id: new ObjectId(),
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
      },
      auxiliary: auxiliaryId,
      startDate: '2019-05-18T08:00:00.000Z',
      endDate: '2019-05-18T10:00:00.000Z',
      histories: [
        {
          update: { startHour: { from: '2019-05-18T08:00:00.000Z', to: '2019-05-18T08:01:18.000Z' } },
          event: { type: 'intervention', auxiliary: auxiliaryId },
          auxiliaries: [auxiliaryId],
          action: 'manual_time_stamping',
          manualTimeStampingReason: 'qrcode_missing',
        },
      ],
    },
    {
      kmDuringEvent: 0,
      isCancelled: false,
      isBilled: true,
      type: 'intervention',
      repetition: { frequency: 'every_week' },
      subscription: {
        service: { versions: [{ name: 'Lala' }] },
      },
      customer: {
        _id: new ObjectId(),
        identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' },
      },
      sector: { name: 'Girafes - 75' },
      startDate: '2019-05-20T08:00:00.000Z',
      endDate: '2019-05-20T10:00:00.000Z',
      histories: [
        {
          update: { startHour: { from: '2019-05-20T08:00:00.000Z', to: '2019-05-20T08:01:18.000Z' } },
          event: { type: 'intervention', auxiliary: auxiliaryId },
          auxiliaries: [auxiliaryId],
          action: 'manual_time_stamping',
          manualTimeStampingReason: 'qrcode_missing',
        },
        {
          update: { endHour: { from: '2019-05-20T10:00:00.000Z', to: '2019-05-20T10:03:24.000Z' } },
          event: { type: 'intervention', auxiliary: auxiliaryId },
          auxiliaries: [auxiliaryId],
          action: 'manual_time_stamping',
          manualTimeStampingReason: 'camera_error',
        },
      ],
    },
    {
      transportMode: 'company_transport',
      kmDuringEvent: 4124,
      isCancelled: true,
      cancel: { condition: 'invoiced_and_not_paid', reason: 'auxiliary_initiative' },
      isBilled: false,
      type: INTERNAL_HOUR,
      internalHour: { name: 'Formation' },
      repetition: { frequency: 'never' },
      sector: { name: 'Etoiles - 75' },
      customer: {
        _id: new ObjectId(),
        identity: { title: 'mr', firstname: 'Bojack', lastname: 'Horseman' },
      },
      startDate: '2019-05-24T08:00:00.000Z',
      endDate: '2019-05-24T10:00:00.000Z',
      misc: 'brbr',
      histories: [],
    },
  ];
  let getWorkingEventsForExport;
  let getLastVersion;
  let getAuxiliariesWithSectorHistory;
  beforeEach(() => {
    getWorkingEventsForExport = sinon.stub(ExportHelper, 'getWorkingEventsForExport');
    getLastVersion = sinon.stub(UtilsHelper, 'getLastVersion');
    getAuxiliariesWithSectorHistory = sinon.stub(UserRepository, 'getAuxiliariesWithSectorHistory');
  });
  afterEach(() => {
    getWorkingEventsForExport.restore();
    getLastVersion.restore();
    getAuxiliariesWithSectorHistory.restore();
  });

  it('should return an array containing just the header', async () => {
    const start = '2019-06-16T08:00:00.000Z';
    const end = '2019-06-24T22:00:00.000Z';

    getWorkingEventsForExport.returns([]);
    getAuxiliariesWithSectorHistory.returns([]);
    const exportArray = await ExportHelper.exportWorkingEventsHistory(start, end, credentials);

    expect(exportArray).toEqual([header]);
  });

  it('should return an array with the header and 3 rows', async () => {
    const start = '2019-05-16T08:00:00.000Z';
    const end = '2019-05-24T22:00:00.000Z';

    getWorkingEventsForExport.returns(events);
    getAuxiliariesWithSectorHistory.returns(auxiliaries);

    getLastVersion.callsFake(ver => ver[0]);

    const exportArray = await ExportHelper.exportWorkingEventsHistory(start, end, credentials);

    expect(exportArray).toEqual([
      header,
      ['Intervention', '', 'Lala', '2019/05/18 10:00:00', '2019/05/18 10:01:18', 'Manuel', 'QR Code manquant',
        '2019/05/18 12:00:00', '', '', '', '2,00', 'Une fois par semaine', '667,00', 'Transports en commun / À pied',
        'Girafes - 75', expect.any(Object), '', 'Jean-Claude', 'VAN DAMME', 'Non', expect.any(Object), 'Mme',
        'MATHY', 'Mimi', '', 'Oui', 'Non', '', ''],
      ['Intervention', '', 'Lala', '2019/05/20 10:00:00', '2019/05/20 10:01:18', 'Manuel', 'QR Code manquant',
        '2019/05/20 12:00:00', '2019/05/20 12:03:24', 'Manuel', 'Problème de caméra', '2,00', 'Une fois par semaine',
        '', '', 'Girafes - 75', '', '', '', '', 'Oui', expect.any(Object), 'Mme', 'MATHY', 'Mimi', '',
        'Oui', 'Non', '', ''],
      ['Heure interne', 'Formation', '', '2019/05/24 10:00:00', '', '', '', '2019/05/24 12:00:00', '', '', '',
        '2,00', '', '4124,00', 'Véhicule d\'entreprise', 'Etoiles - 75', '', '', '', '', 'Oui', expect.any(Object), 'M.',
        'HORSEMAN', 'Bojack', 'brbr', 'Non', 'Oui', 'Facturée & non payée', 'Initiative de l\'intervenant(e)'],
    ]);
  });
});

describe('formatAbsence', () => {
  let getAbsenceHours;
  beforeEach(() => {
    getAbsenceHours = sinon.stub(DraftPayHelper, 'getAbsenceHours');
  });
  afterEach(() => {
    getAbsenceHours.restore();
  });

  it('should return an array with the header and 1 row for hourly absence', async () => {
    const event = {
      type: 'absence',
      absence: 'unjustified_absence',
      absenceNature: 'hourly',
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Jean-Claude', lastname: 'Van Damme' },
        sector: { name: 'Girafes - 75' },
        contracts: [
          { startDate: '2018-05-20T00:00:00', versions: [{ startDate: '2018-05-20T00:00:00', weeklyHours: 24 }] },
        ],
      },
      startDate: '2019-05-20T08:00:00',
      endDate: '2019-05-20T10:00:00',
    };

    getAbsenceHours.returns(2);
    const exportArray = await ExportHelper.formatAbsence(event);

    expect(exportArray).toEqual([
      expect.any(Object),
      'Jean-Claude',
      'VAN DAMME',
      '',
      'Girafes - 75',
      'Absence injustifiée',
      'Horaire',
      '20/05/2019 08:00',
      '20/05/2019 10:00',
      '2,00',
      'non',
      '',
      '',
    ]);
    sinon.assert.calledOnceWithExactly(getAbsenceHours, event, event.auxiliary.contracts);
  });

  it('should return an array with the header and 1 row for daily absence', async () => {
    const event = {
      type: 'absence',
      absence: 'leave',
      absenceNature: 'daily',
      internalHour: { name: 'Formation' },
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Princess', lastname: 'Carolyn' },
        sector: { name: 'Etoiles - 75' },
        contracts: [
          { startDate: '2018-05-20T00:00:00', versions: [{ startDate: '2018-05-20T00:00:00', weeklyHours: 24 }] },
        ],
      },
      startDate: '2019-05-20T08:00:00',
      endDate: '2019-05-20T22:00:00',
      extension: { _id: new ObjectId(), startDate: '2019-04-20T08:00:00' },
      misc: 'brbr',
    };
    getAbsenceHours.returns(4);
    const exportArray = await ExportHelper.formatAbsence(event);

    expect(exportArray).toEqual([
      expect.any(Object),
      'Princess',
      'CAROLYN',
      '',
      'Etoiles - 75',
      'Congé',
      'Journalière',
      '20/05/2019',
      '20/05/2019',
      '4,00',
      'oui',
      '20/04/2019',
      'brbr',
    ]);
    sinon.assert.calledOnceWithExactly(getAbsenceHours, event, event.auxiliary.contracts);
  });
});

describe('exportAbsencesHistory', () => {
  const header = [
    'Id Auxiliaire',
    'Auxiliaire - Prénom',
    'Auxiliaire - Nom',
    'Auxiliaire - Titre',
    'Équipe',
    'Type',
    'Nature',
    'Début',
    'Fin',
    'Equivalent heures contrat',
    'Prolongation',
    'Absence d\'origine',
    'Divers',
  ];
  const start = '2019-05-20T08:00:00';
  const end = '2019-05-20T22:00:00';
  let getAbsencesForExport;
  let formatAbsence;
  beforeEach(() => {
    getAbsencesForExport = sinon.stub(EventRepository, 'getAbsencesForExport');
    formatAbsence = sinon.stub(ExportHelper, 'formatAbsence');
  });
  afterEach(() => {
    getAbsencesForExport.restore();
    formatAbsence.restore();
  });

  it('should return an array containing just the header', async () => {
    const credentials = { company: { _id: '1234567890' } };
    getAbsencesForExport.returns([]);
    const exportArray = await ExportHelper.exportAbsencesHistory(start, end, credentials);

    expect(exportArray).toEqual([header]);
    sinon.assert.notCalled(formatAbsence);
  });

  it('should return an array with the header and 1 rows', async () => {
    const event = {
      type: 'absence',
      absence: 'unjustified_absence',
      absenceNature: 'hourly',
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Jean-Claude', lastname: 'Van Damme' },
        sector: { name: 'Girafes - 75' },
        contracts: [
          { startDate: '2018-05-20T00:00:00', versions: [{ startDate: '2018-05-20T00:00:00', weeklyHours: 24 }] },
        ],
      },
      startDate: '2019-05-20T08:00:00',
      endDate: '2019-05-21T10:00:00',
    };
    const credentials = { company: { _id: '1234567890' } };
    const formattedAbsence = [new ObjectId(), 'Jean-Claude', 'VAN DAMME', '', 'Girafes - 75', 'Absence injustifiée',
      'Horaire',
      '20/05/2019 08:00', '21/05/2019 10:00', '26,00', 'non', '', ''];

    getAbsencesForExport.returns([event]);
    formatAbsence.returns(formattedAbsence);

    const exportArray = await ExportHelper.exportAbsencesHistory(start, end, credentials);

    expect(exportArray).toEqual([
      header,
      formattedAbsence,
    ]);
    sinon.assert.calledOnceWithExactly(formatAbsence, event);
  });

  it('should return an array with the header and 3 rows for event on 2 months', async () => {
    const event = {
      type: 'absence',
      absence: 'leave',
      absenceNature: 'daily',
      internalHour: { name: 'Formation' },
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Princess', lastname: 'Carolyn' },
        sector: { name: 'Etoiles - 75' },
        contracts: [
          { startDate: '2018-05-20T00:00:00', versions: [{ startDate: '2018-05-20T00:00:00', weeklyHours: 24 }] },
        ],
      },
      startDate: '2019-05-20T08:00:00',
      endDate: '2019-07-20T22:00:00',
      misc: 'brbr',
    };
    const credentials = { company: { _id: '1234567890' } };
    const formattedAbsenceRow = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé', 'Journalière',
      '20/05/2019', '31/05/2019', '40,00', 'non', '', 'brbr'];
    const formattedAbsenceRow2 = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé',
      'Journalière', '01/06/2019', '30/06/2019', '96,00', 'non', '', 'brbr'];
    const formattedAbsenceRow3 = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé',
      'Journalière', '01/07/2019', '20/07/2019', '72,00', 'non', '', 'brbr'];

    getAbsencesForExport.returns([event]);
    formatAbsence.onCall(0).returns(formattedAbsenceRow);
    formatAbsence.onCall(1).returns(formattedAbsenceRow2);
    formatAbsence.onCall(2).returns(formattedAbsenceRow3);

    const exportArray = await ExportHelper.exportAbsencesHistory(start, end, credentials);

    expect(exportArray).toEqual([header, formattedAbsenceRow, formattedAbsenceRow2, formattedAbsenceRow3]);
    sinon.assert.calledWithExactly(formatAbsence.getCall(0), { ...event, endDate: '2019-05-31T21:59:59.999Z' });
    sinon.assert.calledWithExactly(
      formatAbsence.getCall(1),
      { ...event, startDate: '2019-05-31T22:00:00.000Z', endDate: '2019-06-30T21:59:59.999Z' }
    );
    sinon.assert.calledWithExactly(formatAbsence.getCall(2), { ...event, startDate: '2019-06-30T22:00:00.000Z' });
    sinon.assert.callCount(formatAbsence, 3);
  });

  it('should return an array with the header and 3 rows for event on 2 months with (startDate + 2 months) > endDate', async () => {
    const event = {
      type: 'absence',
      absence: 'leave',
      absenceNature: 'daily',
      internalHour: { name: 'Formation' },
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Princess', lastname: 'Carolyn' },
        sector: { name: 'Etoiles - 75' },
        contracts: [
          { startDate: '2018-05-20T00:00:00', versions: [{ startDate: '2018-05-20T00:00:00', weeklyHours: 24 }] },
        ],
      },
      startDate: '2019-05-20T08:00:00',
      endDate: '2019-07-01T22:00:00',
      extension: { _id: new ObjectId(), startDate: '2019-04-20T08:00:00' },
      misc: 'brbr',
    };
    const credentials = { company: { _id: '1234567890' } };
    const formattedAbsenceRow = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé',
      'Journalière', '20/05/2019', '31/05/2019', '40,00', 'oui', '2019/04/20', 'brbr'];
    const formattedAbsenceRow2 = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé',
      'Journalière', '01/06/2019', '30/06/2019', '96,00', 'oui', '2019/04/20', 'brbr'];
    const formattedAbsenceRow3 = [event.auxiliary._id, 'Princess', 'CAROLYN', '', 'Etoiles - 75', 'Congé',
      'Journalière', '01/07/2019', '01/07/2019', '4,00', 'oui', '2019/04/20', 'brbr'];

    getAbsencesForExport.returns([event]);
    formatAbsence.onCall(0).returns(formattedAbsenceRow);
    formatAbsence.onCall(1).returns(formattedAbsenceRow2);
    formatAbsence.onCall(2).returns(formattedAbsenceRow3);

    const exportArray = await ExportHelper.exportAbsencesHistory(start, end, credentials);

    expect(exportArray).toEqual([
      header,
      formattedAbsenceRow,
      formattedAbsenceRow2,
      formattedAbsenceRow3,
    ]);
    sinon.assert.calledWithExactly(formatAbsence.getCall(0), { ...event, endDate: '2019-05-31T21:59:59.999Z' });
    sinon.assert.calledWithExactly(
      formatAbsence.getCall(1),
      { ...event, startDate: '2019-05-31T22:00:00.000Z', endDate: '2019-06-30T21:59:59.999Z' }
    );
    sinon.assert.calledWithExactly(formatAbsence.getCall(2), { ...event, startDate: '2019-06-30T22:00:00.000Z' });
    sinon.assert.callCount(formatAbsence, 3);
  });
});

describe('exportBillsAndCreditNotesHistory', () => {
  const header = [
    'Nature',
    'Identifiant',
    'Date',
    'Id Bénéficiaire',
    'Titre',
    'Nom',
    'Prénom',
    'Id tiers payeur',
    'Tiers payeur',
    'Montant HT en €',
    'Montant TTC en €',
    'Nombre d\'heures',
    'Services',
    'Date de création',
  ];
  const customerIdList = [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()];
  const tppIdList = [new ObjectId(), new ObjectId(), new ObjectId()];

  const bills = [
    {
      number: 'FACT-0549236',
      date: '2019-05-20T06:00:00.000Z',
      customer: { _id: customerIdList[0], identity: { title: 'mrs', firstname: 'Mimi', lastname: 'Mathy' } },
      thirdPartyPayer: { _id: tppIdList[0], name: 'TF1' },
      netInclTaxes: 81,
      subscriptions: [
        {
          service: { name: 'Temps de qualité - autonomie' },
          hours: 20,
          exclTaxes: 50,
          inclTaxes: 60,
          vat: 20,
        },
      ],
      billingItemList: [{
        billingItem: new ObjectId(),
        unitInclTaxes: 10.5,
        name: 'article de factu',
        count: 2,
        inclTaxes: 21,
        exclTaxes: 17.5,
        vat: 20,
      }],
      createdAt: '2019-10-11',
    },
    {
      number: 'FACT-0419457',
      date: '2019-05-22T06:00:00.000Z',
      customer: { _id: customerIdList[1], identity: { title: 'mr', firstname: 'Bojack', lastname: 'Horseman' } },
      thirdPartyPayer: { _id: tppIdList[1], name: 'The Sherif' },
      netInclTaxes: 170,
      subscriptions: [
        { service: { name: 'Forfait' }, hours: 15, exclTaxes: 37.5, inclTaxes: 60, discount: 15, vat: 20 },
        { service: { name: 'Forfait nuit' }, hours: 7, inclTaxes: 110, exclTaxes: 100, vat: 10 },
      ],
      createdAt: '2019-10-12',
    },
  ];
  const creditNotes = [
    {
      number: 'F1501231',
      thirdPartyPayer: { _id: tppIdList[2], name: 'SW' },
      date: '2019-05-21T01:00:00.000Z',
      customer: { _id: customerIdList[2], identity: { firstname: 'Jar jar', lastname: 'Binks' } },
      subscription: { service: { name: 'Temps de qualité - autonomie' } },
      exclTaxesCustomer: 10.5,
      inclTaxesCustomer: 5.5,
      exclTaxesTpp: 8,
      inclTaxesTpp: 3,
      createdAt: '2019-10-15',
    },
    {
      number: 'F6473250',
      date: '2019-05-25T02:00:00.000Z',
      customer: { _id: customerIdList[3], identity: { lastname: 'R2D2' } },
      subscription: { service: { name: 'Temps de qualité - autonomie' } },
      exclTaxesCustomer: 10.5,
      inclTaxesCustomer: 5.5,
      createdAt: '2019-10-16',
    },
  ];
  const credentials = { company: { _id: new ObjectId() } };
  const findQuery = { date: { $lte: null, $gte: null }, company: credentials.company._id };
  const sortQuery = { date: 'desc' };
  const populateCustomerQuery = { path: 'customer', select: 'identity' };
  let findBill;
  let findCreditNote;
  let formatPriceStub;
  let formatHourStub;
  let formatFloatForExportStub;

  beforeEach(() => {
    findBill = sinon.stub(Bill, 'find');
    findCreditNote = sinon.stub(CreditNote, 'find');
    formatPriceStub = sinon.stub(UtilsHelper, 'formatPrice');
    formatHourStub = sinon.stub(UtilsHelper, 'formatHour');
    formatFloatForExportStub = sinon.stub(UtilsHelper, 'formatFloatForExport');
  });
  afterEach(() => {
    findBill.restore();
    findCreditNote.restore();
    formatPriceStub.restore();
    formatHourStub.restore();
    formatFloatForExportStub.restore();
  });

  it('should return an array containing just the header', async () => {
    findBill.returns(SinonMongoose.stubChainedQueries([], ['populate', 'sort', 'lean']));
    findCreditNote.returns(SinonMongoose.stubChainedQueries([], ['populate', 'sort', 'lean']));

    const exportArray = await ExportHelper.exportBillsAndCreditNotesHistory(null, null, credentials);

    expect(exportArray).toEqual([header]);
    SinonMongoose.calledOnceWithExactly(
      findBill,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCreditNote,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and a row of empty cells', async () => {
    findBill.returns(SinonMongoose.stubChainedQueries([{}], ['populate', 'sort', 'lean']));
    findCreditNote.returns(SinonMongoose.stubChainedQueries([{}], ['populate', 'sort', 'lean']));

    formatPriceStub.callsFake(price => (price ? `P-${price}` : ''));
    formatHourStub.callsFake(hour => (hour ? `${hour}h` : ''));
    formatFloatForExportStub.callsFake(float => (float ? `F-${float}` : ''));

    const exportArray = await ExportHelper.exportBillsAndCreditNotesHistory(null, null, credentials);

    expect(exportArray).toEqual([
      header,
      ['Facture', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      ['Avoir', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findBill,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCreditNote,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.callCount(formatPriceStub, 0);
    sinon.assert.callCount(formatHourStub, 0);
    sinon.assert.callCount(formatFloatForExportStub, 5);
  });

  it('should return an array with the header and 2 rows', async () => {
    findBill.returns(SinonMongoose.stubChainedQueries(bills, ['populate', 'sort', 'lean']));
    findCreditNote.returns(SinonMongoose.stubChainedQueries(creditNotes, ['populate', 'sort', 'lean']));

    formatPriceStub.callsFake(price => (price ? `P-${price}` : ''));
    formatHourStub.callsFake(hour => (hour ? `${hour}h` : ''));
    formatFloatForExportStub.callsFake(float => (float ? `F-${float}` : ''));

    const exportArray = await ExportHelper.exportBillsAndCreditNotesHistory(null, null, credentials);

    sinon.assert.callCount(formatPriceStub, 3);
    sinon.assert.callCount(formatFloatForExportStub, 10);
    sinon.assert.callCount(formatHourStub, 3);
    expect(exportArray).toEqual([
      header,
      [
        'Facture',
        'FACT-0549236',
        '20/05/2019',
        customerIdList[0].toHexString(),
        'Mme',
        'MATHY',
        'Mimi',
        tppIdList[0].toHexString(),
        'TF1',
        'F-67.5',
        'F-81',
        'F-20',
        'Temps de qualité - autonomie - 20h - P-60 TTC',
        '11/10/2019',
      ],
      [
        'Facture',
        'FACT-0419457',
        '22/05/2019',
        customerIdList[1].toHexString(),
        'M.',
        'HORSEMAN',
        'Bojack',
        tppIdList[1].toHexString(),
        'The Sherif',
        'F-137.5',
        'F-170',
        'F-22',
        'Forfait - 15h - P-60 TTC\r\nForfait nuit - 7h - P-110 TTC',
        '12/10/2019',
      ],
      [
        'Avoir',
        'F1501231',
        '21/05/2019',
        customerIdList[2].toHexString(),
        '',
        'BINKS',
        'Jar jar',
        tppIdList[2].toHexString(),
        'SW',
        'F-18.5',
        'F-8.5',
        '',
        'Temps de qualité - autonomie',
        '15/10/2019',
      ],
      [
        'Avoir',
        'F6473250',
        '25/05/2019',
        customerIdList[3].toHexString(),
        '',
        'R2D2',
        '',
        '',
        '',
        'F-10.5',
        'F-5.5',
        '',
        'Temps de qualité - autonomie',
        '16/10/2019',
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      findBill,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCreditNote,
      [
        { query: 'find', args: [findQuery] },
        { query: 'sort', args: [sortQuery] },
        { query: 'populate', args: [populateCustomerQuery] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.callCount(formatHourStub, 3);
  });
});

describe('exportContractHistory', () => {
  const startDate = '2019-10-01T09:00:00';
  const endDate = '2019-11-01T09:00:00';
  let find;
  beforeEach(() => {
    find = sinon.stub(Contract, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return an array containing just the header', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    find.returns(SinonMongoose.stubChainedQueries([]));

    const result = await ExportHelper.exportContractHistory(startDate, endDate, credentials);

    expect(result).toEqual([[
      'Type',
      'Id Auxiliaire',
      'Titre',
      'Prénom',
      'Nom',
      'Date de début',
      'Date de fin',
      'Taux horaire',
      'Volume horaire hebdomadaire',
    ]]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ company: credentials.company._id, 'versions.startDate': { $lte: endDate, $gte: startDate } }] },
        { query: 'populate', args: [{ path: 'user', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array containing the header and one row', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const contracts = [{ versions: [{ startDate: '2019-10-10T00:00:00' }], user: { _id: new ObjectId() } }];

    find.returns(SinonMongoose.stubChainedQueries(contracts));

    const result = await ExportHelper.exportContractHistory(startDate, endDate, credentials);

    expect(result).toEqual([
      ['Type', 'Id Auxiliaire', 'Titre', 'Prénom', 'Nom', 'Date de début', 'Date de fin', 'Taux horaire', 'Volume horaire hebdomadaire'],
      ['Contrat', contracts[0].user._id, '', '', '', '10/10/2019', '', '', ''],
    ]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ company: credentials.company._id, 'versions.startDate': { $lte: endDate, $gte: startDate } }] },
        { query: 'populate', args: [{ path: 'user', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 2 rows', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const contracts = [
      {
        user: { identity: { title: 'mr', lastname: 'Patate' }, _id: new ObjectId() },
        versions: [{ startDate: '2019-10-10T00:00:00', weeklyHours: 12, grossHourlyRate: 10.45 }],
      },
      {
        user: { identity: { title: 'mrs', firstname: 'Patate' }, _id: new ObjectId() },
        versions: [
          { startDate: '2019-09-08T00:00:00', endDate: '2019-10-07T00:00:00', weeklyHours: 10, grossHourlyRate: 10 },
          { startDate: '2019-10-08T00:00:00', endDate: '2019-11-07T00:00:00', weeklyHours: 14, grossHourlyRate: 2 },
          { startDate: '2019-11-08T00:00:00', weeklyHours: 14, grossHourlyRate: 2 },
        ],
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(contracts));

    const result = await ExportHelper.exportContractHistory(startDate, endDate, credentials);
    expect(result).toEqual([
      ['Type', 'Id Auxiliaire', 'Titre', 'Prénom', 'Nom', 'Date de début', 'Date de fin', 'Taux horaire', 'Volume horaire hebdomadaire'],
      ['Contrat', contracts[0].user._id, 'M.', '', 'Patate', '10/10/2019', '', '10,45', 12],
      ['Avenant', contracts[1].user._id, 'Mme', 'Patate', '', '08/10/2019', '07/11/2019', '2,00', 14],
    ]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ company: credentials.company._id, 'versions.startDate': { $lte: endDate, $gte: startDate } }] },
        { query: 'populate', args: [{ path: 'user', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('formatSurchargedDetailsForExport', () => {
  const emptyPlan = { planName: 'Empty plan' };
  const unknownPlan = { planName: 'Unknown plan', helloWorld: { percentage: 7, hours: 10 } };
  const onePlan = {
    plan: [{
      planName: 'Small plan',
      sunday: { percentage: 28, hours: 11 },
      evening: { percentage: 17, hours: 12 },
      custom: { percentage: 8, hours: 13 },
    }],
  };
  const onePlanWithDiff = {
    plan: [{
      planName: 'Small plan',
      sunday: { percentage: 28, hours: 11 },
      evening: { percentage: 17, hours: 12 },
      custom: { percentage: 8, hours: 13 },
    }],
    diff: {
      plan: [{
        planName: 'Full plan',
        saturday: { percentage: 20, hours: 1.12543 },
        sunday: { percentage: 30, hours: 2.2 },
        publicHoliday: { percentage: 25, hours: 3 },
        twentyFifthOfDecember: { percentage: 35, hours: 4 },
      }],
    },
  };
  const multiplePlans = {
    plan: [
      {
        planName: 'Small plan',
        sunday: { percentage: 28, hours: 11 },
        evening: { percentage: 17, hours: 12 },
        custom: { percentage: 8, hours: 13 },
      },
      { planName: 'Unknown plan', helloWorld: { percentage: 7, hours: 10 } },
      { planName: 'Empty plan' },
      {
        planName: 'Full plan',
        saturday: { percentage: 20, hours: 1.12543 },
        sunday: { percentage: 30, hours: 2.2 },
        publicHoliday: { percentage: 25, hours: 3 },
        twentyFifthOfDecember: { percentage: 35, hours: 4 },
        firstOfMay: { percentage: 32, hours: 5 },
        firstOfJanuary: { percentage: 36, hours: 3 },
        evening: { percentage: 15, hours: 6 },
        custom: { percentage: 5, hours: 7 },
      },
    ],
  };

  let formatFloatForExportStub;

  beforeEach(() => {
    formatFloatForExportStub = sinon.stub(UtilsHelper, 'formatFloatForExport');
    formatFloatForExportStub.callsFake(nb => Number(nb).toFixed(2));
  });

  afterEach(() => {
    formatFloatForExportStub.restore();
  });

  it('should returns an empty string if no arg is provided', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport();
    sinon.assert.notCalled(formatFloatForExportStub);
    expect(result).toBe('');
  });

  it('should returns an empty string if there are no details', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport([]);
    expect(result).toBe('');
  });

  it('should returns an empty string if the plan is empty', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport([emptyPlan]);
    expect(result).toBe('');
  });

  it('should returns an empty string if the plan has unknown surcharges', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport([unknownPlan]);
    expect(result).toBe('');
  });

  it('should returns a plan\'s details if one is provided', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport(onePlan, 'plan');
    sinon.assert.callCount(formatFloatForExportStub, 3);
    expect(result).toBe('Small plan\r\nDimanche, 28%, 11.00h\r\nSoirée, 17%, 12.00h\r\nPersonnalisée, 8%, 13.00h');
  });

  it('should returns a plan\'s detailswithDiff', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport(onePlanWithDiff, 'plan');
    sinon.assert.callCount(formatFloatForExportStub, 7);
    expect(result).toBe('Small plan\r\nDimanche, 28%, 11.00h\r\nSoirée, 17%, 12.00h\r\nPersonnalisée, 8%, 13.00h\r\n\r\nFull plan (M-1)\r\nSamedi, 20%, 1.13h\r\nDimanche, 30%, 2.20h\r\nJours fériés, 25%, 3.00h\r\n25 Décembre, 35%, 4.00h');
  });

  it('should returns all the details if several plans are provided', () => {
    const result = ExportHelper.formatSurchargedDetailsForExport(multiplePlans, 'plan');
    sinon.assert.callCount(formatFloatForExportStub, 11);
    expect(result).toBe('Small plan\r\nDimanche, 28%, 11.00h\r\nSoirée, 17%, 12.00h\r\nPersonnalisée, 8%, 13.00h\r\n\r\nFull plan\r\nSamedi, 20%, 1.13h\r\nDimanche, 30%, 2.20h\r\nJours fériés, 25%, 3.00h\r\n25 Décembre, 35%, 4.00h\r\n1er Mai, 32%, 5.00h\r\n1er Janvier, 36%, 3.00h\r\nSoirée, 15%, 6.00h\r\nPersonnalisée, 5%, 7.00h');
  });
});

describe('exportPayAndFinalPayHistory', () => {
  const header = [
    'Id Auxiliaire',
    'Titre',
    'Prénom',
    'Nom',
    'Equipe',
    'Date d\'embauche',
    'Début',
    'Date de notif',
    'Motif',
    'Fin',
    'Heures contrat',
    'Heures absences',
    'Heures à travailler',
    'Heures travaillées',
    'Dont exo non majo',
    'Dont exo et majo',
    'Détails des majo exo',
    'Dont non exo et non majo',
    'Dont non exo et majo',
    'Détails des majo non exo',
    'Heures transports',
    'Solde heures',
    'Dont diff mois précédent',
    'Compteur',
    'Heures sup à payer',
    'Heures comp à payer',
    'Mutuelle',
    'Remboursement transport',
    'Km payés',
    'Km parcourus',
    'Frais téléphoniques',
    'Prime',
    'Indemnité',
  ];
  const pays = [
    {
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Tata', lastname: 'Toto', title: 'mrs' },
        sector: { name: 'Test' },
        contracts: [{ startDate: '2019-05-04T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 77.94,
      absencesHours: 10,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 1',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 2',
      paidTransportHours: 6,
      hoursBalance: -77.94,
      hoursCounter: -77.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 37.6,
      travelledKm: 12.3,
      paidKm: 12.3,
      phoneFees: 18,
      bonus: 0,
      _id: new ObjectId(),
      diff: {
        paidTransportHours: 2,
        hoursBalance: 8,
        notSurchargedAndNotExempt: 2,
        notSurchargedAndExempt: 2,
        surchargedAndExempt: 2,
        surchargedAndExemptDetails: [],
        surchargedAndNotExempt: 2,
        surchargedAndNotExemptDetails: [],
        workedHours: 0,
      },
      hoursToWork: 30,
      month: '01-2019',
    },
    {
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Titi', lastname: 'Tutu' },
        sector: { name: 'Autre test' },
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 97.94,
      absencesHours: 10,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 3',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 4',
      paidTransportHours: 0,
      hoursBalance: -97.94,
      hoursCounter: -97.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 47.6,
      travelledKm: 15.1,
      paidKm: 15.1,
      phoneFees: 20,
      bonus: 100,
      diff: {
        paidTransportHours: 2,
        absencesHours: -2,
        hoursBalance: 8,
        notSurchargedAndNotExempt: 2,
        notSurchargedAndExempt: 2,
        surchargedAndExempt: 2,
        surchargedAndExemptDetails: [],
        surchargedAndNotExempt: 2,
        surchargedAndNotExemptDetails: [],
        workedHours: 0,
      },
      hoursToWork: 20,
    },
  ];
  const finalPays = [
    {
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Tata', lastname: 'Toto', title: 'mr' },
        sector: { name: 'Test' },
        contracts: [{ startDate: '2019-03-04T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endNotificationDate: '2019-05-31T20:00:00.000Z',
      endReason: 'resignation',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 77.94,
      absencesHours: 0,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 1',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 2',
      paidTransportHours: 10,
      hoursBalance: -77.94,
      hoursCounter: -77.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 37.6,
      travelledKm: 15.1,
      paidKm: 0,
      phoneFees: 18,
      bonus: 0,
      compensation: 156,
      diff: {
        paidTransportHours: 2,
        absencesHours: 3,
        hoursBalance: 8,
        notSurchargedAndNotExempt: 2,
        notSurchargedAndExempt: 2,
        surchargedAndExempt: 2,
        surchargedAndExemptDetails: [],
        surchargedAndNotExempt: 2,
        surchargedAndNotExemptDetails: [],
        workedHours: 0,
      },
      hoursToWork: 20,
    },
    {
      auxiliary: {
        _id: new ObjectId(),
        identity: { firstname: 'Titi', lastname: 'Tutu' },
        sector: { name: 'Autre test' },
        contracts: [{ startDate: '2019-03-04T00:00:00' }, { startDate: '2019-01-19T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endNotificationDate: '2019-05-31T20:00:00.000Z',
      endReason: 'mutation',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 97.94,
      absencesHours: 0,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 3',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 4',
      paidTransportHours: 0,
      hoursBalance: -97.94,
      hoursCounter: -97.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 47.6,
      travelledKm: 15.1,
      paidKm: 15.1,
      phoneFees: 20,
      bonus: 100,
      compensation: 0,
      diff: {
        paidTransportHours: 0,
        absencesHours: 0,
        hoursBalance: 8,
        notSurchargedAndNotExempt: 2,
        notSurchargedAndExempt: 2,
        surchargedAndExempt: 2,
        surchargedAndExemptDetails: [],
        surchargedAndNotExempt: 2,
        surchargedAndNotExemptDetails: [],
        workedHours: 0,
      },
      hoursToWork: 20,
    },
  ];
  let findPay;
  let findFinalPay;
  let formatFloatForExportStub;
  let formatSurchargedDetailsForExport;
  beforeEach(() => {
    findPay = sinon.stub(Pay, 'find');
    findFinalPay = sinon.stub(FinalPay, 'find');
    formatFloatForExportStub = sinon.stub(UtilsHelper, 'formatFloatForExport');
    formatSurchargedDetailsForExport = sinon.stub(ExportHelper, 'formatSurchargedDetailsForExport');
  });
  afterEach(() => {
    findPay.restore();
    findFinalPay.restore();
    formatFloatForExportStub.restore();
    formatSurchargedDetailsForExport.restore();
  });

  it('should return an array containing just the header', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const startDate = '2019-11-10';
    const endDate = '2019-12-10';
    const query = {
      endDate: { $lte: moment(endDate).endOf('M').toDate() },
      startDate: { $gte: moment(startDate).startOf('M').toDate() },
      company: credentials.company._id,
    };

    findPay.returns(SinonMongoose.stubChainedQueries([], ['sort', 'populate', 'lean']));
    findFinalPay.returns(SinonMongoose.stubChainedQueries([], ['sort', 'populate', 'lean']));

    const exportArray = await ExportHelper.exportPayAndFinalPayHistory(startDate, endDate, credentials);

    expect(exportArray).toEqual([header]);
    SinonMongoose.calledOnceWithExactly(
      findPay,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 'desc' }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity sector contracts',
            populate: [
              { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
              { path: 'contracts' },
            ],
          }],
        },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findFinalPay,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 'desc' }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity sector contracts',
            populate: [
              { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
              { path: 'contracts' },
            ],
          }],
        },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });

  it('should return an array with the header and 4 rows', async () => {
    const credentials = { company: { _id: new ObjectId() } };
    const startDate = '2019-11-10';
    const endDate = '2019-12-10';
    const query = {
      endDate: { $lte: moment(endDate).endOf('M').toDate() },
      startDate: { $gte: moment(startDate).startOf('M').toDate() },
      company: credentials.company._id,
    };

    findPay.returns(SinonMongoose.stubChainedQueries(pays, ['sort', 'populate', 'lean']));
    findFinalPay.returns(SinonMongoose.stubChainedQueries(finalPays, ['sort', 'populate', 'lean']));

    formatFloatForExportStub.callsFake(nb => Number(nb).toFixed(2).replace('.', ','));
    formatSurchargedDetailsForExport.returnsArg(1);

    const exportArray = await ExportHelper.exportPayAndFinalPayHistory(startDate, endDate, credentials);

    expect(exportArray).toEqual([
      header,
      [expect.any(Object), 'Mme', 'Tata', 'TOTO', 'Test', '04/05/2019', '01/05/2019', '', '', '31/05/2019', '77,94',
        '10,00', '30,00', '0,00', '2,00', '2,00', 'surchargedAndExemptDetails', '2,00', '2,00',
        'surchargedAndNotExemptDetails', '8,00', '-69,94', '8,00', '-77,94', '0,00', '0,00', 'Oui', '37,60', '12,30',
        '12,30', '18,00', '0,00', '0,00'],
      [expect.any(Object), '', 'Titi', 'TUTU', 'Autre test', '', '01/05/2019', '', '', '31/05/2019', '97,94', '8,00',
        '20,00', '0,00', '2,00', '2,00', 'surchargedAndExemptDetails', '2,00', '2,00', 'surchargedAndNotExemptDetails',
        '2,00', '-89,94', '8,00', '-97,94', '0,00', '0,00', 'Oui', '47,60', '15,10', '15,10', '20,00', '100,00', '0,00'],
      [expect.any(Object), 'M.', 'Tata', 'TOTO', 'Test', '04/03/2019', '01/05/2019', '31/05/2019', 'Démission',
        '31/05/2019', '77,94', '3,00', '20,00', '0,00', '2,00', '2,00', 'surchargedAndExemptDetails', '2,00', '2,00',
        'surchargedAndNotExemptDetails', '12,00', '-69,94', '8,00', '-77,94', '0,00', '0,00', 'Oui', '37,60', '0,00',
        '15,10', '18,00', '0,00', '156,00'],
      [expect.any(Object), '', 'Titi', 'TUTU', 'Autre test', '19/01/2019', '01/05/2019', '31/05/2019', 'Mutation',
        '31/05/2019', '97,94', '0,00', '20,00', '0,00', '2,00', '2,00', 'surchargedAndExemptDetails', '2,00', '2,00',
        'surchargedAndNotExemptDetails', '0,00', '-89,94', '8,00', '-97,94', '0,00', '0,00', 'Oui', '47,60', '15,10',
        '15,10', '20,00', '100,00', '0,00'],
    ]);
    sinon.assert.callCount(formatFloatForExportStub, 77);
    SinonMongoose.calledOnceWithExactly(
      findPay,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 'desc' }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity sector contracts',
            populate: [
              { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
              { path: 'contracts' },
            ],
          }],
        },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findFinalPay,
      [
        { query: 'find', args: [query] },
        { query: 'sort', args: [{ startDate: 'desc' }] },
        {
          query: 'populate',
          args: [{
            path: 'auxiliary',
            select: 'identity sector contracts',
            populate: [
              { path: 'sector', select: '_id sector', match: { company: credentials.company._id } },
              { path: 'contracts' },
            ],
          }],
        },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });
});

describe('exportPaymentsHistory', () => {
  const header = [
    'Nature',
    'Identifiant',
    'Date',
    'Id Bénéficiaire',
    'Titre',
    'Nom',
    'Prénom',
    'Id tiers payeur',
    'Tiers payeur',
    'Moyen de paiement',
    'Montant TTC en €',
  ];
  const customerIdList = [new ObjectId(), new ObjectId()];
  const tppIdList = [new ObjectId(), new ObjectId()];

  const paymentsList = [
    {
      number: 'REG-101051900562',
      type: 'bank_transfer',
      nature: 'payment',
      date: '2019-05-20T06:00:00.000Z',
      customer: {
        _id: customerIdList[0],
        identity: {
          title: 'mrs',
          firstname: 'Mimi',
          lastname: 'Mathy',
        },
      },
      thirdPartyPayer: { _id: tppIdList[0], name: 'TF1' },
      netInclTaxes: 389276.023,
    }, {
      number: 'REG-101051900342',
      type: 'direct_debit',
      nature: 'refund',
      date: '2019-05-22T06:00:00.000Z',
      customer: {
        _id: customerIdList[1],
        identity: {
          title: 'mr',
          firstname: 'Bojack',
          lastname: 'Horseman',
        },
      },
      thirdPartyPayer: { _id: tppIdList[1], name: 'The Sherif' },
      netInclTaxes: 1002.4,
    },
  ];

  let find;

  beforeEach(() => {
    find = sinon.stub(Payment, 'find');
  });

  afterEach(() => {
    find.restore();
  });

  it('should return an array containing just the header', async () => {
    find.returns(SinonMongoose.stubChainedQueries([], ['sort', 'populate', 'lean']));

    const credentials = { company: new ObjectId() };
    const exportArray = await ExportHelper.exportPaymentsHistory(null, null, credentials);

    expect(exportArray).toEqual([header]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ date: { $lte: null, $gte: null }, company: credentials.company._id }] },
        { query: 'sort', args: [{ date: 'desc' }] },
        { query: 'populate', args: [{ path: 'customer', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return an array with the header and 2 rows', async () => {
    find.returns(SinonMongoose.stubChainedQueries(paymentsList, ['sort', 'populate', 'lean']));

    const credentials = { company: new ObjectId() };
    const exportArray = await ExportHelper.exportPaymentsHistory(null, null, credentials);

    expect(exportArray).toEqual([
      header,
      [
        'Paiement',
        'REG-101051900562',
        '20/05/2019',
        customerIdList[0].toHexString(),
        'Mme',
        'MATHY',
        'Mimi',
        tppIdList[0].toHexString(),
        'TF1',
        'Virement',
        '389276,02',
      ],
      [
        'Remboursement',
        'REG-101051900342',
        '22/05/2019',
        customerIdList[1].toHexString(),
        'M.',
        'HORSEMAN',
        'Bojack',
        tppIdList[1].toHexString(),
        'The Sherif',
        'Prélèvement',
        '1002,40',
      ],
    ]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ date: { $lte: null, $gte: null }, company: credentials.company._id }] },
        { query: 'sort', args: [{ date: 'desc' }] },
        { query: 'populate', args: [{ path: 'customer', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'thirdPartyPayer' }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('exportTransportsHistory', () => {
  const auxiliaryList = [
    {
      _id: new ObjectId(),
      administrative: { transportInvoice: { transportType: 'public' } },
      identity: { firstname: 'Abel', lastname: 'Auboisdormant' },
    },
    {
      _id: new ObjectId(),
      administrative: { transportInvoice: { transportType: 'private' } },
      identity: { firstname: 'Fleur', lastname: 'Ymichon' },
    },
  ];

  let getEventsByDayAndAuxiliary;
  let getPaidTransportInfo;
  let getDistanceMatrices;

  beforeEach(() => {
    getEventsByDayAndAuxiliary = sinon.stub(EventRepository, 'getEventsByDayAndAuxiliary');
    getPaidTransportInfo = sinon.stub(DraftPayHelper, 'getPaidTransportInfo');
    getDistanceMatrices = sinon.stub(DistanceMatrixHelper, 'getDistanceMatrices');
  });

  afterEach(() => {
    getEventsByDayAndAuxiliary.restore();
    getPaidTransportInfo.restore();
    getDistanceMatrices.restore();
  });

  it('should return an empty array if no transport', async () => {
    getEventsByDayAndAuxiliary.returns([]);
    getDistanceMatrices.returns([]);

    const credentials = { company: { _id: new ObjectId() } };
    const exportArray = await ExportHelper.exportTransportsHistory('2021-06-24', '2021-06-30', credentials);

    expect(exportArray).toEqual([['Aucune donnée sur la période sélectionnée']]);
    sinon.assert.notCalled(getPaidTransportInfo);
  });

  it('should return an array with the header and 2 rows', async () => {
    getEventsByDayAndAuxiliary.returns([
      {
        auxiliary: auxiliaryList[0],
        eventsByDay: [
          [
            { startDate: '2021-06-25T10:00:00', endDate: '2021-06-25T12:00:00' },
            { startDate: '2021-06-25T14:00:00', endDate: '2021-06-25T16:00:00' },
          ],
          [
            { startDate: '2021-06-29T12:30:00', endDate: '2021-06-29T14:30:00' },
            { startDate: '2021-06-29T10:00:00', endDate: '2021-06-29T12:00:00' },
          ],
          [
            { startDate: '2021-06-27T10:00:00', endDate: '2021-06-27T12:00:00' },
          ],
        ],
      },
      {
        auxiliary: auxiliaryList[1],
        eventsByDay: [
          [
            { startDate: '2021-06-25T10:00:00', endDate: '2021-06-25T12:00:00' },
          ],
          [
            { startDate: '2021-06-28T14:00:00', endDate: '2021-06-28T16:00:00' },
            { startDate: '2021-06-28T10:00:00', endDate: '2021-06-28T12:00:00' },
          ],
        ],
      },
    ]);
    getPaidTransportInfo.onCall(0).returns({
      duration: 66,
      travelledKm: 5,
      origins: '5 avenue du test, Saint Mandé',
      destinations: '25 avenue du test, Saint Mandé',
      transportDuration: 66,
      breakDuration: 240,
      pickTransportDuration: true,
    });
    getPaidTransportInfo.onCall(1).returns({
      duration: 30,
      travelledKm: 15,
      origins: '5 rue du test, Paris',
      destinations: '25 rue du test, Paris',
      transportDuration: 16,
      breakDuration: 30,
      pickTransportDuration: false,
    });
    getPaidTransportInfo.onCall(2).returns({
      duration: 126,
      travelledKm: 25,
      origins: '5 boulevard du test, Paris',
      destinations: '25 place du test, Paris',
      transportDuration: 126,
      breakDuration: 240,
      pickTransportDuration: true,
    });
    getDistanceMatrices.returns([]);

    const credentials = { company: { _id: new ObjectId() } };
    const exportArray = await ExportHelper.exportTransportsHistory('2021-06-24', '2021-06-30', credentials);

    expect(exportArray).toEqual([
      [
        'Id de l\'auxiliaire',
        'Prénom de l\'auxiliaire',
        'Nom de l\'auxiliaire',
        'Heure de départ du trajet',
        'Heure d\'arrivée du trajet',
        'Adresse de départ',
        'Adresse d\'arrivée',
        'Distance',
        'Mode de transport',
        'Durée du trajet',
        'Durée inter vacation',
        'Pause prise en compte',
        'Durée rémunérée',
      ],
      [
        `${auxiliaryList[0]._id}`,
        'Abel',
        'Auboisdormant',
        '25/06/2021 12:00:00',
        '25/06/2021 14:00:00',
        '5 avenue du test, Saint Mandé',
        '25 avenue du test, Saint Mandé',
        '5,000',
        'Transports en commun / À pied',
        '1,1000',
        '4,0000',
        'Non',
        '1,1000',
      ],
      [
        `${auxiliaryList[0]._id}`,
        'Abel',
        'Auboisdormant',
        '29/06/2021 12:00:00',
        '29/06/2021 12:30:00',
        '5 rue du test, Paris',
        '25 rue du test, Paris',
        '15,000',
        'Transports en commun / À pied',
        '0,2667',
        '0,5000',
        'Oui',
        '0,5000',
      ],
      [
        `${auxiliaryList[1]._id}`,
        'Fleur',
        'Ymichon',
        '28/06/2021 12:00:00',
        '28/06/2021 14:00:00',
        '5 boulevard du test, Paris',
        '25 place du test, Paris',
        '25,000',
        'Véhicule personnel',
        '2,1000',
        '4,0000',
        'Non',
        '2,1000',
      ],
    ]);
    sinon.assert.callCount(getPaidTransportInfo, 3);
  });
});
