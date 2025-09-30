const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const randomize = require('randomatic');
const { expect } = require('expect');
const XmlSEPAFileInfosHelper = require('../../../src/helpers/xmlSEPAFileInfos');
const UtilsHelper = require('../../../src/helpers/utils');
const XmlHelper = require('../../../src/helpers/xml');
const { XML_GENERATED } = require('../../../src/helpers/constants');
const XmlSEPAFileInfos = require('../../../src/models/XmlSEPAFileInfos');
const CoursePayment = require('../../../src/models/CoursePayment');
const VendorCompany = require('../../../src/models/VendorCompany');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../utilsMock');

describe('generateSEPAHeader', () => {
  it('should return a sepa header object', () => {
    const data = {
      sepaId: 'MSG00000123456018054830052445G',
      createdDate: '2025-06-23T22:00:00.000Z',
      transactionsCount: 2,
      totalSum: 110,
      creditorName: 'Test',
      ics: '123456',
    };
    const result = XmlSEPAFileInfosHelper.generateSEPAHeader(data);

    expect(result).toEqual(expect.objectContaining({
      MsgId: 'MSG00000123456018054830052445G',
      CreDtTm: '2025-06-23T22:00:00.000Z',
      NbOfTxs: 2,
      CtrlSum: 110,
      InitgPty: {
        Nm: 'Test',
        Id: { OrgId: { Othr: { Id: '123456' } } },
      },
    }));
  });
});

describe('generatePaymentInfo', () => {
  let getFixedNb;
  beforeEach(() => {
    getFixedNb = sinon.stub(UtilsHelper, 'getFixedNumber');
  });
  afterEach(() => {
    getFixedNb.restore();
  });

  it('should return SEPA payment info object', () => {
    const data = {
      id: 'MSG123456R',
      sequenceType: 'RCUR',
      method: 'DD',
      txNumber: 3,
      sum: 350,
      collectionDate: '2025-09-29T13:45:25.437Z',
      creditor: {
        name: 'Test',
        iban: 'FR3514508000505917721779B12',
        bic: 'BNMDFRPP',
        ics: '1234567',
      },
    };
    getFixedNb.returns(data.sum.toFixed(2));
    const result = XmlSEPAFileInfosHelper.generatePaymentInfo(data);

    expect(result).toEqual({
      PmtInfId: data.id,
      PmtMtd: data.method,
      NbOfTxs: data.txNumber,
      CtrlSum: '350.00',
      PmtTpInf: {
        SvcLvl: {
          Cd: 'SEPA',
        },
        LclInstrm: {
          Cd: 'CORE',
        },
        SeqTp: data.sequenceType,
      },
      ReqdColltnDt: '2025-09-29T13:45:25.437Z',
      Cdtr: {
        Nm: data.creditor.name,
      },
      CdtrAcct: {
        Id: {
          IBAN: data.creditor.iban,
        },
        Ccy: 'EUR',
      },
      CdtrAgt: {
        FinInstnId: {
          BIC: data.creditor.bic,
        },
      },
      ChrgBr: 'SLEV',
      CdtrSchmeId: {
        Id: {
          PrvtId: {
            Othr: {
              Id: data.creditor.ics,
              SchmeNm: {
                Prtry: 'SEPA',
              },
            },
          },
        },
      },
      DrctDbtTxInf: [],
    });
  });
});

describe('generateTransactionInfos', () => {
  it('should return SEPA transaction info object', () => {
    const data = {
      _id: new ObjectId(),
      number: 'FACT-02200:REG-02001,REG-02012,FACT-01239:REG-02010',
      amount: 1500,
      debitorName: 'Payeur',
      debitorIBAN: 'FR3514508000505917721779B12',
      debitorBIC: 'ASDFFRPP',
      debitorRUM: 'RUM-101123456787654',
      mandateSignatureDate: '2025-06-23T22:00:00.000Z',
      globalTransactionName: 'Compani-Septembre2025',
    };

    const result = XmlSEPAFileInfosHelper.generateTransactionInfos(data);

    expect(result).toEqual({
      PmtId: {
        EndToEndId: 'FACT-02200:REG-02001,REG-02012,FACT-01239:REG-02010',
      },
      InstdAmt: {
        '@Ccy': 'EUR',
        '#text': 1500,
      },
      DrctDbtTx: {
        MndtRltdInf: {
          MndtId: 'RUM-101123456787654',
          DtOfSgntr: '2025-06-23T22:00:00.000Z',
        },
      },
      DbtrAgt: { FinInstnId: { BIC: 'ASDFFRPP' } },
      Dbtr: { Nm: 'Payeur' },
      DbtrAcct: { Id: { IBAN: 'FR3514508000505917721779B12' } },
      RmtInf: { Ustrd: 'Compani-Septembre2025' },
    });
  });
});

