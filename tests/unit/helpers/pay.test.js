const expect = require('expect');
const sinon = require('sinon');

const Pay = require('../../../src/models/Pay');
const FinalPay = require('../../../src/models/FinalPay');
const PayHelper = require('../../../src/helpers/pay');
const UtilsHelper = require('../../../src/helpers/utils');

require('sinon-mongoose');

describe('formatSurchargedDetailsForExport', () => {
  const fullPlan = {
    planName: 'Full plan',
    saturday: { percentage: 20, hours: 1.12543 },
    sunday: { percentage: 30, hours: 2.2 },
    publicHoliday: { percentage: 25, hours: 3 },
    twentyFifthOfDecember: { percentage: 35, hours: 4 },
    firstOfMay: { percentage: 32, hours: 5 },
    evening: { percentage: 15, hours: 6 },
    custom: { percentage: 5, hours: 7 },
  };
  const emptyPlan = { planName: 'Empty plan' };
  const unknownPlan = { planName: 'Unknown plan', helloWorld: { percentage: 7, hours: 10 } };
  const smallPlan = {
    planName: 'Small plan',
    sunday: { percentage: 28, hours: 11 },
    evening: { percentage: 17, hours: 12 },
    custom: { percentage: 8, hours: 13 },
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
    const result = PayHelper.formatSurchargedDetailsForExport();
    sinon.assert.notCalled(formatFloatForExportStub);
    expect(result).toBe('');
  });

  it('should returns an empty string if there are no details', () => {
    const result = PayHelper.formatSurchargedDetailsForExport([]);
    expect(result).toBe('');
  });

  it('should returns an empty string if the plan is empty', () => {
    const result = PayHelper.formatSurchargedDetailsForExport([emptyPlan]);
    expect(result).toBe('');
  });

  it('should returns an empty string if the plan has unknown surcharges', () => {
    const result = PayHelper.formatSurchargedDetailsForExport([unknownPlan]);
    expect(result).toBe('');
  });

  it('should returns a plan\'s details if one is provided', () => {
    const result = PayHelper.formatSurchargedDetailsForExport([smallPlan]);
    sinon.assert.callCount(formatFloatForExportStub, 3);
    expect(result).toBe('Small plan\r\nDimanche, 28%, 11.00h\r\nSoirée, 17%, 12.00h\r\nPersonnalisée, 8%, 13.00h');
  });

  it('should returns all the details if several plans are provided', () => {
    const result = PayHelper.formatSurchargedDetailsForExport([smallPlan, emptyPlan, fullPlan, unknownPlan]);
    sinon.assert.callCount(formatFloatForExportStub, 10);
    expect(result).toBe('Small plan\r\nDimanche, 28%, 11.00h\r\nSoirée, 17%, 12.00h\r\nPersonnalisée, 8%, 13.00h\r\n\r\nFull plan\r\nSamedi, 20%, 1.13h\r\nDimanche, 30%, 2.20h\r\nJours fériés, 25%, 3.00h\r\n25 décembre, 35%, 4.00h\r\n1er mai, 32%, 5.00h\r\nSoirée, 15%, 6.00h\r\nPersonnalisée, 5%, 7.00h');
  });
});

