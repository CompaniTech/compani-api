const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const has = require('lodash/has');
const get = require('lodash/get');
const Course = require('../../../src/models/Course');
const CourseBill = require('../../../src/models/CourseBill');
const CourseBillHelper = require('../../../src/helpers/courseBills');
const CourseHistoriesHelper = require('../../../src/helpers/courseHistories');
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
  DASHBOARD,
  INTRA,
  COURSE,
  TRAINEE,
  SINGLE,
  GROUP,
  INTER_B2B,
  RECEIVED,
  XML_GENERATED,
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
  let getCompanyAtCourseRegistrationList;
  beforeEach(() => {
    find = sinon.stub(CourseBill, 'find');
    getCompanyAtCourseRegistrationList = sinon.stub(CourseHistoriesHelper, 'getCompanyAtCourseRegistrationList');
  });
  afterEach(() => {
    find.restore();
    getCompanyAtCourseRegistrationList.restore();
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
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
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
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
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
          { nature: PAYMENT, netInclTaxes: 300, status: XML_GENERATED, XmlSEPAFileInfos: { name: 'test' } },
          { nature: PAYMENT, netInclTaxes: 100, status: RECEIVED },
          { nature: REFUND, netInclTaxes: 50, status: RECEIVED },
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
        { nature: PAYMENT, netInclTaxes: 300, status: XML_GENERATED, XmlSEPAFileInfos: { name: 'test' } },
        { nature: PAYMENT, netInclTaxes: 100, status: RECEIVED },
        { nature: REFUND, netInclTaxes: 50, status: RECEIVED },
      ],
      courseCreditNote: { number: 'AV-00001' },
      netInclTaxes: 730,
      billedAt: '2022-03-11T08:00:00.000Z',
      progress: 1,
      paid: 780,
      total: 50,
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
            populate: {
              path: 'xmlSEPAFileInfos',
              select: 'name',
              options: {
                isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                  .includes(get(credentials, 'role.vendor.name')),
              },
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
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
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
          { nature: PAYMENT, netInclTaxes: 300, status: RECEIVED },
          { nature: PAYMENT, netInclTaxes: 100, status: RECEIVED },
          { nature: REFUND, netInclTaxes: 50, status: RECEIVED },
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
        { nature: PAYMENT, netInclTaxes: 300, status: RECEIVED },
        { nature: PAYMENT, netInclTaxes: 100, status: RECEIVED },
        { nature: REFUND, netInclTaxes: 50, status: RECEIVED },
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
            populate: {
              path: 'xmlSEPAFileInfos',
              select: 'name',
              options: {
                isVendorUser: [TRAINING_ORGANISATION_MANAGER, VENDOR_ADMIN]
                  .includes(get(credentials, 'role.vendor.name')),
              },
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
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });

  it('should return all draft course bills between two dates', async () => {
    const courseIds = [new ObjectId(), new ObjectId()];
    const traineesIds = [new ObjectId(), new ObjectId()];
    const companies = [{ _id: new ObjectId(), name: 'Company 1' }, { _id: new ObjectId(), name: 'Company 2' }];
    const credentials = { role: { vendor: new ObjectId() } };
    const courseBills = [
      {
        course: {
          _id: courseIds[0],
          companies,
          type: INTRA,
          expectedBillscount: 2,
          subProgram: { program: { name: 'program' } },
          trainees: traineesIds,
          prices: [{ company: companies[0]._id, global: 200 }],
        },
        companies: [companies[0]],
        mainFee: { price: 120, count: 2 },
        payer: { name: 'Funder' },
        maturityDate: '2025-06-10T22:00:00.000Z',
      },
      {
        course: {
          _id: courseIds[1],
          companies,
          type: SINGLE,
          expectedBillscount: 4,
          subProgram: { program: { name: 'program 2' } },
          trainees: traineesIds,
          prices: [{ company: companies[0]._id, global: 400 }],
          interruptedAt: '2025-01-01T00:00:00.000Z',
        },
        companies: [companies[1]],
        mainFee: { price: 320, count: 2 },
        payer: { name: 'Funder' },
        maturityDate: '2025-06-13T14:00:00.000Z',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companies[0]._id },
      { trainee: traineesIds[1], company: companies[1]._id },
    ]);

    const result = await CourseBillHelper.list(
      {
        action: DASHBOARD,
        startDate: '2025-05-10T22:00:00.000Z',
        endDate: '2025-07-10T22:00:00.000Z',
      },
      credentials
    );

    expect(result).toEqual([{
      companies: [companies[0]],
      mainFee: { price: 120, count: 2 },
      payer: { name: 'Funder' },
      maturityDate: '2025-06-10T22:00:00.000Z',
      course: {
        _id: courseIds[0],
        companies,
        type: INTRA,
        expectedBillscount: 2,
        subProgram: { program: { name: 'program' } },
        trainees: [
          { _id: traineesIds[0], registrationCompany: companies[0]._id },
          { _id: traineesIds[1], registrationCompany: companies[1]._id },
        ],
        prices: [{ company: companies[0]._id, global: 200 }, { company: companies[1]._id, global: '' }],
      },
      netInclTaxes: 240,
    }]);

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{ maturityDate: { $gte: '2025-05-10T22:00:00.000Z', $lte: '2025-07-10T22:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies trainees subProgram type expectedBillsCount prices interruptedAt',
              populate: [
                { path: 'companies', select: 'name' },
                { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
                { path: 'slots', select: 'startDate endDate' },
                { path: 'slotsToPlan', select: '_id' },
              ],
            },
            {
              path: 'companies',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
            { path: 'payer.fundingOrganisation', select: 'name' },
            { path: 'payer.company', select: 'name' },
            { path: 'courseCreditNote', options: { isVendorUser: true } },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: has(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseIds[0] },
      { key: TRAINEE, value: courseBills[0].course.trainees }
    );
  });

  it('should return all validated course bills between two dates', async () => {
    const courseId = new ObjectId();
    const traineesIds = [new ObjectId(), new ObjectId()];
    const companies = [{ _id: new ObjectId(), name: 'Company 1' }, { _id: new ObjectId(), name: 'Company 2' }];
    const credentials = { role: { vendor: new ObjectId() } };
    const courseBills = [
      {
        course: {
          _id: courseId,
          companies,
          type: INTRA,
          expectedBillscount: 2,
          subProgram: { program: { name: 'program' } },
          trainees: traineesIds,
          prices: [{ company: companies[0]._id, global: 200, trainerFees: 20 }],
        },
        companies: [companies[0]],
        mainFee: { price: 120, count: 2 },
        payer: { name: 'Funder' },
        billedAt: '2025-06-10T22:00:00.000Z',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));
    getCompanyAtCourseRegistrationList.returns([
      { trainee: traineesIds[0], company: companies[0]._id },
      { trainee: traineesIds[1], company: companies[1]._id },
    ]);

    const result = await CourseBillHelper.list(
      {
        action: DASHBOARD,
        startDate: '2025-05-10T22:00:00.000Z',
        endDate: '2025-07-10T22:00:00.000Z',
        isValidated: true,
      },
      credentials
    );

    expect(result).toEqual([{
      companies: [companies[0]],
      mainFee: { price: 120, count: 2 },
      payer: { name: 'Funder' },
      billedAt: '2025-06-10T22:00:00.000Z',
      course: {
        _id: courseId,
        companies,
        type: INTRA,
        expectedBillscount: 2,
        subProgram: { program: { name: 'program' } },
        trainees: [
          { _id: traineesIds[0], registrationCompany: companies[0]._id },
          { _id: traineesIds[1], registrationCompany: companies[1]._id },
        ],
        prices: [
          { company: companies[0]._id, global: 200, trainerFees: 20 },
          { company: companies[1]._id, global: '' },
        ],
      },
      netInclTaxes: 240,
    }]);

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{ billedAt: { $gte: '2025-05-10T22:00:00.000Z', $lte: '2025-07-10T22:00:00.000Z' } }],
        },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies trainees subProgram type expectedBillsCount prices interruptedAt',
              populate: [
                { path: 'companies', select: 'name' },
                { path: 'subProgram', select: 'program', populate: [{ path: 'program', select: 'name' }] },
                { path: 'slots', select: 'startDate endDate' },
                { path: 'slotsToPlan', select: '_id' },
              ],
            },
            {
              path: 'companies',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
            { path: 'payer.fundingOrganisation', select: 'name' },
            { path: 'payer.company', select: 'name' },
            { path: 'courseCreditNote', options: { isVendorUser: true } },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: has(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      getCompanyAtCourseRegistrationList,
      { key: COURSE, value: courseId },
      { key: TRAINEE, value: courseBills[0].course.trainees }
    );
  });

  it('should return all validated course bills', async () => {
    const courseId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { role: { vendor: new ObjectId() } };
    const courseBills = [
      {
        course: courseId,
        companies: [companyId],
        mainFee: { price: 120, count: 2 },
        payer: { name: 'Funder' },
        billedAt: '2025-06-10T22:00:00.000Z',
      },
    ];

    find.returns(SinonMongoose.stubChainedQueries(courseBills, ['populate', 'setOptions', 'lean']));

    const result = await CourseBillHelper.list({ action: DASHBOARD, isValidated: true }, credentials);

    expect(result).toEqual([{
      companies: [companyId],
      mainFee: { price: 120, count: 2 },
      payer: { name: 'Funder' },
      billedAt: '2025-06-10T22:00:00.000Z',
      course: courseId,
      netInclTaxes: 240,
    }]);

    SinonMongoose.calledOnceWithExactly(
      find,
      [
        {
          query: 'find',
          args: [{ billedAt: { $exists: true } }],
        },
        {
          query: 'populate',
          args: [[
            { path: 'payer.fundingOrganisation', select: 'name' },
            { path: 'payer.company', select: 'name' },
            { path: 'courseCreditNote', options: { isVendorUser: true } },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: has(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(getCompanyAtCourseRegistrationList);
  });
});

describe('createBillList', () => {
  let findOneCourse;
  let createCourseBill;
  let insertManyCourseBills;
  let addBillingPurchase;
  const TRAINER_FEES_BILLING_ITEM = new ObjectId();

  beforeEach(() => {
    findOneCourse = sinon.stub(Course, 'findOne');
    createCourseBill = sinon.stub(CourseBill, 'create');
    insertManyCourseBills = sinon.stub(CourseBill, 'insertMany');
    addBillingPurchase = sinon.stub(CourseBillHelper, 'addBillingPurchase');
    process.env.TRAINER_FEES_BILLING_ITEM = TRAINER_FEES_BILLING_ITEM;
  });

  afterEach(() => {
    findOneCourse.restore();
    createCourseBill.restore();
    insertManyCourseBills.restore();
    addBillingPurchase.restore();
    process.env.TRAINER_FEES_BILLING_ITEM = '';
  });

  it('should create one bill without percentage for INTER course', async () => {
    const course = { type: INTER_B2B, prices: [] };
    const payload = {
      course: new ObjectId(),
      quantity: 1,
      mainFee: { price: 100, count: 1, countUnit: GROUP, description: 'test' },
      companies: [new ObjectId()],
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2025-04-29T22:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    await CourseBillHelper.createBillList(payload);

    sinon.assert.calledOnceWithExactly(
      createCourseBill,
      {
        course: payload.course,
        mainFee: {
          price: 100,
          count: 1,
          countUnit: GROUP,
          description: 'test',
        },
        companies: payload.companies,
        payer: payload.payer,
        maturityDate: payload.maturityDate,
      }
    );
    sinon.assert.notCalled(addBillingPurchase);
    sinon.assert.notCalled(insertManyCourseBills);
  });

  it('should create one bill with percentage for INTRA course with trainer fees', async () => {
    const companyId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      type: INTRA,
      prices: [{ company: companyId, global: 1000, trainerFees: 200 }],
    };
    const billCreated = { _id: new ObjectId() };
    const payload = {
      course: course._id,
      quantity: 1,
      mainFee: { price: 100, count: 1, countUnit: GROUP, percentage: 10 },
      companies: [companyId],
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2025-04-29T22:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    createCourseBill.returns(billCreated);

    await CourseBillHelper.createBillList(payload);

    sinon.assert.calledOnceWithExactly(
      createCourseBill,
      {
        course: payload.course,
        mainFee: {
          price: 100,
          count: 1,
          countUnit: GROUP,
          percentage: 10,
        },
        companies: payload.companies,
        payer: payload.payer,
        maturityDate: payload.maturityDate,
      }
    );
    sinon.assert.calledOnceWithExactly(
      addBillingPurchase,
      billCreated._id,
      {
        price: 20,
        count: 1,
        percentage: 10,
        billingItem: TRAINER_FEES_BILLING_ITEM,
      }
    );
    sinon.assert.notCalled(insertManyCourseBills);
  });

  it('should create one bill with percentage for INTRA course without trainer fees', async () => {
    const companyId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      type: INTRA,
      prices: [{ company: companyId, global: 1200 }],
    };
    const billCreated = { _id: new ObjectId() };
    const payload = {
      course: course._id,
      quantity: 1,
      companies: [companyId, new ObjectId()],
      mainFee: { price: 120, count: 1, countUnit: GROUP, percentage: 10 },
      payer: { fundingOrganisation: new ObjectId() },
      maturityDate: '2025-03-08T00:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    createCourseBill.returns(billCreated);

    await CourseBillHelper.createBillList(payload);

    sinon.assert.calledOnceWithExactly(
      createCourseBill,
      {
        course: payload.course,
        mainFee: {
          price: 120,
          count: 1,
          countUnit: GROUP,
          percentage: 10,
        },
        companies: payload.companies,
        payer: payload.payer,
        maturityDate: payload.maturityDate,
      }
    );
    sinon.assert.notCalled(addBillingPurchase);
    sinon.assert.notCalled(insertManyCourseBills);
  });

  it('should create several bills (without course price)', async () => {
    const course = { _id: new ObjectId(), type: INTER_B2B };
    const payload = {
      course: course._id,
      quantity: 3,
      mainFee: { count: 1, countUnit: GROUP, description: 'Test' },
      companies: [new ObjectId()],
      payer: { fundingOrganisation: new ObjectId() },
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    await CourseBillHelper.createBillList(payload);

    const expectedBill = {
      course: payload.course,
      mainFee: {
        count: 1,
        countUnit: GROUP,
        description: 'Test',
        price: 0,
      },
      companies: payload.companies,
      payer: payload.payer,
    };

    const expectedBills = new Array(3).fill(expectedBill);

    sinon.assert.calledOnceWithExactly(insertManyCourseBills, expectedBills);
    sinon.assert.notCalled(createCourseBill);
    sinon.assert.notCalled(addBillingPurchase);
  });

  it('should create several bills (with global price and trainer fees)', async () => {
    const companyId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      type: INTER_B2B,
      prices: [{ company: companyId, global: 2000, trainerFees: 200 }],
    };
    const payload = {
      course: course._id,
      quantity: 3,
      mainFee: { count: 1, countUnit: GROUP, description: 'Test' },
      companies: [companyId],
      payer: { fundingOrganisation: new ObjectId() },
    };

    const createdBills = [{ _id: new ObjectId() }, { _id: new ObjectId() }, { _id: new ObjectId() }];

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));
    insertManyCourseBills.returns(createdBills);

    await CourseBillHelper.createBillList(payload);

    const expectedBill = {
      course: payload.course,
      mainFee: {
        count: 1,
        countUnit: GROUP,
        description: 'Test',
        price: 0,
        percentage: 0,
      },
      companies: payload.companies,
      payer: payload.payer,
    };

    const expectedBills = new Array(3).fill(expectedBill);

    sinon.assert.calledOnceWithExactly(insertManyCourseBills, expectedBills);
    sinon.assert.calledWithExactly(
      addBillingPurchase.getCall(0),
      createdBills[0]._id,
      {
        price: 0,
        count: 1,
        percentage: 0,
        billingItem: TRAINER_FEES_BILLING_ITEM,
      }
    );
    sinon.assert.calledWithExactly(
      addBillingPurchase.getCall(1),
      createdBills[1]._id,
      {
        price: 0,
        count: 1,
        percentage: 0,
        billingItem: TRAINER_FEES_BILLING_ITEM,
      }
    );
    sinon.assert.calledWithExactly(
      addBillingPurchase.getCall(2),
      createdBills[2]._id,
      {
        price: 0,
        count: 1,
        percentage: 0,
        billingItem: TRAINER_FEES_BILLING_ITEM,
      }
    );
    sinon.assert.notCalled(createCourseBill);
  });

  it('should create several bills for SINGLE course', async () => {
    const companyId = new ObjectId();
    const payerId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      type: SINGLE,
      prices: [{ company: companyId, global: 1000, trainerFees: 200 }],
      trainees: [{ identity: { firstname: 'Sarah', lastname: 'Pel' } }],
      trainers: [{ identity: { firstname: 'toto', lastname: 'test' } }],
    };
    const payload = {
      course: course._id,
      quantity: 2,
      mainFee: { count: 1, countUnit: TRAINEE },
      companies: [companyId],
      payer: { fundingOrganisation: payerId },
      maturityDate: '2025-04-29T22:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    await CourseBillHelper.createBillList(payload);

    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: course._id }, { type: 1, prices: 1, trainees: 1, trainers: 1 }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      createCourseBill.getCall(0),
      {
        course: course._id,
        mainFee: {
          count: 1,
          countUnit: TRAINEE,
          description: 'Facture liée à des frais pédagogiques \r\n'
          + 'Contrat de professionnalisation \r\n'
          + 'ACCOMPAGNEMENT avril 2025 \r\n'
          + 'Nom de l\'apprenant·e: Sarah PEL \r\n'
          + 'Nom du / des intervenants: toto TEST',
        },
        companies: [companyId],
        payer: { fundingOrganisation: payerId },
        maturityDate: '2025-04-29T22:00:00.000Z',
      }
    );
    sinon.assert.calledWithExactly(
      createCourseBill.getCall(1),
      {
        course: course._id,
        mainFee: {
          count: 1,
          countUnit: TRAINEE,
          description: 'Facture liée à des frais pédagogiques \r\n'
          + 'Contrat de professionnalisation \r\n'
          + 'ACCOMPAGNEMENT mai 2025 \r\n'
          + 'Nom de l\'apprenant·e: Sarah PEL \r\n'
          + 'Nom du / des intervenants: toto TEST',
        },
        companies: [companyId],
        payer: { fundingOrganisation: payerId },
        maturityDate: '2025-05-29T22:00:00.000Z',
      }
    );
    sinon.assert.notCalled(addBillingPurchase);
    sinon.assert.notCalled(insertManyCourseBills);
  });

  it('should create several bills for SINGLE course without trainers', async () => {
    const companyId = new ObjectId();
    const payerId = new ObjectId();
    const course = {
      _id: new ObjectId(),
      type: SINGLE,
      prices: [{ company: companyId, global: 1000, trainerFees: 200 }],
      trainees: [{ identity: { firstname: 'Sarah', lastname: 'Pel' } }],
    };
    const payload = {
      course: course._id,
      quantity: 2,
      mainFee: { count: 1, countUnit: TRAINEE },
      companies: [companyId],
      payer: { fundingOrganisation: payerId },
      maturityDate: '2025-04-29T22:00:00.000Z',
    };

    findOneCourse.returns(SinonMongoose.stubChainedQueries(course));

    await CourseBillHelper.createBillList(payload);

    SinonMongoose.calledOnceWithExactly(
      findOneCourse,
      [
        { query: 'findOne', args: [{ _id: course._id }, { type: 1, prices: 1, trainees: 1, trainers: 1 }] },
        { query: 'populate', args: [{ path: 'trainees', select: 'identity' }] },
        { query: 'populate', args: [{ path: 'trainers', select: 'identity' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      createCourseBill.getCall(0),
      {
        course: course._id,
        mainFee: {
          count: 1,
          countUnit: TRAINEE,
          description: 'Facture liée à des frais pédagogiques \r\n'
          + 'Contrat de professionnalisation \r\n'
          + 'ACCOMPAGNEMENT avril 2025 \r\n'
          + 'Nom de l\'apprenant·e: Sarah PEL \r\n'
          + 'Nom du / des intervenants: ',
        },
        companies: [companyId],
        payer: { fundingOrganisation: payerId },
        maturityDate: '2025-04-29T22:00:00.000Z',
      }
    );
    sinon.assert.calledWithExactly(
      createCourseBill.getCall(1),
      {
        course: course._id,
        mainFee: {
          count: 1,
          countUnit: TRAINEE,
          description: 'Facture liée à des frais pédagogiques \r\n'
          + 'Contrat de professionnalisation \r\n'
          + 'ACCOMPAGNEMENT mai 2025 \r\n'
          + 'Nom de l\'apprenant·e: Sarah PEL \r\n'
          + 'Nom du / des intervenants: ',
        },
        companies: [companyId],
        payer: { fundingOrganisation: payerId },
        maturityDate: '2025-05-29T22:00:00.000Z',
      }
    );
    sinon.assert.notCalled(addBillingPurchase);
    sinon.assert.notCalled(insertManyCourseBills);
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

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({}));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: courseBillId },
            { $set: { 'payer.fundingOrganisation': fundingOrganisationId }, $unset: { 'payer.company': '' } },
            { new: true },
          ],
        },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill funder with company', async () => {
    const courseBillId = new ObjectId();
    const companyId = new ObjectId();
    const payload = { payer: { company: companyId } };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({}));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: courseBillId },
            { $set: { 'payer.company': companyId }, $unset: { 'payer.fundingOrganisation': '' } },
            { new: true },
          ],
        },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill mainFee (without percentage)', async () => {
    const courseBillId = new ObjectId();
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, description: 'skududu skududu' };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({}));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: courseBillId }, { $set: payload }, { new: true }] },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should update a course bill mainFee (with trainer fees without percentage)', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();
    const companyId = new ObjectId();
    const courseBill = {
      _id: courseBillId,
      mainFee: { price: 100, count: 1, percentage: 10 },
      billingPurchaseList: [
        { _id: billingPurchaseId, billingItem: TRAINER_FEES_BILLING_ITEM, price: 10, count: 1 },
      ],
      companies: [companyId],
      course: { prices: [{ company: companyId, global: 1000 }] },
    };
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, 'mainFee.percentage': 20 };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseBill));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: courseBillId }, { $set: payload }, { new: true }] },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateBillingPurchase);
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
  });

  it('should update a course bill mainFee (with trainer fees with percentage)', async () => {
    const courseBillId = new ObjectId();
    const billingPurchaseId = new ObjectId();
    const companyId = new ObjectId();
    const courseBill = {
      _id: courseBillId,
      mainFee: { price: 100, count: 1, percentage: 10 },
      billingPurchaseList: [
        { _id: billingPurchaseId, billingItem: TRAINER_FEES_BILLING_ITEM, price: 10, count: 1, percentage: 10 },
      ],
      companies: [companyId],
      course: { prices: [{ company: companyId, global: 1000, trainerFees: 100 }] },
    };
    const payload = { 'mainFee.price': 200, 'mainFee.count': 1, 'mainFee.percentage': 20 };

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries(courseBill));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        { query: 'findOneAndUpdate', args: [{ _id: courseBillId }, { $set: payload }, { new: true }] },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
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

    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({}));

    await CourseBillHelper.updateCourseBill(courseBillId, payload);

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: courseBillId },
            { $set: { 'mainFee.price': 200, 'mainFee.count': 1 }, $unset: { 'mainFee.description': '' } },
            { new: true },
          ],
        },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findOneAndUpdateCourseBillsNumber);
    sinon.assert.notCalled(updateBillingPurchase);
  });

  it('should invoice bill', async () => {
    const courseBillId = new ObjectId();
    const payload = { billedAt: '2022-03-08T00:00:00.000Z' };
    const lastBillNumber = { seq: 1 };

    findOneAndUpdateCourseBillsNumber.returns(SinonMongoose.stubChainedQueries(lastBillNumber, ['lean']));
    findOneAndUpdate.returns(SinonMongoose.stubChainedQueries({}));

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

    SinonMongoose.calledOnceWithExactly(
      findOneAndUpdate,
      [
        {
          query: 'findOneAndUpdate',
          args: [
            { _id: courseBillId },
            {
              $set: { billedAt: payload.billedAt, number: `FACT-${lastBillNumber.seq.toString().padStart(5, '0')}` },
              $unset: { maturityDate: '' },
            },
            { new: true },
          ],
        },
        { query: 'populate', args: [{ path: 'course', select: 'prices' }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(updateBillingPurchase);
  });
});

describe('updateBillList', () => {
  let findOneCourseBillsNumber;
  let updateOneCourseBill;
  let updateOneCourseBillsNumber;
  let updateManyCourseBill;
  let findOneCourseBill;
  let formatIdentity;

  beforeEach(() => {
    findOneCourseBillsNumber = sinon.stub(CourseBillsNumber, 'findOne');
    updateOneCourseBill = sinon.stub(CourseBill, 'updateOne');
    updateOneCourseBillsNumber = sinon.stub(CourseBillsNumber, 'updateOne');
    updateManyCourseBill = sinon.stub(CourseBill, 'updateMany');
    findOneCourseBill = sinon.stub(CourseBill, 'findOne');
    formatIdentity = sinon.stub(UtilsHelper, 'formatIdentity');
  });

  afterEach(() => {
    findOneCourseBillsNumber.restore();
    updateOneCourseBill.restore();
    updateOneCourseBillsNumber.restore();
    updateManyCourseBill.restore();
    findOneCourseBill.restore();
    formatIdentity.restore();
  });

  it('should invoice bills', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const payload = { _ids: courseBillIds, billedAt: '2022-03-08T00:00:00.000Z' };
    const lastBillNumber = { seq: 1 };

    findOneCourseBillsNumber.returns(SinonMongoose.stubChainedQueries(lastBillNumber, ['lean']));
    updateOneCourseBill.onCall(0).returns({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
    updateOneCourseBill.onCall(1).returns({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });

    await CourseBillHelper.updateBillList(payload);

    sinon.assert.notCalled(updateManyCourseBill);
    sinon.assert.notCalled(formatIdentity);
    sinon.assert.notCalled(findOneCourseBill);
    SinonMongoose.calledOnceWithExactly(
      findOneCourseBillsNumber,
      [
        {
          query: 'findOne',
          args: [{}],
        },
        { query: 'lean' },
      ]);
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(0),
      { _id: courseBillIds[0] },
      {
        $set: { billedAt: payload.billedAt, number: 'FACT-00002' },
        $unset: { maturityDate: '' },
      }
    );
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(1),
      { _id: courseBillIds[1] },
      {
        $set: { billedAt: payload.billedAt, number: 'FACT-00003' },
        $unset: { maturityDate: '' },
      }
    );
    sinon.assert.calledOnceWithExactly(
      updateOneCourseBillsNumber,
      {},
      { $inc: { seq: 2 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  it('should remove description and edit payer with company for several bills (not single)', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const course = { type: INTRA };
    const courseBills = [{ _id: courseBillIds[0], course }, { _id: courseBillIds[1], course }];
    const companyId = new ObjectId();
    const payload = { _ids: courseBillIds, mainFee: { description: '' }, payer: { company: companyId } };

    findOneCourseBill.onCall(0).returns(SinonMongoose.stubChainedQueries(courseBills[0]));

    await CourseBillHelper.updateBillList(payload);

    sinon.assert.notCalled(findOneCourseBillsNumber);
    sinon.assert.notCalled(updateOneCourseBill);
    sinon.assert.notCalled(formatIdentity);
    SinonMongoose.calledWithExactly(
      findOneCourseBill,
      [
        { query: 'findOne', args: [{ _id: { $in: courseBillIds[0] } }, { course: 1, maturityDate: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees trainers',
            populate: [{ path: 'trainees', select: 'identity' }, { path: 'trainers', select: 'identity' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateManyCourseBill,
      { _id: { $in: courseBillIds } },
      { $set: { 'payer.company': companyId }, $unset: { 'mainFee.description': '', 'payer.fundingOrganisation': '' } }
    );
  });

  it('should edit description and payer with fundingOrganisation for several bills (not single)', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const course = { type: INTRA };
    const courseBills = [{ _id: courseBillIds[0], course }, { _id: courseBillIds[1], course }];
    const fundingOrganisationId = new ObjectId();
    const payload = {
      _ids: courseBillIds,
      mainFee: { description: 'Facture pour 3 apprenants' },
      payer: { fundingOrganisation: fundingOrganisationId },
    };

    findOneCourseBill.onCall(0).returns(SinonMongoose.stubChainedQueries(courseBills[0]));

    await CourseBillHelper.updateBillList(payload);

    sinon.assert.notCalled(findOneCourseBillsNumber);
    sinon.assert.notCalled(updateOneCourseBill);
    sinon.assert.notCalled(formatIdentity);
    SinonMongoose.calledWithExactly(
      findOneCourseBill,
      [
        { query: 'findOne', args: [{ _id: { $in: courseBillIds[0] } }, { course: 1, maturityDate: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees trainers',
            populate: [{ path: 'trainees', select: 'identity' }, { path: 'trainers', select: 'identity' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledOnceWithExactly(
      updateManyCourseBill,
      { _id: { $in: courseBillIds } },
      {
        $set: {
          'payer.fundingOrganisation': fundingOrganisationId,
          'mainFee.description': 'Facture pour 3 apprenants',
        },
        $unset: { 'payer.company': '' },
      }
    );
  });

  it('should edit maturityDate and payer for several bills (single course)', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const course = {
      type: SINGLE,
      trainers: [
        { identity: { firstname: 'toto', lastname: 'formateur' } },
        { identity: { firstname: 'architecte', lastname: 'parcours' } },
      ],
      trainees: [{ identity: { firstname: 'lili', lastname: 'apprenante' } }],
    };
    const courseBills = [
      { _id: courseBillIds[0], maturityDate: '2025-07-10T22:00:00.000Z', course },
      { _id: courseBillIds[1], maturityDate: '2025-08-10T22:00:00.000Z', course },
    ];
    const fundingOrganisationId = new ObjectId();
    const payload = {
      _ids: courseBillIds,
      mainFee: { description: 'Facture pour 1 apprenant', price: 1200 },
      payer: { fundingOrganisation: fundingOrganisationId },
      maturityDate: '2025-08-27T22:00:00.000Z',
    };
    const description = 'Facture liée à des frais pédagogiques \r\n'
      + 'Contrat de professionnalisation \r\n'
      + 'ACCOMPAGNEMENT septembre 2025\r\n'
      + 'Nom de l\'apprenant·e: Lili Apprenante \r\n'
      + 'Nom du / des intervenants: Toto Formateur, Architecte Parcours';

    findOneCourseBill.onCall(0).returns(SinonMongoose.stubChainedQueries(courseBills[0]));
    findOneCourseBill.onCall(1).returns(SinonMongoose.stubChainedQueries(courseBills[1], ['lean']));
    formatIdentity.onCall(0).returns('Lili Apprenante');
    formatIdentity.onCall(1).returns('Toto Formateur');
    formatIdentity.onCall(2).returns('Architecte Parcours');

    await CourseBillHelper.updateBillList(payload);

    sinon.assert.notCalled(findOneCourseBillsNumber);
    sinon.assert.notCalled(updateOneCourseBillsNumber);
    sinon.assert.notCalled(updateManyCourseBill);
    SinonMongoose.calledWithExactly(
      findOneCourseBill,
      [
        { query: 'findOne', args: [{ _id: { $in: courseBillIds[0] } }, { course: 1, maturityDate: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees trainers',
            populate: [{ path: 'trainees', select: 'identity' }, { path: 'trainers', select: 'identity' }],
          }],
        },
        { query: 'lean' },
      ],
      0
    );
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(0),
      { _id: courseBillIds[0] },
      {
        $set: {
          'mainFee.description': 'Facture pour 1 apprenant',
          'mainFee.price': 1200,
          'payer.fundingOrganisation': fundingOrganisationId,
          maturityDate: '2025-08-27T22:00:00.000Z',
        },
        $unset: { 'payer.company': '' },
      }
    );
    SinonMongoose.calledWithExactly(
      findOneCourseBill,
      [{ query: 'findOne', args: [{ _id: courseBillIds[1] }, { maturityDate: 1 }] }, { query: 'lean' }],
      1
    );
    sinon.assert.calledWithExactly(formatIdentity.getCall(0), { firstname: 'lili', lastname: 'apprenante' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(1), { firstname: 'toto', lastname: 'formateur' }, 'FL');
    sinon.assert.calledWithExactly(formatIdentity.getCall(2), { firstname: 'architecte', lastname: 'parcours' }, 'FL');
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(1),
      { _id: courseBillIds[1] },
      {
        $set: {
          'mainFee.description': description,
          'mainFee.price': 1200,
          'payer.fundingOrganisation': fundingOrganisationId,
          maturityDate: '2025-09-27T22:00:00.000Z',
        },
        $unset: { 'payer.company': '' },
      }
    );
  });

  it('should edit price and payer for several bills (single course)', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];
    const course = {
      type: SINGLE,
      trainers: [
        { identity: { firstname: 'toto', lastname: 'formateur' } },
        { identity: { firstname: 'architecte', lastname: 'parcours' } },
      ],
      trainees: [{ identity: { firstname: 'lili', lastname: 'apprenante' } }],
    };
    const courseBills = [
      { _id: courseBillIds[0], maturityDate: '2025-07-10T22:00:00.000Z', course },
      { _id: courseBillIds[1], maturityDate: '2025-08-10T22:00:00.000Z', course },
    ];
    const payerId = new ObjectId();

    const payload = { _ids: courseBillIds, mainFee: { price: 1200 }, payer: { company: payerId } };

    findOneCourseBill.returns(SinonMongoose.stubChainedQueries(courseBills[0]));

    await CourseBillHelper.updateBillList(payload);

    sinon.assert.notCalled(findOneCourseBillsNumber);
    sinon.assert.notCalled(updateOneCourseBillsNumber);
    sinon.assert.notCalled(updateManyCourseBill);
    SinonMongoose.calledWithExactly(
      findOneCourseBill,
      [
        { query: 'findOne', args: [{ _id: { $in: courseBillIds[0] } }, { course: 1, maturityDate: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'type trainees trainers',
            populate: [{ path: 'trainees', select: 'identity' }, { path: 'trainers', select: 'identity' }],
          }],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(0),
      { _id: courseBillIds[0] },
      { $set: { 'mainFee.price': 1200, 'payer.company': payerId }, $unset: { 'payer.fundingOrganisation': '' } }
    );
    sinon.assert.calledWithExactly(
      updateOneCourseBill.getCall(1),
      { _id: courseBillIds[1] },
      { $set: { 'mainFee.price': 1200, 'payer.company': payerId }, $unset: { 'payer.fundingOrganisation': '' } }
    );
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
            select: 'subProgram prices',
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
              match: { status: RECEIVED },
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

describe('deleteBillList', () => {
  let deleteMany;

  beforeEach(() => {
    deleteMany = sinon.stub(CourseBill, 'deleteMany');
  });

  afterEach(() => {
    deleteMany.restore();
  });

  it('should delete course bills', async () => {
    const courseBillIds = [new ObjectId(), new ObjectId()];

    await CourseBillHelper.deleteBillList(courseBillIds);

    sinon.assert.calledOnceWithExactly(deleteMany, { _id: { $in: courseBillIds } });
  });
});
