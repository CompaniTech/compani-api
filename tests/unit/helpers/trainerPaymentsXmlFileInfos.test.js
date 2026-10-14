const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const path = require('path');
const os = require('os');
const TrainerPaymentsXmlFileInfosHelper = require('../../../src/helpers/trainerPaymentsXmlFileInfos');
const NumbersHelper = require('../../../src/helpers/numbers');
const XmlHelper = require('../../../src/helpers/xml');
const { XML_GENERATED, BANK_TRANSFER } = require('../../../src/helpers/constants');
const TrainerPaymentsXmlFileInfos = require('../../../src/models/TrainerPaymentsXmlFileInfos');
const TrainerPayment = require('../../../src/models/TrainerPayment');
const VendorCompany = require('../../../src/models/VendorCompany');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../../utilsMock');

describe('generateSEPAHeader', () => {
  it('should return a sepa header object', () => {
    const data = {
      sepaId: 'MSG00000123456018054830052445G',
      createdDate: '2025-06-24T22:00:00',
      transactionsCount: 2,
      totalSum: 350,
      debtorName: 'VendorCompany',
    };
    const result = TrainerPaymentsXmlFileInfosHelper.generateSEPAHeader(data);

    expect(result).toEqual({
      MsgId: 'MSG00000123456018054830052445G',
      CreDtTm: '2025-06-24T22:00:00',
      NbOfTxs: 2,
      CtrlSum: 350,
      InitgPty: { Nm: 'VendorCompany' },
    });
  });
});

describe('generatePaymentInfo', () => {
  it('should return SEPA credit transfer payment info object', () => {
    const data = {
      _id: 'MSG123456R',
      txNumber: 2,
      sum: 350,
      executionDate: '2025-09-29',
      debtor: {
        name: 'VendorCompany',
        iban: 'FR2817569000407686668287H77',
        bic: 'ERTYFRPP',
      },
    };
    const result = TrainerPaymentsXmlFileInfosHelper.generatePaymentInfo(data);

    expect(result).toEqual({
      PmtInfId: data._id,
      PmtMtd: 'TRF',
      BtchBookg: true,
      NbOfTxs: 2,
      CtrlSum: 350,
      PmtTpInf: {
        SvcLvl: { Cd: 'SEPA' },
        CtgyPurp: { Cd: 'SALA' },
      },
      ReqdExctnDt: '2025-09-29',
      Dbtr: { Nm: 'VendorCompany' },
      DbtrAcct: {
        Id: { IBAN: 'FR2817569000407686668287H77' },
        Ccy: 'EUR',
      },
      DbtrAgt: { FinInstnId: { BIC: 'ERTYFRPP' } },
      ChrgBr: 'SLEV',
      CdtTrfTxInf: [],
    });
  });
});

describe('generateTransactionInfos', () => {
  it('should return SEPA credit transfer transaction info object', () => {
    const _id = new ObjectId().toHexString();
    const data = {
      _id,
      number: 'FACT-0001',
      amount: 150,
      creditorName: 'Jean DUPONT ',
      creditorIBAN: 'FR2217569000708935247791H65',
      creditorBIC: 'QWERFRPP',
      trainerBillNumber: 'FACT-0001',
    };

    const result = TrainerPaymentsXmlFileInfosHelper.generateTransactionInfos(data);

    expect(result).toEqual({
      PmtId: {
        InstrId: _id,
        EndToEndId: 'FACT-0001',
      },
      Amt: {
        InstdAmt: {
          '@Ccy': 'EUR',
          '#text': 150,
        },
      },
      CdtrAgt: { FinInstnId: { BIC: 'QWERFRPP' } },
      Cdtr: { Nm: 'Jean DUPONT' },
      CdtrAcct: { Id: { IBAN: 'FR2217569000708935247791H65' } },
      RmtInf: { Ustrd: 'FACT-0001' },
    });
  });
});

