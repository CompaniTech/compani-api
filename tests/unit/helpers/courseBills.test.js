const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const has = require('lodash/has');
const get = require('lodash/get');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillHelper = require('../../../src/helpers/courseBills');
const VendorCompaniesHelper = require('../../../src/helpers/vendorCompanies');
const UtilsHelper = require('../../../src/helpers/utils');
const CourseBillPdf = require('../../../src/data/pdf/courseBilling/courseBill');
const SinonMongoose = require('../sinonMongoose');
const CourseBillsNumber = require('../../../src/models/CourseBillsNumber');
const {
  LIST,
  BALANCE,
  PAYMENT,
  REFUND,
  TRAINING_ORGANISATION_MANAGER,
  VENDOR_ADMIN,
} = require('../../../src/helpers/constants');

describe('getNetInclTaxes', () => {
  it('should return total price (without billing purchases)', async () => {
    const bill = {
      course: new ObjectId(),
      company: { name: 'Company' },
      mainFee: { price: 120, count: 2 },
      payer: { company: new ObjectId() },
    };

    const result = await CourseBillHelper.getNetInclTaxes(bill);
    expect(result).toEqual(240);
  });

  it('should return total price (with billing purchases)', async () => {
    const bill = {
      course: new ObjectId(),
      company: { name: 'Company' },
      payer: { company: new ObjectId() },
      mainFee: { price: 120, count: 2 },
      billingPurchaseList: [
        { billingItem: new ObjectId(), price: 90, count: 1 },
        { billingItem: new ObjectId(), price: 400, count: 1 },
      ],
    };

    const result = await CourseBillHelper.getNetInclTaxes(bill);
    expect(result).toEqual(730);
  });
});