describe('formatTransactionNumber', () => {
  it('should format transaction number', () => {
    const payments = [
      {
        courseBill: { number: 'FACT-02200' },
        number: 'REG-02001',
      },
      {
        courseBill: { number: 'FACT-02200' },
        number: 'REG-02012',
      },
      {
        courseBill: { number: 'FACT-01239' },
        number: 'REG-02010',
      },
    ];

    const result = XmlSEPAFileInfosHelper.formatTransactionNumber(payments);
    expect(result).toEqual('FACT-02200:REG-02001,REG-02012,FACT-01239:REG-02010');
  });
});

describe('generateSEPAFile', () => {
  let coursePaymentFind;
  let formatTransactionNumber;
  let vendorCompanyFindOne;
  let generateSEPAHeader;
  let generatePaymentInfo;
  let getFixedNumber;
  let getLastVersion;
  let generateTransactionInfos;
  let generateXML;
  let randomizeStub;
  beforeEach(() => {
    formatTransactionNumber = sinon.stub(XmlSEPAFileInfosHelper, 'formatTransactionNumber');
    coursePaymentFind = sinon.stub(CoursePayment, 'find');
    vendorCompanyFindOne = sinon.stub(VendorCompany, 'findOne');
    getFixedNumber = sinon.stub(UtilsHelper, 'getFixedNumber');
    generateSEPAHeader = sinon.stub(XmlSEPAFileInfosHelper, 'generateSEPAHeader');
    generatePaymentInfo = sinon.stub(XmlSEPAFileInfosHelper, 'generatePaymentInfo');
    getLastVersion = sinon.stub(UtilsHelper, 'getLastVersion');
    generateTransactionInfos = sinon.stub(XmlSEPAFileInfosHelper, 'generateTransactionInfos');
    generateXML = sinon.stub(XmlHelper, 'generateXML');
    UtilsMock.mockCurrentDate('2025-09-29T13:45:25.437Z');
    randomizeStub = sinon.stub('randomize', randomize);
  });
  afterEach(() => {
    coursePaymentFind.restore();
    formatTransactionNumber.restore();
    vendorCompanyFindOne.restore();
    getFixedNumber.restore();
    generateSEPAHeader.restore();
    generatePaymentInfo.restore();
    getLastVersion.restore();
    generateTransactionInfos.restore();
    generateXML.restore();
    UtilsMock.unmockCurrentDate();
    randomizeStub.restore();
  });

  it('should generate SEPA file', () => {
    const paymentIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const payments = [
      {
        _id: paymentIds[0],
        number: 'REG-00012',
        netInclTaxes: 500,
        courseBill: {
          number: 'FACT-0001',
          payer: {
            name: 'Alenvi',
            bic: 'QWERFRPP',
            iban: 'FR2217569000708935247791H65',
            debitMandates: [
              {
                rum: 'R-1234567865',
                signedAt: '2024-07-23T22:00:00.000Z',
                file: { publicId: '12355', link: 'unLien/12355' },
                createdAt: '2024-06-23T22:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        _id: paymentIds[1],
        number: 'REG-00013',
        netInclTaxes: 500,
        courseBill: {
          number: 'FACT-0001',
          payer: {
            name: 'Alenvi',
            bic: 'QWERFRPP',
            iban: 'FR2217569000708935247791H65',
            debitMandates: [
              {
                rum: 'R-1234567865',
                signedAt: '2024-07-23T22:00:00.000Z',
                file: { publicId: '12355', link: 'unLien/12355' },
                createdAt: '2024-06-23T22:00:00.000Z',
              },
            ],
          },
        },
      },
      {
        _id: paymentIds[2],
        number: 'REG-00014',
        netInclTaxes: 1500,
        courseBill: {
          number: 'FACT-0001',
          payer: {
            name: 'Biens Communs',
            bic: 'ABCDFRPP',
            iban: 'FR8017569000309797129722R84',
            debitMandates: [
              {
                rum: 'R-123456789',
                signedAt: '2025-08-23T22:00:00.000Z',
                file: { publicId: '12355', link: 'unLien/12355' },
                createdAt: '2025-06-23T22:00:00.000Z',
              },
              {
                rum: 'R-123456786',
                signedAt: '2025-07-28T22:00:00.000Z',
                file: { publicId: '12355', link: 'unLien/12355' },
                createdAt: '2024-07-23T22:00:00.000Z',
              },
            ],
          },
        },
      },
    ];
    const vendorCompany = {
      name: 'VendorCompany',
      billingRepresentative: {
        _id: new ObjectId(),
        identity: { firstname: 'toto', lastname: 'zero' },
        contact: {},
        local: { email: 'toto@zero.io' },
      },
      iban: 'FR2817569000407686668287H77',
      bic: 'ERTYFRPP',
      address: { fullAddress: '12 rue des halles 75008 Paris' },
      ics: 'FR12345678909',
      debitMandateTemplate: { link: 'link/123567890', driveId: '123567890' },
    };

    coursePaymentFind.returns(SinonMongoose.stubChainedQueries(payments, ['populate', 'setOptions', 'lean']));
    vendorCompanyFindOne.returns(SinonMongoose.stubChainedQueries(vendorCompany, ['lean']));
    getFixedNumber.onCall(0).returns(2500.00);
    randomize.returns('472918364029184756302');
    generateSEPAHeader.returns({
      MsgId: 'MSG00000472918364029184756302G',
      CreDtTm: '2025-09-29T13:45:25.437Z',
      NbOfTxs: 2,
      CtrlSum: 2500.00,
      InitgPty: {
        Nm: 'VendorCompany',
        Id: { OrgId: { Othr: { Id: 'FR12345678909' } } },
      },
    });
    generatePaymentInfo.returns({
      PmtInfId: 'MSG00000472918364029184756302G',
      PmtMtd: 'DD',
      NbOfTxs: 2,
      CtrlSum: getFixedNumber(, 2),
      PmtTpInf: {
        SvcLvl: { Cd: 'SEPA' },
        LclInstrm: { Cd: 'CORE' },
        SeqTp: data.sequenceType,
      },
      ReqdColltnDt: data.collectionDate,
      Cdtr: { Nm: data.creditor.name },
      CdtrAcct: {
        Id: { IBAN: data.creditor.iban },
        Ccy: 'EUR',
      },
      CdtrAgt: { FinInstnId: { BIC: data.creditor.bic } },
      ChrgBr: 'SLEV',
      CdtrSchmeId: {
        Id: {
          PrvtId: {
            Othr: {
              Id: data.creditor.ics,
              SchmeNm: { Prtry: 'SEPA' },
            },
          },
        },
      },
      DrctDbtTxInf: [],
    });

    const result = XmlSEPAFileInfosHelper.generateSEPAFile(paymentIds, 'Compani - Septembre 2025');

    expect(result).toEqual({
      file: '',
      fileName: 'Prelevements_SEPA_Compani-Septembre2025.xml',
    });

    SinonMongoose.calledOnceWithExactly(
      coursePaymentFind,
      [
        { query: 'find', args: [{ _id: { $in: paymentIds } }] },
        {
          query: 'populate',
          args: [
            {
              path: 'courseBill',
              select: 'payer number',
              populate: { path: 'payer.company', select: 'bic iban name debitMandates' },
            },
          ],
        },
        { query: 'setOptions', args: [{ isVendorUser: true }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(vendorCompanyFindOne, [{ query: 'find', args: [{}] }, { query: 'lean' }]);
    sinon.assert.calledOnceWithExactly(randomize, '0', 21);
    sinon.assert.calledWithExactly(getFixedNumber.getCall(0), 2500);
    sinon.assert.calledOnceWithExactly(
      generateSEPAHeader,
      {
        sepaId: 'MSG00000472918364029184756302G',
        createdDate: '2025-09-29T13:45:25.437Z',
        transactionsCount: 2,
        totalSum: 2500.00,
        creditorName: 'VendorCompany',
        ics: 'FR12345678909',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generatePaymentInfo,
      {
        id: 'MSG00000472918364029184756302G',
        sequenceType: 'RCUR',
        method: 'DD',
        txNumber: 2,
        sum: 2500.00,
        collectionDate: '2025-09-29T13:45:25.437Z',
        creditor: {
          name: 'VendorCompany',
          iban: 'FR2817569000407686668287H77',
          bic: 'ERTYFRPP',
          ics: 'FR12345678909',
        },
      }
    );
    // sinon.assert.calledWithExactly(getFixedNumber.getCall(1), );
  });
});

describe('create', () => {
  let create;
  let paymentUpdateMany;
  let generateSEPAFile;
  beforeEach(() => {
    create = sinon.stub(XmlSEPAFileInfos, 'create');
    paymentUpdateMany = sinon.stub(CoursePayment, 'updateMany');
    generateSEPAFile = sinon.stub(XmlSEPAFileInfosHelper, 'generateSEPAFile');
  });
  afterEach(() => {
    create.restore();
    paymentUpdateMany.restore();
    generateSEPAFile.restore();
  });

  it('should create xmlSEPAFileInfos and update coursePayment status', async () => {
    const coursePaymentIds = [new ObjectId(), new ObjectId()];
    const payload = { payments: coursePaymentIds, name: 'Compani-Septembre2025' };
    generateSEPAFile.returns({
      file: '/tmp/Compani-Septembre2025',
      name: 'Prelevements_SEPA_Compani-Septembre2025.xml',
    });

    const result = await XmlSEPAFileInfosHelper.create(payload);

    expect(result).toEqual({
      name: 'Prelevements_SEPA_Compani-Septembre2025.xml',
      file: '/tmp/Compani-Septembre2025',
    });

    sinon.assert.calledOnceWithExactly(
      create,
      { coursePayments: coursePaymentIds, name: 'Compani-Septembre2025' }
    );
    sinon.assert.calledOnceWithExactly(
      paymentUpdateMany,
      { _id: { $in: coursePaymentIds } },
      { $set: { status: XML_GENERATED } }
    );
    sinon.assert.calledOnceWithExactly(
      generateSEPAFile,
      coursePaymentIds,
      'Compani-Septembre2025'
    );
  });
});
