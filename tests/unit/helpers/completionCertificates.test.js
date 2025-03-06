const sinon = require('sinon');
const { expect } = require('expect');
const SinonMongoose = require('../sinonMongoose');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const CompletionCertificatesHelper = require('../../../src/helpers/completionCertificates');

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
      SinonMongoose.stubChainedQueries(completionCertificate)
    );

    const result = await CompletionCertificatesHelper.getCompletionCertificates(query);

    expect(result).toEqual(completionCertificate);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024'] } }, { course: 1, trainee: 1 }] },
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
        { query: 'lean' },
      ]
    );
  });
});