describe('exportPayAndFinalPayHistory', () => {
  const header = [
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
    'Heures travaillées',
    'Dont exo non majo',
    'Dont exo et majo',
    'Détails des majo exo',
    'Dont non exo et non majo',
    'Dont non exo et majo',
    'Détails des majo non exo',
    'Solde heures',
    'Compteur',
    'Heures sup à payer',
    'Heures comp à payer',
    'Mutuelle',
    'Transport',
    'Autres frais',
    'Prime',
    'Indemnité',
  ];
  const pays = [
    {
      auxiliary: {
        identity: { firstname: 'Tata', lastname: 'Toto', title: 'mrs' },
        sector: { name: 'Test' },
        contracts: [{ startDate: '2019-05-04T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 77.94,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 1',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 2',
      hoursBalance: -77.94,
      hoursCounter: -77.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 37.6,
      otherFees: 18,
      bonus: 0,
    },
    {
      auxiliary: {
        identity: { firstname: 'Titi', lastname: 'Tutu' },
        sector: { name: 'Autre test' },
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 97.94,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 3',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 4',
      hoursBalance: -97.94,
      hoursCounter: -97.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 47.6,
      otherFees: 20,
      bonus: 100,
    },
  ];
  const finalPays = [
    {
      auxiliary: {
        identity: { firstname: 'Tata', lastname: 'Toto', title: 'mr' },
        sector: { name: 'Test' },
        contracts: [{ startDate: '2019-03-04T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endNotificationDate: '2019-05-31T20:00:00.000Z',
      endReason: 'resignation',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 77.94,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 1',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 2',
      hoursBalance: -77.94,
      hoursCounter: -77.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 37.6,
      otherFees: 18,
      bonus: 0,
      compensation: 156,
    },
    {
      auxiliary: {
        identity: { firstname: 'Titi', lastname: 'Tutu' },
        sector: { name: 'Autre test' },
        contracts: [{ startDate: '2019-03-04T00:00:00' }, { startDate: '2019-01-19T00:00:00' }],
      },
      startDate: '2019-05-01T00:00:00.000Z',
      endNotificationDate: '2019-05-31T20:00:00.000Z',
      endReason: 'mutation',
      endDate: '2019-05-31T20:00:00.000Z',
      contractHours: 97.94,
      workedHours: 0,
      notSurchargedAndNotExempt: 0,
      surchargedAndNotExempt: 0,
      surchargedAndNotExemptDetails: 'details 3',
      notSurchargedAndExempt: 0,
      surchargedAndExempt: 0,
      surchargedAndExemptDetails: 'details 4',
      hoursBalance: -97.94,
      hoursCounter: -97.94,
      overtimeHours: 0,
      additionalHours: 0,
      mutual: true,
      transport: 47.6,
      otherFees: 20,
      bonus: 100,
      compensation: 0,
    },
  ];
  let PayMock;
  let FinalPayMock;
  let formatFloatForExportStub;
  let formatSurchargedDetailsForExport;
  beforeEach(() => {
    PayMock = sinon.mock(Pay);
    FinalPayMock = sinon.mock(FinalPay);
    formatFloatForExportStub = sinon.stub(UtilsHelper, 'formatFloatForExport');
    formatSurchargedDetailsForExport = sinon.stub(PayHelper, 'formatSurchargedDetailsForExport');
  });
  afterEach(() => {
    PayMock.restore();
    FinalPayMock.restore();
    formatFloatForExportStub.restore();
    formatSurchargedDetailsForExport.restore();
  });

  it('should return an array containing just the header', async () => {
    const credentials = { company: 'qwertyuiop' };
    PayMock.expects('find')
      .chain('sort')
      .chain('populate')
      .chain('lean')
      .once()
      .returns([]);
    FinalPayMock.expects('find')
      .chain('sort')
      .chain('populate')
      .chain('lean')
      .once()
      .returns([]);
    const exportArray = await PayHelper.exportPayAndFinalPayHistory(null, null, credentials);

    expect(exportArray).toEqual([header]);
  });

  it('should return an array with the header and 2 rows', async () => {
    const credentials = { company: 'qwertyuiop' };
    PayMock.expects('find')
      .chain('sort')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(pays);
    FinalPayMock.expects('find')
      .chain('sort')
      .chain('populate')
      .chain('lean')
      .once()
      .returns(finalPays);
    formatFloatForExportStub.callsFake(nb => Number(nb).toFixed(2).replace('.', ','));
    formatSurchargedDetailsForExport.returnsArg(0);

    const exportArray = await PayHelper.exportPayAndFinalPayHistory(null, null, credentials);

    expect(exportArray).toEqual([
      header,
      ['Mme', 'Tata', 'TOTO', 'Test', '04/05/2019', '01/05/2019', '', '', '31/05/2019', '77,94', '0,00', '0,00', '0,00', 'details 2', '0,00', '0,00', 'details 1', '-77,94', '-77,94', '0,00', '0,00', 'Oui', '37,60', '18,00', '0,00', '0,00'],
      ['', 'Titi', 'TUTU', 'Autre test', '', '01/05/2019', '', '', '31/05/2019', '97,94', '0,00', '0,00', '0,00', 'details 4', '0,00', '0,00', 'details 3', '-97,94', '-97,94', '0,00', '0,00', 'Oui', '47,60', '20,00', '100,00', '0,00'],
      ['M.', 'Tata', 'TOTO', 'Test', '04/03/2019', '01/05/2019', '31/05/2019', 'Démission', '31/05/2019', '77,94', '0,00', '0,00', '0,00', 'details 2', '0,00', '0,00', 'details 1', '-77,94', '-77,94', '0,00', '0,00', 'Oui', '37,60', '18,00', '0,00', '156,00'],
      ['', 'Titi', 'TUTU', 'Autre test', '19/01/2019', '01/05/2019', '31/05/2019', 'Mutation', '31/05/2019', '97,94', '0,00', '0,00', '0,00', 'details 4', '0,00', '0,00', 'details 3', '-97,94', '-97,94', '0,00', '0,00', 'Oui', '47,60', '20,00', '100,00', '0,00'],
    ]);
    sinon.assert.callCount(formatFloatForExportStub, 53);
  });
});