describe('generateBankTransferFile', () => {
  let createDocument;
  let trainerPaymentFind;
  let vendorCompanyFindOne;
  let toFixedToFloat;
  let generateXML;

  beforeEach(() => {
    createDocument = sinon.stub(XmlHelper, 'createDocument');
    trainerPaymentFind = sinon.stub(TrainerPayment, 'find');
    vendorCompanyFindOne = sinon.stub(VendorCompany, 'findOne');
    toFixedToFloat = sinon.stub(NumbersHelper, 'toFixedToFloat');
    generateXML = sinon.stub(XmlHelper, 'generateXML');
    UtilsMock.mockCurrentDate('2025-09-29T13:45:25.437Z');
  });

  afterEach(() => {
    createDocument.restore();
    trainerPaymentFind.restore();
    vendorCompanyFindOne.restore();
    toFixedToFloat.restore();
    generateXML.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should generate the credit transfer file', async () => {
    const paymentIds = [new ObjectId(), new ObjectId()];
    const payments = [
      {
        _id: paymentIds[0],
        amount: 150,
        trainerBill: {
          number: 'FACT-0001',
          trainer: {
            identity: { firstname: 'Jean', lastname: 'Dupont' },
            bic: 'QWERFRPP',
            iban: 'FR2217569000708935247791H65',
          },
        },
      },
      {
        _id: paymentIds[1],
        amount: 200,
        trainerBill: {
          number: 'FACT-0002',
          trainer: {
            identity: { firstname: 'Marie', lastname: 'Durand' },
            bic: 'ABCDFRPP',
            iban: 'FR8017569000309797129722R84',
          },
        },
      },
    ];
    const vendorCompany = { name: 'VendorCompany', iban: 'FR2817569000407686668287H77', bic: 'ERTYFRPP' };
    const outputPath = path.join(os.tmpdir(), 'Virement - Septembre 2025');
    const xmlContentMatch = {
      Document: {
        CstmrCdtTrfInitn: {
          GrpHdr: {
            MsgId: sinon.match.string,
            CreDtTm: '2025-09-29T15:45:25',
            NbOfTxs: 2,
            CtrlSum: 350,
            InitgPty: { Nm: 'VendorCompany' },
          },
          PmtInf: [
            {
              PmtInfId: sinon.match.string,
              PmtMtd: 'TRF',
              BtchBookg: true,
              NbOfTxs: 2,
              CtrlSum: 350,
              PmtTpInf: {
                SvcLvl: { Cd: 'SEPA' },
                CtgyPurp: { Cd: 'SALA' },
              },
              ReqdExctnDt: '2025-09-29',
              Dbtr: { Nm: 'VendorCompany' },
              DbtrAcct: {
                Id: { IBAN: 'FR2817569000407686668287H77' },
                Ccy: 'EUR',
              },
              DbtrAgt: { FinInstnId: { BIC: 'ERTYFRPP' } },
              ChrgBr: 'SLEV',
              CdtTrfTxInf: [
                {
                  PmtId: {
                    InstrId: sinon.match(/^[0-9a-fA-F]{24}$/),
                    EndToEndId: 'FACT-0001',
                  },
                  Amt: { InstdAmt: { '@Ccy': 'EUR', '#text': 150 } },
                  CdtrAgt: { FinInstnId: { BIC: 'QWERFRPP' } },
                  Cdtr: { Nm: 'Jean DUPONT' },
                  CdtrAcct: { Id: { IBAN: 'FR2217569000708935247791H65' } },
                  RmtInf: { Ustrd: 'FACT-0001' },
                },
                {
                  PmtId: {
                    InstrId: sinon.match(/^[0-9a-fA-F]{24}$/),
                    EndToEndId: 'FACT-0002',
                  },
                  Amt: { InstdAmt: { '@Ccy': 'EUR', '#text': 200 } },
                  CdtrAgt: { FinInstnId: { BIC: 'ABCDFRPP' } },
                  Cdtr: { Nm: 'Marie DURAND' },
                  CdtrAcct: { Id: { IBAN: 'FR8017569000309797129722R84' } },
                  RmtInf: { Ustrd: 'FACT-0002' },
                },
              ],
            },
          ],
        },
      },
    };

    createDocument.returns({
      Document: { CstmrCdtTrfInitn: { GrpHdr: {}, PmtInf: [] } },
    });
    trainerPaymentFind.returns(SinonMongoose.stubChainedQueries(payments, ['populate', 'lean']));
    vendorCompanyFindOne.returns(SinonMongoose.stubChainedQueries(vendorCompany, ['lean']));
    toFixedToFloat.onCall(0).returns(350);
    toFixedToFloat.onCall(1).returns(150);
    toFixedToFloat.onCall(2).returns(200);
    generateXML.returns('creditTransfer.xml');

    const result = await TrainerPaymentsXmlFileInfosHelper
      .generateBankTransferFile(paymentIds, 'Virement - Septembre 2025');

    expect(result).toEqual('creditTransfer.xml');

    sinon.assert.calledOnceWithExactly(createDocument, BANK_TRANSFER);
    SinonMongoose.calledOnceWithExactly(
      trainerPaymentFind,
      [
        { query: 'find', args: [{ _id: { $in: paymentIds } }] },
        {
          query: 'populate',
          args: [{
            path: 'trainerBill',
            select: 'number trainer',
            populate: { path: 'trainer', select: 'identity bic iban' },
          }],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(vendorCompanyFindOne, [{ query: 'findOne', args: [] }, { query: 'lean' }]);
    sinon.assert.calledWithExactly(toFixedToFloat.getCall(0), 350, 2);
    sinon.assert.calledWithExactly(toFixedToFloat.getCall(1), 150, 2);
    sinon.assert.calledWithExactly(toFixedToFloat.getCall(2), 200, 2);
    sinon.assert.calledOnceWithMatch(generateXML, xmlContentMatch, outputPath);
  });
});

describe('create', () => {
  let create;
  let paymentUpdateMany;
  let generateBankTransferFile;

  beforeEach(() => {
    create = sinon.stub(TrainerPaymentsXmlFileInfos, 'create');
    paymentUpdateMany = sinon.stub(TrainerPayment, 'updateMany');
    generateBankTransferFile = sinon.stub(TrainerPaymentsXmlFileInfosHelper, 'generateBankTransferFile');
  });

  afterEach(() => {
    create.restore();
    paymentUpdateMany.restore();
    generateBankTransferFile.restore();
  });

  it('should create trainerPaymentsXmlFileInfos and update trainerPayment status', async () => {
    const trainerPaymentIds = [new ObjectId(), new ObjectId()];
    const payload = { payments: trainerPaymentIds, name: 'Virement - Septembre 2025' };
    generateBankTransferFile.returns('/tmp/Virement - Septembre 2025.xml');

    const result = await TrainerPaymentsXmlFileInfosHelper.create(payload);

    expect(result).toEqual('/tmp/Virement - Septembre 2025.xml');

    sinon.assert.calledOnceWithExactly(generateBankTransferFile, trainerPaymentIds, 'Virement - Septembre 2025');
    sinon.assert.calledOnceWithExactly(
      create,
      { trainerPayments: trainerPaymentIds, name: 'Virement - Septembre 2025' }
    );
    sinon.assert.calledOnceWithExactly(
      paymentUpdateMany,
      { _id: { $in: trainerPaymentIds } },
      { $set: { status: XML_GENERATED } }
    );
  });
});