describe('list', () => {
  let find;
  beforeEach(() => {
    find = sinon.stub(CourseBill, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return all course bills (without billing purchases)', async () => {
    const courseId = new ObjectId();
    const credentials = { role: { vendor: new ObjectId() } };
    const courseBills = [
      {
        course: courseId,
        company: { name: 'Company' },
        mainFee: { price: 120, count: 2 },
        payer: { name: 'Funder' },
      },
    ];
    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));

    const result = await CourseBillHelper.list({ course: courseId, action: LIST }, credentials);

    expect(result).toEqual([{
      course: courseId,
      company: { name: 'Company' },
      mainFee: { price: 120, count: 2 },
      payer: { name: 'Funder' },
      netInclTaxes: 240,
    }]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'courseCreditNote', options: { isVendorUser: true } }] },
        { query: 'setOptions', args: [{ isVendorUser: has(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return all course bills (with billing purchases)', async () => {
    const courseId = new ObjectId();

    const credentials = { role: { vendor: new ObjectId() } };
    const billingItemList = [{ _id: new ObjectId(), name: 'article 1' }, { _id: new ObjectId(), name: 'article 2' }];
    const courseBills = [
      {
        course: courseId,
        company: { name: 'Company' },
        mainFee: { price: 120, count: 2 },
        payer: { name: 'Funder' },
        billingPurchaseList: [
          { billingItem: billingItemList[0]._id, price: 90, count: 1 },
          { billingItem: billingItemList[1]._id, price: 400, count: 1 },
        ],
      },
    ];
    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));

    const result = await CourseBillHelper.list({ course: courseId, action: LIST }, credentials);

    expect(result).toEqual([{
      course: courseId,
      company: { name: 'Company' },
      mainFee: { price: 120, count: 2 },
      payer: { name: 'Funder' },
      billingPurchaseList: [
        { billingItem: billingItemList[0]._id, price: 90, count: 1 },
        { billingItem: billingItemList[1]._id, price: 400, count: 1 },
      ],
      netInclTaxes: 730,
    }]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ course: courseId }] },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'courseCreditNote', options: { isVendorUser: true } }] },
        { query: 'setOptions', args: [{ isVendorUser: has(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
  });

  it('should return all company bills (with credit note) (vendor role)', async () => {
    const companyId = new ObjectId();
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      misc: 'group 1',
      subProgram: { program: { name: 'program 1' } },
      slots: [{ startDate: '2021-11-11T08:00:00.000Z', endDate: '2021-11-11T14:00:00.000Z' }],
      slotsToPlan: [],
    };

    const credentials = { role: { vendor: { name: 'training_organisation_manager' } }, company: { _id: companyId } };
    const billingItemList = [{ _id: new ObjectId(), name: 'article 1' }, { _id: new ObjectId(), name: 'article 2' }];
    const courseBills = [
      {
        course,
        company: companyId,
        mainFee: { price: 120, count: 2 },
        payer: { company: companyId },
        billingPurchaseList: [
          { billingItem: billingItemList[0]._id, price: 90, count: 1 },
          { billingItem: billingItemList[1]._id, price: 400, count: 1 },
        ],
        coursePayments: [
          { nature: PAYMENT, netInclTaxes: 300 },
          { nature: PAYMENT, netInclTaxes: 100 },
          { nature: REFUND, netInclTaxes: 50 },
        ],
        courseCreditNote: { number: 'AV-00001' },
        billedAt: '2022-03-11T08:00:00.000Z',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));

    const result = await CourseBillHelper.list({ company: companyId, action: BALANCE }, credentials);

    expect(result).toEqual([{
      course: {
        _id: courseId,
        misc: 'group 1',
        subProgram: { program: { name: 'program 1' } },
      },
      company: companyId,
      mainFee: { price: 120, count: 2 },
      payer: { company: companyId },
      billingPurchaseList: [
        { billingItem: billingItemList[0]._id, price: 90, count: 1 },
        { billingItem: billingItemList[1]._id, price: 400, count: 1 },
      ],
      coursePayments: [
        { nature: PAYMENT, netInclTaxes: 300 },
        { nature: PAYMENT, netInclTaxes: 100 },
        { nature: REFUND, netInclTaxes: 50 },
      ],
      courseCreditNote: { number: 'AV-00001' },
      netInclTaxes: 730,
      billedAt: '2022-03-11T08:00:00.000Z',
      progress: 1,
      paid: 1080,
      total: 350,
    }]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            $or: [{ companies: companyId }, { 'payer.company': companyId }],
            billedAt: { $exists: true, $type: 'date' },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'misc slots slotsToPlan subProgram companies',
            populate: [
              { path: 'slots' },
              { path: 'slotsToPlan' },
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        {
          query: 'populate',
          args: [{
            path: 'courseCreditNote',
            options: {
              isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                .includes(get(credentials, 'role.vendor.name')),
              requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
            },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'coursePayments',
            options: {
              isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                .includes(get(credentials, 'role.vendor.name')),
              requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
            },
          }],
        },
        {
          query: 'setOptions',
          args: [{
            isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
            requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
          }],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should return all company bills (without credit note) (holding role)', async () => {
    const companyId = new ObjectId();
    const otherCompanyId = new ObjectId();
    const courseId = new ObjectId();
    const course = {
      _id: courseId,
      misc: 'group 1',
      subProgram: { program: { name: 'program 1' } },
      slots: [{ startDate: '2021-11-11T08:00:00.000Z', endDate: '2021-11-11T14:00:00.000Z' }],
      slotsToPlan: [],
    };

    const credentials = {
      role: {
        client: { name: 'client_admin' },
        holding: { name: 'holding_admin' },
      },
      company: { _id: companyId },
      holding: { companies: [companyId, otherCompanyId] },
    };
    const billingItemList = [{ _id: new ObjectId(), name: 'article 1' }, { _id: new ObjectId(), name: 'article 2' }];
    const courseBills = [
      {
        course,
        company: otherCompanyId,
        mainFee: { price: 120, count: 2 },
        payer: { company: companyId },
        billingPurchaseList: [
          { billingItem: billingItemList[0]._id, price: 90, count: 1 },
          { billingItem: billingItemList[1]._id, price: 400, count: 1 },
        ],
        coursePayments: [
          { nature: PAYMENT, netInclTaxes: 300 },
          { nature: PAYMENT, netInclTaxes: 100 },
          { nature: REFUND, netInclTaxes: 50 },
        ],
        courseCreditNote: null,
        billedAt: '2022-03-11T08:00:00.000Z',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));

    const result = await CourseBillHelper.list({ company: otherCompanyId, action: BALANCE }, credentials);

    expect(result).toEqual([{
      course: {
        _id: courseId,
        misc: 'group 1',
        subProgram: { program: { name: 'program 1' } },
      },
      company: otherCompanyId,
      mainFee: { price: 120, count: 2 },
      payer: { company: companyId },
      billingPurchaseList: [
        { billingItem: billingItemList[0]._id, price: 90, count: 1 },
        { billingItem: billingItemList[1]._id, price: 400, count: 1 },
      ],
      coursePayments: [
        { nature: PAYMENT, netInclTaxes: 300 },
        { nature: PAYMENT, netInclTaxes: 100 },
        { nature: REFUND, netInclTaxes: 50 },
      ],
      courseCreditNote: null,
      netInclTaxes: 730,
      billedAt: '2022-03-11T08:00:00.000Z',
      progress: 1,
      paid: 350,
      total: -380,
    }]);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{
            $or: [{ companies: otherCompanyId }, { 'payer.company': otherCompanyId }],
            billedAt: { $exists: true, $type: 'date' },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'misc slots slotsToPlan subProgram companies',
            populate: [
              { path: 'slots' },
              { path: 'slotsToPlan' },
              { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name' }] },
        {
          query: 'populate',
          args: [{
            path: 'courseCreditNote',
            options: {
              isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                .includes(get(credentials, 'role.vendor.name')),
              requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
            },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'coursePayments',
            options: {
              isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                .includes(get(credentials, 'role.vendor.name')),
              requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
            },
          }],
        },
        {
          query: 'setOptions',
          args: [{
            isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN].includes(get(credentials, 'role.vendor.name')),
            requestingOwnInfos: UtilsHelper.hasUserAccessToCompany(credentials, companyId),
          }],
        },
        { query: 'lean' },
      ]
    );
  });
});

describe('create', () => {
  let create;
  let findOneCourse;
  let addBillingPurchase;
  const TRAINER_FEES_BILLING_ITEM = new ObjectId();

  beforeEach(() => {
    create = sinon.stub(CourseBill, 'create');
    findOneCourse = sinon.stub(Course, 'findOne');
    addBillingPurchase = sinon.stub(CourseBillHelper, 'addBillingPurchase');
    process.env.TRAINER_FEES_BILLING_ITEM = TRAINER_FEES_BILLING_ITEM;
  });

  afterEach(() => {
    create.restore();
    findOneCourse.restore();
    addBillingPurchase.restore();
    process.env.TRAINER_FEES_BILLING_ITEM = '';
  });

  it('should create a course bill (without percentage)', async () => {
    const payload = {
      course: new ObjectId(),
      companies: [new ObjectId(), new ObjectId()],
      mainFee: { price: 120, count: 1 },
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2022-03-08T00:00:00.000Z',
    };
    await CourseBillHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, payload);
    sinon.assert.notCalled(findOneCourse);
    sinon.assert.notCalled(addBillingPurchase);
  });

  it('should create a course bill (with percentage)', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      prices: [{ company: companyId, global: 1200 }],
    };
    const payload = {
      course: courseId,
      companies: [companyId, new ObjectId()],
      mainFee: { price: 120, count: 1, percentage: 10 },
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2022-03-08T00:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    await CourseBillHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, payload);
    sinon.assert.notCalled(addBillingPurchase);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: payload.course }, { prices: 1 }] },
        { query: 'lean', args: [] },
      ]
    );
  });

  it('should create a course bill (with percentage and trainer fees)', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const course = {
      _id: courseId,
      prices: [{ company: companyId, global: 1200, trainerFees: 120 }],
    };
    const courseBill = { _id: new ObjectId() };
    const payload = {
      course: courseId,
      companies: [companyId, new ObjectId()],
      mainFee: { price: 120, count: 1, percentage: 10 },
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2022-03-08T00:00:00.000Z',
    };

    create.returns(courseBill);
    findOneCourse.returns(SinonMongoose.stubChainedQueries(course, ['lean']));
    await CourseBillHelper.create(payload);

    sinon.assert.calledOnceWithExactly(create, payload);
    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: payload.course }, { prices: 1 }] },
        { query: 'lean', args: [] },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      addBillingPurchase,
      courseBill._id,
      { price: 12, count: 1, percentage: 10, billingItem: TRAINER_FEES_BILLING_ITEM }
    );
  });
});

