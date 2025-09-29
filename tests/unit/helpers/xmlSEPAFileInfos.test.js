const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const XmlSEPAFileInfosHelper = require('../../../src/helpers/xmlSEPAFileInfos');
const { XML_GENERATED } = require('../../../src/helpers/constants');
const XmlSEPAFileInfos = require('../../../src/models/XmlSEPAFileInfos');
const CoursePayment = require('../../../src/models/CoursePayment');

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
