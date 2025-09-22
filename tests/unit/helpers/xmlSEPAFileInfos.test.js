const { ObjectId } = require('mongodb');
const sinon = require('sinon');
const { expect } = require('expect');
const XmlSEPAFileInfosHelper = require('../../../src/helpers/xmlSEPAFileInfos');
const { XML_GENERATED } = require('../../../src/helpers/constants');
const XmlSEPAFileInfos = require('../../../src/models/XmlSEPAFileInfos');
const CoursePayment = require('../../../src/models/CoursePayment');

describe('downloadXmlSEPAFile', () => {
  let create;
  let paymentUpdateMany;
  beforeEach(() => {
    create = sinon.stub(XmlSEPAFileInfos, 'create');
    paymentUpdateMany = sinon.stub(CoursePayment, 'updateMany');
  });
  afterEach(() => {
    create.restore();
    paymentUpdateMany.restore();
  });

  it('should create xmlSEPAFileInfos and update coursePayment status', async () => {
    const coursePaymentIds = [new ObjectId(), new ObjectId()];
    const payload = { payments: coursePaymentIds, name: 'Compani - Septembre 2025' };

    const result = await XmlSEPAFileInfosHelper.downloadXmlSEPAFile(payload);

    expect(result).toEqual({ name: 'Prelevements_SEPA_Compani - Septembre 2025.xml' });

    sinon.assert.calledOnceWithExactly(
      create,
      { coursePayments: coursePaymentIds, name: 'Compani - Septembre 2025' }
    );
    sinon.assert.calledOnceWithExactly(
      paymentUpdateMany,
      { _id: { $in: coursePaymentIds } },
      { $set: { status: XML_GENERATED } }
    );
  });
});