describe('updateCourseBill', () => {
  let findOneAndUpdate;
  let findOneAndUpdateCourseBillsNumber;
  let updateBillingPurchase;
  const TRAINER_FEES_BILLING_ITEM = new ObjectId();

  beforeEach(() => {
    findOneAndUpdate = sinon.stub(CourseBill, 'findOneAndUpdate');
    findOneAndUpdateCourseBillsNumber = sinon.stub(CourseBillsNumber, 'findOneAndUpdate');
    updateBillingPurchase = sinon.stub(CourseBillHelper, 'updateBillingPurchase');
    process.env.TRAINER_FEES_BILLING_ITEM = TRAINER_FEES_BILLING_ITEM;
  });

  afterEach(() => {
    findOneAndUpdate.restore();
    findOneAndUpdateCourseBillsNumber.restore();
    updateBillingPurchase.restore();
    process.env.TRAINER_FEES_BILLING_ITEM = '';
  });

  it('should update a course bill funder with funding organisation', async () => {
    const courseBillId = new ObjectId();
    const fundingOrganisationId = new ObjectId();
    const payload = { payer: { fundingOrganisation: fundingOrganisationId } };
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(
      findOneAndUpdate,
      { _id: courseBillId },
      { $set: { 'payer.fundingOrganisation': fundingOrganisationId }, $unset: { 'payer.company': '' } }
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill funder with company', async () => {
    const courseBillId = new ObjectId();
    const companyId = new ObjectId();
    const payload = { payer: { company: companyId } };
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(
      findOneAndUpdate,
      { _id: courseBillId },
      { $set: { 'payer.company': companyId }, $unset: { 'payer.fundingOrganisation': '' } }
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill mainFee (without percentage)', async () => {
    const courseBillId = new ObjectId();
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, description: 'skududu skududu' };
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { _id: courseBillId }, { $set: payload });
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill mainFee (with trainer fees without percentage)', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();
    const courseBill = {
      _id: courseBillId,
      mainFee: { price: 100, count: 1, percentage: 10 },
      billingPurchaseList: [
        { _id: billingPurchaseId, billingItem: TRAINER_FEES_BILLING_ITEM, price: 10, count: 1 },
      ],
    };
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, 'mainFee.percentage': 20 };

    findOneAndUpdate.returns(courseBill);
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { _id: courseBillId }, { $set: payload });
    sinon.assert.notCalled(updateBillingPurchase);
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
  });

  it('should update a course bill mainFee (with trainer fees with percentage)', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();
    const courseBill = {
      _id: courseBillId,
      mainFee: { price: 100, count: 1, percentage: 10 },
      billingPurchaseList: [
        { _id: billingPurchaseId, billingItem: TRAINER_FEES_BILLING_ITEM, price: 10, count: 1, percentage: 10 },
      ],
    };
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, 'mainFee.percentage': 20 };

    findOneAndUpdate.returns(courseBill);
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(findOneAndUpdate, { _id: courseBillId }, { $set: payload });
    sinon.assert.calledOnceWithExactly(
      updateBillingPurchase,
      courseBillId,
      billingPurchaseId,
      { count: 1, price: 20, percentage: 20 }
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
  });

  it('should remove a course bill mainFee description', async () => {
    const courseBillId = new ObjectId();
    const payload = { mainFee: { price: 200, count: 1, description: '' } };
    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(
      findOneAndUpdate,
      { _id: courseBillId },
      { $set: { 'mainFee.price': 200, 'mainFee.count': 1 }, $unset: { 'mainFee.description': '' } }
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should invoice bill', async () => {
    const courseBillId = new ObjectId();
    const payload = { billedAt: '2022-03-08T00:00:00.000Z' };
    const lastBillNumber = { seq: 1 };

    findOneAndUpdateCourseBillsNumber.returns(SinonMongoose.stubChainedQueries(lastBillNumber, ['lean']));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdateCourseBillsNumber,
      [
        {
          query: 'findOneAndUpdate',
          args: [{}, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }],
        },
        { query: 'lean' },
      ]);

    sinon.assert.calledOnceWithExactly(
      findOneAndUpdate,
      { _id: courseBillId },
      {
        $set: { billedAt: payload.billedAt, number: `FACT-${lastBillNumber.seq.toString().padStart(5, '0')}` },
        $unset: { maturityDate: '' },
      }
    );
    sinon.assert.notCalled(updateBillingPurchase);
  });
});

