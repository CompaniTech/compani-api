const sinon = require('sinon');
const { expect } = require('expect');
const { get } = require('lodash');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const CompletionCertificatesHelper = require('../../../src/helpers/completionCertificates');
const { VENDOR_ROLES } = require('../../../src/helpers/constants');

describe('getCompletionCertificates', () => {
  let findCompletionCertificates;

  beforeEach(() => {
    findCompletionCertificates = sinon.stub(CompletionCertificate, 'find');
  });

  afterEach(() => {
    findCompletionCertificates.restore();
  });

  it('should get completion certificates by month', async () => {
    const query = { months: ['06_2024'] };
    const credentials = {
      _id: new ObjectId(),
      role: { vendor: { name: 'vendor_admin' } },
    };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificate = [
      {
        course: [{
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        }],
        trainee: trainee.identity,
        month: '06_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificate, ['populate', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.getCompletionCertificates(query);

    expect(result).toEqual(completionCertificate);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024'] } }, { course: 1, trainee: 1, month: 1 }] },
        {
          query: 'populate',
          args: [{
            path: 'course',
            select: 'companies subProgram misc',
            populate: [
              { path: 'companies', select: 'name' },
              {
                path: 'subProgram',
                select: 'program',
                populate: { path: 'program', select: 'name' },
              },
            ],
          }],
        },
        { query: 'populate', args: [{ path: 'trainee', select: 'identity' }] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]
    );
  });
});
