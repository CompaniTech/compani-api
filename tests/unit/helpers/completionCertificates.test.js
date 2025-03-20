const sinon = require('sinon');
const { expect } = require('expect');
const { get } = require('lodash');
const { ObjectId } = require('mongodb');
const SinonMongoose = require('../sinonMongoose');
const CompletionCertificate = require('../../../src/models/CompletionCertificate');
const CompletionCertificatesHelper = require('../../../src/helpers/completionCertificates');
const { VENDOR_ROLES } = require('../../../src/helpers/constants');

describe('list #tag', () => {
  let findCompletionCertificates;

  beforeEach(() => {
    findCompletionCertificates = sinon.stub(CompletionCertificate, 'find');
  });

  afterEach(() => {
    findCompletionCertificates.restore();
  });

  it('should get completion certificates for specified months (months is an array)', async () => {
    const query = { months: ['06_2024', '07_2024'] };
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          companies: [{ name: 'Alenvi', holding: { name: 'Adef Résidencess' } }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
      {
        course: {
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '07_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024', '07_2024'] } }, { course: 1, trainee: 1, month: 1 }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            { path: 'trainee', select: 'identity' },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specified month (months is a string)', async () => {
    const query = { months: '06_2024' };
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          companies: [{ name: 'Alenvi', holding: { name: 'Alenvi' } }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const result = await CompletionCertificatesHelper.list(query);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ month: { $in: ['06_2024'] } }, { course: 1, trainee: 1, month: 1 }] },
        {
          query: 'populate',
          args: [[
            {
              path: 'course',
              select: 'companies subProgram misc',
              populate: [
                {
                  path: 'companies',
                  select: 'name',
                  populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
                },
                { path: 'subProgram', select: 'program', populate: { path: 'program', select: 'name' } },
              ],
            },
            { path: 'trainee', select: 'identity' },
          ]],
        },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get completion certificates for a specific course', async () => {
    const courseId = new ObjectId();
    const credentials = { _id: new ObjectId(), role: { vendor: { name: 'training_organisation_manager' } } };

    const trainee = { identity: { firstname: 'Pop', lastname: 'CORN' } };
    const completionCertificates = [
      {
        course: {
          _id: courseId,
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '06_2024',
      },
      {
        course: {
          _id: courseId,
          companies: [{ name: 'Alenvi' }],
          subProgram: { program: { name: 'program' } },
          misc: 'course',
        },
        trainee,
        month: '07_2024',
      },
    ];

    findCompletionCertificates.returns(
      SinonMongoose.stubChainedQueries(completionCertificates, ['populate', 'setOptions', 'lean'])
    );

    const query = { course: courseId };
    const result = await CompletionCertificatesHelper.list(query);

    expect(result).toEqual(completionCertificates);

    SinonMongoose.calledOnceWithExactly(
      findCompletionCertificates,
      [
        { query: 'find', args: [{ course: courseId }, { course: 1, trainee: 1, month: 1 }] },
        { query: 'populate', args: [[{ path: 'trainee', select: 'identity' }]] },
        { query: 'setOptions', args: [{ isVendorUser: VENDOR_ROLES.includes(get(credentials, 'role.vendor.name')) }] },
        { query: 'lean' },
      ]
    );
  });
});