describe('addBillingPurchase', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(CourseBill, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should add a course bill item to course bill', async () => {
    const courseBillId = new ObjectId();

    const payload = {
      billingItem: new ObjectId(),
      price: 120,
      count: 1,
      description: 'billing item for test',
    };
    await CourseBillHelper.addBillingPurchase(courseBillId, payload);

    sinon.assert.calledOnceWithExactly(updateOne, { _id: courseBillId }, { $push: { billingPurchaseList: payload } });
  });
});

describe('updateBillingPurchase', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(CourseBill, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should update purchase with description', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();

    const payload = { price: 120, count: 1, description: 'billing item for test' };
    await CourseBillHelper.updateBillingPurchase(courseBillId, billingPurchaseId, payload);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId },
      {
        $set: {
          'billingPurchaseList.$.price': 120,
          'billingPurchaseList.$.count': 1,
          'billingPurchaseList.$.description': 'billing item for test',
        },
      }
    );
  });

  it('should update purchase and remove description', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();

    const payload = { price: 30, count: 2, description: '' };
    await CourseBillHelper.updateBillingPurchase(courseBillId, billingPurchaseId, payload);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId },
      {
        $set: { 'billingPurchaseList.$.price': 30, 'billingPurchaseList.$.count': 2 },
        $unset: { 'billingPurchaseList.$.description': '' },
      }
    );
  });

  it('should update purchase with percentage', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();

    const payload = { price: 120, count: 1, percentage: 10 };
    await CourseBillHelper.updateBillingPurchase(courseBillId, billingPurchaseId, payload);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: courseBillId, 'billingPurchaseList._id': billingPurchaseId },
      {
        $set: {
          'billingPurchaseList.$.price': 120,
          'billingPurchaseList.$.count': 1,
          'billingPurchaseList.$.percentage': 10,
        },
      }
    );
  });
});

