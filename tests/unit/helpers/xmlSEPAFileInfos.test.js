const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const path = require('path');
const os = require('os');
const XmlSEPAFileInfosHelper = require('../../../src/helpers/xmlSEPAFileInfos');
const UtilsHelper = require('../../../src/helpers/utils');
const XmlHelper = require('../../../src/helpers/xml');
const { XML_GENERATED } = require('../../../src/helpers/constants');
const XmlSEPAFileInfos = require('../../../src/models/XmlSEPAFileInfos');
const CoursePayment = require('../../../src/models/CoursePayment');
const VendorCompany = require('../../../src/models/VendorCompany');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../../utilsMock');

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
  it('should return SEPA payment info object', () => {
    const data = {
      id: 'MSG123456R',
      sequenceType: 'RCUR',
      method: 'DD',
      txNumber: 3,
      sum: 350,
      collectionDate: '2025/09/30',
      creditor: {
        name: 'Test',
        iban: 'FR3514508000505917721779B12',
        bic: 'BNMDFRPP',
        ics: '1234567',
      },
    };
    const result = XmlSEPAFileInfosHelper.generatePaymentInfo(data);

    expect(result).toEqual({
      PmtInfId: data.id,
      PmtMtd: data.method,
      NbOfTxs: data.txNumber,
      CtrlSum: 350,
      PmtTpInf: {
        SvcLvl: {
          Cd: 'SEPA',
        },
        LclInstrm: {
          Cd: 'B2B',
        },
        SeqTp: data.sequenceType,
      },
      ReqdColltnDt: '2025/09/30',
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
  let createDocument;
  let coursePaymentFind;
  let formatTransactionNumber;
  let vendorCompanyFindOne;
  let generateSEPAHeader;
  let generatePaymentInfo;
  let getFixedNumber;
  let getLastVersion;
  let generateTransactionInfos;
  let generateXML;
  beforeEach(() => {
    createDocument = sinon.stub(XmlHelper, 'createDocument');
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
  });
  afterEach(() => {
    createDocument.restore();
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
  });

  it('should generate SEPA file', async () => {
    const paymentIds = [new ObjectId(), new ObjectId(), new ObjectId()];
    const payerIds = [new ObjectId(), new ObjectId()];
    const payments = [
      {
        _id: paymentIds[0],
        number: 'REG-00012',
        netInclTaxes: 500,
        courseBill: {
          number: 'FACT-0001',
          payer: {
            _id: payerIds[0],
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
            _id: payerIds[0],
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
          number: 'FACT-0002',
          payer: {
            _id: payerIds[1],
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
    const outputPath = path.join(os.tmpdir(), 'Compani - Septembre 2025');
    const xmlContent = {
      Document: {
        '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@xsi:schemaLocation': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd',
        CstmrDrctDbtInitn: {
          GrpHdr: {
            MsgId: 'MSG00000837495028164920173652G',
            CreDtTm: '2025-09-29T13:45:25.437Z',
            NbOfTxs: 2,
            CtrlSum: 2500,
            InitgPty: {
              Nm: 'VendorCompany',
              Id: { OrgId: { Othr: { Id: 'FR12345678909' } } },
            },
          },
          PmtInf: [
            {
              PmtInfId: 'MSG00000837495028164920173652G',
              PmtMtd: 'DD',
              NbOfTxs: 2,
              CtrlSum: 2500,
              PmtTpInf: {
                SvcLvl: { Cd: 'SEPA' },
                LclInstrm: { Cd: 'B2B' },
                SeqTp: 'RCUR',
              },
              ReqdColltnDt: '2025/09/30',
              Cdtr: { Nm: 'VendorCompany' },
              CdtrAcct: {
                Id: { IBAN: 'FR2817569000407686668287H77' },
                Ccy: 'EUR',
              },
              CdtrAgt: { FinInstnId: { BIC: 'ERTYFRPP' } },
              ChrgBr: 'SLEV',
              CdtrSchmeId: {
                Id: {
                  PrvtId: {
                    Othr: {
                      Id: 'FR12345678909',
                      SchmeNm: { Prtry: 'SEPA' },
                    },
                  },
                },
              },
              DrctDbtTxInf: [
                {
                  PmtId: {
                    EndToEndId: 'FACT-0001:REG-00012,REG-00013',
                  },
                  InstdAmt: {
                    '@Ccy': 'EUR',
                    '#text': 1000,
                  },
                  DrctDbtTx: {
                    MndtRltdInf: {
                      MndtId: 'R-1234567865',
                      DtOfSgntr: '2024/07/24',
                    },
                  },
                  DbtrAgt: { FinInstnId: { BIC: 'QWERFRPP' } },
                  Dbtr: { Nm: 'Alenvi' },
                  DbtrAcct: { Id: { IBAN: 'FR2217569000708935247791H65' } },
                  RmtInf: { Ustrd: 'Compani - Septembre 2025' },
                },
                {
                  PmtId: {
                    EndToEndId: 'FACT-0002:REG-00014',
                  },
                  InstdAmt: {
                    '@Ccy': 'EUR',
                    '#text': 1500,
                  },
                  DrctDbtTx: {
                    MndtRltdInf: {
                      MndtId: 'R-123456789',
                      DtOfSgntr: '2025/08/24',
                    },
                  },
                  DbtrAgt: { FinInstnId: { BIC: 'ABCDFRPP' } },
                  Dbtr: { Nm: 'Biens Communs' },
                  DbtrAcct: { Id: { IBAN: 'FR8017569000309797129722R84' } },
                  RmtInf: { Ustrd: 'Compani - Septembre 2025' },
                },
              ],
            },
          ],
        },
      },
    };

    createDocument.returns({
      Document: {
        '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@xsi:schemaLocation': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02 pain.008.001.02.xsd',
        CstmrDrctDbtInitn: {
          GrpHdr: {},
          PmtInf: [],
        },
      },
    });
    coursePaymentFind.returns(SinonMongoose.stubChainedQueries(payments, ['populate', 'setOptions', 'lean']));
    vendorCompanyFindOne.returns(SinonMongoose.stubChainedQueries(vendorCompany, ['lean']));
    getFixedNumber.onCall(0).returns(2500);
    generateSEPAHeader.returns({
      MsgId: 'MSG00000837495028164920173652G',
      CreDtTm: '2025-09-29T13:45:25.437Z',
      NbOfTxs: 2,
      CtrlSum: 2500,
      InitgPty: {
        Nm: 'VendorCompany',
        Id: { OrgId: { Othr: { Id: 'FR12345678909' } } },
      },
    });
    generatePaymentInfo.returns({
      PmtInfId: 'MSG00000837495028164920173652G',
      PmtMtd: 'DD',
      NbOfTxs: 2,
      CtrlSum: 2500,
      PmtTpInf: {
        SvcLvl: { Cd: 'SEPA' },
        LclInstrm: { Cd: 'B2B' },
        SeqTp: 'RCUR',
      },
      ReqdColltnDt: '2025/09/30',
      Cdtr: { Nm: 'VendorCompany' },
      CdtrAcct: {
        Id: { IBAN: 'FR2817569000407686668287H77' },
        Ccy: 'EUR',
      },
      CdtrAgt: { FinInstnId: { BIC: 'ERTYFRPP' } },
      ChrgBr: 'SLEV',
      CdtrSchmeId: {
        Id: {
          PrvtId: {
            Othr: {
              Id: 'FR12345678909',
              SchmeNm: { Prtry: 'SEPA' },
            },
          },
        },
      },
      DrctDbtTxInf: [],
    });
    getFixedNumber.onCall(1).returns(1000);
    getLastVersion.onCall(0).returns({
      rum: 'R-1234567865',
      signedAt: '2024-07-23T22:00:00.000Z',
      file: { publicId: '12355', link: 'unLien/12355' },
      createdAt: '2024-06-23T22:00:00.000Z',
    });
    formatTransactionNumber.onCall(0).returns('FACT-0001:REG-00012,REG-00013');
    generateTransactionInfos.onCall(0).returns({
      PmtId: {
        EndToEndId: 'FACT-0001:REG-00012,REG-00013',
      },
      InstdAmt: {
        '@Ccy': 'EUR',
        '#text': 1000,
      },
      DrctDbtTx: {
        MndtRltdInf: {
          MndtId: 'R-1234567865',
          DtOfSgntr: '2024/07/24',
        },
      },
      DbtrAgt: { FinInstnId: { BIC: 'QWERFRPP' } },
      Dbtr: { Nm: 'Alenvi' },
      DbtrAcct: { Id: { IBAN: 'FR2217569000708935247791H65' } },
      RmtInf: { Ustrd: 'Compani - Septembre 2025' },
    });
    getFixedNumber.onCall(2).returns(1500);
    getLastVersion.onCall(1).returns({
      rum: 'R-123456789',
      signedAt: '2025-08-23T22:00:00.000Z',
      file: { publicId: '12355', link: 'unLien/12355' },
      createdAt: '2025-06-23T22:00:00.000Z',
    });
    formatTransactionNumber.onCall(1).returns('FACT-0002:REG-00014');
    generateTransactionInfos.onCall(1).returns({
      PmtId: {
        EndToEndId: 'FACT-0002:REG-00014',
      },
      InstdAmt: {
        '@Ccy': 'EUR',
        '#text': 1500,
      },
      DrctDbtTx: {
        MndtRltdInf: {
          MndtId: 'R-123456789',
          DtOfSgntr: '2025/08/24',
        },
      },
      DbtrAgt: { FinInstnId: { BIC: 'ABCDFRPP' } },
      Dbtr: { Nm: 'Biens Communs' },
      DbtrAcct: { Id: { IBAN: 'FR8017569000309797129722R84' } },
      RmtInf: { Ustrd: 'Compani - Septembre 2025' },
    });
    generateXML.returns('SEPA.xml');

    const result = await XmlSEPAFileInfosHelper.generateSEPAFile(paymentIds, 'Compani - Septembre 2025');

    expect(result).toEqual('SEPA.xml');

    sinon.assert.calledOnceWithExactly(createDocument);
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
    SinonMongoose.calledOnceWithExactly(vendorCompanyFindOne, [{ query: 'findOne', args: [{}] }, { query: 'lean' }]);
    sinon.assert.calledWithExactly(getFixedNumber.getCall(0), 2500, 2);
    sinon.assert.calledWithExactly(
      generateSEPAHeader,
      {
        sepaId: sinon.match(/^MSG00000\d{21}[A-Z]$/),
        createdDate: '2025-09-29T13:45:25.437Z',
        transactionsCount: 2,
        totalSum: 2500,
        creditorName: 'VendorCompany',
        ics: 'FR12345678909',
      }
    );
    sinon.assert.calledOnceWithExactly(
      generatePaymentInfo,
      {
        id: sinon.match(/^MSG00000\d{21}[A-Z]$/),
        sequenceType: 'RCUR',
        method: 'DD',
        txNumber: 2,
        sum: 2500,
        collectionDate: '2025/09/30',
        creditor: {
          name: 'VendorCompany',
          iban: 'FR2817569000407686668287H77',
          bic: 'ERTYFRPP',
          ics: 'FR12345678909',
        },
      }
    );
    sinon.assert.calledWithExactly(getFixedNumber.getCall(1), 1000, 2);
    sinon.assert.calledWithExactly(
      getLastVersion.getCall(0),
      [{
        rum: 'R-1234567865',
        signedAt: '2024-07-23T22:00:00.000Z',
        file: { publicId: '12355', link: 'unLien/12355' },
        createdAt: '2024-06-23T22:00:00.000Z',
      }],
      'createdAt'
    );
    sinon.assert.calledWithExactly(formatTransactionNumber.getCall(0), [payments[0], payments[1]]);
    sinon.assert.calledWithExactly(
      generateTransactionInfos.getCall(0),
      {
        number: 'FACT-0001:REG-00012,REG-00013',
        amount: 1000,
        debitorName: 'Alenvi',
        debitorIBAN: 'FR2217569000708935247791H65',
        debitorBIC: 'QWERFRPP',
        debitorRUM: 'R-1234567865',
        mandateSignatureDate: '2024/07/24',
        globalTransactionName: 'Compani - Septembre 2025',
      }
    );
    sinon.assert.calledWithExactly(getFixedNumber.getCall(2), 1500, 2);
    sinon.assert.calledWithExactly(
      getLastVersion.getCall(1),
      [
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
      'createdAt'
    );
    sinon.assert.calledWithExactly(formatTransactionNumber.getCall(1), [payments[2]]);
    sinon.assert.calledWithExactly(
      generateTransactionInfos.getCall(1),
      {
        number: 'FACT-0002:REG-00014',
        amount: 1500,
        debitorName: 'Biens Communs',
        debitorIBAN: 'FR8017569000309797129722R84',
        debitorBIC: 'ABCDFRPP',
        debitorRUM: 'R-123456789',
        mandateSignatureDate: '2025/08/24',
        globalTransactionName: 'Compani - Septembre 2025',
      }
    );
    sinon.assert.calledOnceWithMatch(generateXML, xmlContent, outputPath);
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