describe('deleteBillingPurchase', () => {
  let updateOne;

  beforeEach(() => {
    updateOne = sinon.stub(CourseBill, 'updateOne');
  });

  afterEach(() => {
    updateOne.restore();
  });

  it('should delete purchase in course bill', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();

    await CourseBillHelper.deleteBillingPurchase(courseBillId, billingPurchaseId);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: courseBillId },
      { $pull: { billingPurchaseList: { _id: billingPurchaseId } } }
    );
  });
});

describe('generateBillPdf', () => {
  let findOne;
  let getPdf;
  let getVendorCompany;

  beforeEach(() => {
    findOne = sinon.stub(CourseBill, 'findOne');
    getPdf = sinon.stub(CourseBillPdf, 'getPdf');
    getVendorCompany = sinon.stub(VendorCompaniesHelper, 'get');
  });

  afterEach(() => {
    findOne.restore();
    getPdf.restore();
    getVendorCompany.restore();
  });

  it('should download course bill', async () => {
    const companyId = new ObjectId();
    const credentials = { company: { _id: companyId }, role: { client: new ObjectId() } };
    const billId = new ObjectId();

    const vendorCompany = {
      name: 'Auchan',
      address: {
        fullAddress: '32 Rue du Loup 33000 Bordeaux',
        street: '32 Rue du Loup',
        city: 'Bordeaux',
        zipCode: '33000',
        location: { type: 'Point', coordinates: [-0.573054, 44.837914] },
      },
      siret: '27272727274124',
    };

    const bill = {
      _id: new ObjectId(),
      course: {
        _id: new ObjectId(),
        subProgram: { _id: new ObjectId(), program: { _id: new ObjectId(), name: 'Test' } },
      },
      mainFee: { price: 1000, count: 1 },
      billingPurchaseList: [
        { billingItem: { _id: new ObjectId(), name: 'article 1' }, price: 10, count: 10 },
        { billingItem: { _id: new ObjectId(), name: 'article 2' }, price: 20, count: 10 },
      ],
      number: 'FACT-00001',
      billedAt: '2022-03-08T00:00:00.000Z',
      companies: [{
        _id: companyId,
        name: 'test',
        address: {
          fullAddress: '24 Avenue Daumesnil 75012 Paris',
          street: '24 Avenue Daumesnil',
          city: 'Paris',
          zipCode: '75012',
          location: { type: 'Point', coordinates: [2.37345, 48.848024] },
        },
      }],
      payer: {
        name: 'test',
        address: {
          fullAddress: '24 Avenue Daumesnil 75012 Paris',
          street: '24 Avenue Daumesnil',
          city: 'Paris',
          zipCode: '75012',
          location: { type: 'Point', coordinates: [2.37345, 48.848024] },
        },
      },
      isPayerCompany: true,
      coursePayments: [{ netInclTaxes: 1200 }],
      courseCreditNote: { number: 'AV-00001' },
    };

    getVendorCompany.returns(vendorCompany);
    findOne.returns(SinonMongoose.stubChainedQueries(bill));
    getPdf.returns({ pdf: 'pdf' });

    const result = await CourseBillHelper.generateBillPdf(billId, [companyId], credentials);
    expect(result).toEqual({ billNumber: bill.number, pdf: { pdf: 'pdf' } });
    sinon.assert.calledOnceWithExactly(
      getPdf,
      {
        number: 'FACT-00001',
        date: '08/03/2022',
        vendorCompany,
        companies: bill.companies,
        payer: { name: 'test', address: '24 Avenue Daumesnil 75012 Paris' },
        isPayerCompany: true,
        course: bill.course,
        mainFee: bill.mainFee,
        billingPurchaseList: bill.billingPurchaseList,
        coursePayments: [{ netInclTaxes: 1200 }],
        courseCreditNote: { number: 'AV-00001' },
      }
    );
    SinonMongoose.calledOnceWithExactly(findOne,
      [
        {
          query: 'findOne',
          args: [
            { _id: billId },
            { number: 1, companies: 1, course: 1, mainFee: 1, billingPurchaseList: 1, billedAt: 1 },
          ],
        },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'subProgram',
            populate: { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'billingPurchaseList', select: 'billingItem', populate: { path: 'billingItem', select: 'name' },
          }],
        },
        { query: 'populate', args: [{ path: 'companies', select: 'name address' }] },
        { query: 'populate', args: [{ path: 'payer.fundingOrganisation', select: 'name address' }] },
        { query: 'populate', args: [{ path: 'payer.company', select: 'name address' }] },
        {
          query: 'populate',
          args: [
            {
              path: 'coursePayments',
              select: 'nature netInclTaxes date',
              options: { sort: { date: -1 }, isVendorUser: false, requestingOwnInfos: true },
            },
          ],
        },
        {
          query: 'populate',
          args: [{ path: 'courseCreditNote', options: { isVendorUser: false, requestingOwnInfos: true } }],
        },
        { query: 'lean' },
      ]);
  });
});

describe('deleteBill', () => {
  let deleteOne;

  beforeEach(() => {
    deleteOne = sinon.stub(CourseBill, 'deleteOne');
  });

  afterEach(() => {
    deleteOne.restore();
  });

  it('should delete course bill', async () => {
    const courseBillId = new ObjectId();

    await CourseBillHelper.deleteBill(courseBillId);

    sinon.assert.calledOnceWithExactly(deleteOne, { _id: courseBillId });
  });
});
