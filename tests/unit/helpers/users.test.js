const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { expect } = require('expect');
const sinon = require('sinon');
const Boom = require('@hapi/boom');
const flat = require('flat');
const omit = require('lodash/omit');
const get = require('lodash/get');
const SinonMongoose = require('../sinonMongoose');
const UtilsMock = require('../../utilsMock');
const UsersHelper = require('../../../src/helpers/users');
const translate = require('../../../src/helpers/translate');
const GCloudStorageHelper = require('../../../src/helpers/gCloudStorage');
const UserCompaniesHelper = require('../../../src/helpers/userCompanies');
const User = require('../../../src/models/User');
const Course = require('../../../src/models/Course');
const CourseHistory = require('../../../src/models/CourseHistory');
const CompanyHolding = require('../../../src/models/CompanyHolding');
const CompanyLinkRequest = require('../../../src/models/CompanyLinkRequest');
const Role = require('../../../src/models/Role');
const UserCompany = require('../../../src/models/UserCompany');
const UserHolding = require('../../../src/models/UserHolding');
const {
  HELPER,
  AUXILIARY_WITHOUT_COMPANY,
  WEBAPP,
  TRAINEE_ADDITION,
  STRICTLY_E_LEARNING,
  DIRECTORY,
  COURSE,
  HOLDING_ADMIN,
} = require('../../../src/helpers/constants');
const ActivityHistory = require('../../../src/models/ActivityHistory');
const { CompaniDate } = require('../../../src/helpers/dates/companiDates');

const { language } = translate;

describe('formatQueryForUsersList', () => {
  let find;
  let findUserCompany;
  let findCompanyHolding;
  let findOneCompanyHolding;
  let findUserHolding;
  const credentials = { company: { _id: new ObjectId() }, _id: new ObjectId() };
  const companyId = credentials.company._id;

  beforeEach(() => {
    find = sinon.stub(Role, 'find');
    findUserCompany = sinon.stub(UserCompany, 'find');
    findCompanyHolding = sinon.stub(CompanyHolding, 'find');
    findOneCompanyHolding = sinon.stub(CompanyHolding, 'findOne');
    findUserHolding = sinon.stub(UserHolding, 'find');
    UtilsMock.mockCurrentDate('2022-12-21T16:00:00.000Z');
  });

  afterEach(() => {
    find.restore();
    findUserCompany.restore();
    findCompanyHolding.restore();
    findOneCompanyHolding.restore();
    findUserHolding.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should returns params without role if no role in query', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = { company: companyId, _id: { $in: users.map(u => u.user) } };

    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);

    expect(result).toEqual(omit(query, 'company'));
    sinon.assert.notCalled(find);
    sinon.assert.notCalled(findCompanyHolding);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should return params with role (1 interface)', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = {
      company: companyId,
      _id: { $in: users.map(u => u.user) },
      role: [{ _id: new ObjectId() }, { _id: new ObjectId() }],
    };
    const roles = [{ _id: query.role[0]._id, interface: 'vendor' }, { _id: query.role[1]._id, interface: 'vendor' }];

    find.returns(SinonMongoose.stubChainedQueries(roles, ['lean']));
    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({
      _id: { $in: users.map(u => u.user) },
      'role.vendor': { $in: [query.role[0]._id, query.role[1]._id] },
    });

    SinonMongoose.calledOnceWithExactly(
      find,
      [{ query: 'find', args: [{ name: { $in: query.role } }, { _id: 1, interface: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findCompanyHolding);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
  });

  it('should return params with role (several interfaces)', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = {
      company: companyId,
      _id: { $in: users.map(u => u.user) },
      role: [{ _id: new ObjectId() }, { _id: new ObjectId() }],
    };
    const roles = [{ _id: query.role[0]._id, interface: 'client' }, { _id: query.role[1]._id, interface: 'holding' }];

    find.returns(SinonMongoose.stubChainedQueries(roles, ['lean']));
    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({
      _id: { $in: users.map(u => u.user) },
      $or: [{ 'role.client': { $in: [query.role[0]._id] } }, { 'role.holding': { $in: [query.role[1]._id] } }],
    });

    SinonMongoose.calledOnceWithExactly(
      find,
      [{ query: 'find', args: [{ name: { $in: query.role } }, { _id: 1, interface: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findCompanyHolding);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
  });

  it('should return 404 if role does not exist', async () => {
    const query = { company: companyId, role: [{ _id: new ObjectId() }, { _id: new ObjectId() }] };
    try {
      find.returns(SinonMongoose.stubChainedQueries([], ['lean']));

      const result = await UsersHelper.formatQueryForUsersList(query);
      expect(result).toBeUndefined();
    } catch (e) {
      expect(e).toEqual(Boom.notFound(translate[language].roleNotFound));
    } finally {
      SinonMongoose.calledOnceWithExactly(
        find,
        [{ query: 'find', args: [{ name: { $in: query.role } }, { _id: 1, interface: 1 }] }, { query: 'lean' }]
      );
      sinon.assert.notCalled(findCompanyHolding);
      sinon.assert.notCalled(findOneCompanyHolding);
      sinon.assert.notCalled(findUserHolding);
    }
  });

  it('should return params with holding', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = { holding: new ObjectId() };
    const companyHoldings = [{ _id: new ObjectId(), company: companyId }];

    findCompanyHolding.returns(SinonMongoose.stubChainedQueries(companyHoldings, ['lean']));
    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({ _id: { $in: users.map(u => u.user) } });

    SinonMongoose.calledOnceWithExactly(
      findCompanyHolding,
      [{ query: 'find', args: [{ holding: query.holding }, { company: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{ query: 'find', args: [{ company: { $in: [companyId] } }, { user: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(find);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
  });

  it('should return params with company (without includeHoldingAdmins)', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = { company: companyId };

    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({ _id: { $in: users.map(u => u.user) } });

    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(find);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
  });

  it('should return params with company (with includeHoldingAdmins and holding exists)', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const holdingId = new ObjectId();
    const companyHolding = { _id: new ObjectId(), holding: holdingId };
    const userHoldings = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = { company: companyId, includeHoldingAdmins: true };

    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));
    findOneCompanyHolding.returns(SinonMongoose.stubChainedQueries(companyHolding, ['lean']));
    findUserHolding.returns(SinonMongoose.stubChainedQueries(userHoldings, ['lean']));
    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({ _id: { $in: [...users, ...userHoldings].map(u => u.user) } });

    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCompanyHolding,
      [{ query: 'findOne', args: [{ company: companyId }, { holding: 1 }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserHolding,
      [{ query: 'find', args: [{ holding: holdingId }, { user: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(find);
  });

  it('should return params with company (with includeHoldingAdmins and holding doesn\'t exists)', async () => {
    const users = [{ _id: new ObjectId(), user: new ObjectId() }];
    const query = { company: companyId, includeHoldingAdmins: true };

    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));
    findOneCompanyHolding.returns(SinonMongoose.stubChainedQueries(null, ['lean']));
    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({ _id: { $in: users.map(u => u.user) } });

    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            {
              company: companyId,
              $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }],
            },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findOneCompanyHolding,
      [{ query: 'findOne', args: [{ company: companyId }, { holding: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(findUserHolding);
    sinon.assert.notCalled(find);
  });

  it('should return params with withCompanyUsers', async () => {
    const users = [{ user: new ObjectId() }];
    const query = { withCompanyUsers: true };

    findUserCompany.returns(SinonMongoose.stubChainedQueries(users, ['lean']));

    const result = await UsersHelper.formatQueryForUsersList(query);
    expect(result).toEqual({ _id: { $in: users.map(u => u.user) } });

    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [
        {
          query: 'find',
          args: [
            { $or: [{ endDate: { $gt: '2022-12-21T16:00:00.000Z' } }, { endDate: { $exists: false } }] },
            { user: 1 },
          ],
        },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(find);
    sinon.assert.notCalled(findOneCompanyHolding);
    sinon.assert.notCalled(findUserHolding);
    sinon.assert.notCalled(findCompanyHolding);
  });
});

describe('getUsersList', () => {
  let formatQueryForUsersListStub;
  let find;
  const users = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
  const credentials = { company: { _id: new ObjectId() }, _id: new ObjectId() };
  const companyId = credentials.company._id;

  beforeEach(() => {
    formatQueryForUsersListStub = sinon.stub(UsersHelper, 'formatQueryForUsersList');
    find = sinon.stub(User, 'find');
  });

  afterEach(() => {
    formatQueryForUsersListStub.restore();
    find.restore();
  });

  it('should get users', async () => {
    const query = { email: 'toto@test.com', company: companyId };

    formatQueryForUsersListStub.returns(query);

    find.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));

    const result = await UsersHelper.getUsersList(query, { ...credentials, role: { client: 'test' } });

    expect(result).toEqual(users);
    sinon.assert.calledOnceWithExactly(formatQueryForUsersListStub, query);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [{ ...query, company: companyId }, {}, { autopopulate: false }] },
        { query: 'populate', args: [{ path: 'role.client', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'role.holding', select: '-__v -createdAt -updatedAt' }] },
        {
          query: 'populate',
          args: [{ path: 'company', populate: { path: 'company' }, select: '-__v -createdAt -updatedAt' }],
        },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
      ]
    );
  });

  it('should get users according to roles', async () => {
    const query = { role: ['auxiliary', 'planning_referent'], company: companyId };
    const roles = [new ObjectId(), new ObjectId()];
    const formattedQuery = { company: companyId, 'role.client': { $in: roles } };

    find.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));

    formatQueryForUsersListStub.returns(formattedQuery);

    const result = await UsersHelper.getUsersList(query, { ...credentials, role: { client: 'test' } });

    expect(result).toEqual(users);
    sinon.assert.calledOnceWithExactly(formatQueryForUsersListStub, query);
    SinonMongoose.calledOnceWithExactly(
      find,
      [
        { query: 'find', args: [formattedQuery, {}, { autopopulate: false }] },
        { query: 'populate', args: [{ path: 'role.client', select: '-__v -createdAt -updatedAt' }] },
        { query: 'populate', args: [{ path: 'role.holding', select: '-__v -createdAt -updatedAt' }] },

        {
          query: 'populate',
          args: [{ path: 'company', populate: { path: 'company' }, select: '-__v -createdAt -updatedAt' }],
        },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
      ]
    );
  });
});

describe('getLearnerList', () => {
  let findUser;
  let findRole;
  let findUserCompany;
  let findCourseHistory;
  let findCourse;
  beforeEach(() => {
    findUser = sinon.stub(User, 'find');
    findRole = sinon.stub(Role, 'find');
    findUserCompany = sinon.stub(UserCompany, 'find');
    findCourseHistory = sinon.stub(CourseHistory, 'find');
    findCourse = sinon.stub(Course, 'find');
    UtilsMock.mockCurrentDate('2022-12-21T16:00:00.000Z');
  });
  afterEach(() => {
    findUser.restore();
    findRole.restore();
    findUserCompany.restore();
    findCourseHistory.restore();
    findCourse.restore();
    UtilsMock.unmockCurrentDate();
  });

  it('should get all learners (vendor directory)', async () => {
    const query = { action: DIRECTORY };
    const credentials = { role: { vendor: new ObjectId() } };
    const users = [
      {
        _id: new ObjectId(),
        activityHistories: [{ _id: new ObjectId() }],
        company: { name: 'Alenvi', holding: 'holding' },
      },
      {
        _id: new ObjectId(),
        activityHistories: [{ _id: new ObjectId() }],
        company: { name: 'Fontainebleau', holding: 'holding' },
      },
    ];
    const learnerList = [
      {
        _id: users[0]._id,
        activityHistoryCount: 1,
        lastActivityHistory: users[0].activityHistories[0],
        blendedCoursesCount: 1,
        eLearningCoursesCount: 2,
        company: { name: 'Alenvi', holding: 'holding' },
      },
      {
        _id: users[1]._id,
        activityHistoryCount: 1,
        lastActivityHistory: users[1].activityHistories[0],
        blendedCoursesCount: 1,
        eLearningCoursesCount: 2,
        company: { name: 'Fontainebleau', holding: 'holding' },
      },
    ];
    const courseIds = [new ObjectId()];
    const courseHistories = [
      {
        course: { _id: courseIds[0], trainees: [users[0]._id] },
        trainee: users[0]._id,
        createdAt: '2022-12-20T15:30:00.000Z',
      },
      {
        course: { _id: courseIds[0], trainees: [users[0]._id] },
        trainee: users[0]._id,
        createdAt: '2022-12-22T15:30:00.000Z',
      },
      {
        course: { _id: courseIds[1], trainees: [users[1]._id] },
        trainee: users[0]._id,
        createdAt: '2022-12-20T15:30:00.000Z',
      },
      {
        course: { _id: courseIds[1], trainees: [users[1]._id] },
        trainee: users[1]._id,
        createdAt: '2022-12-20T15:30:00.000Z',
      },
    ];
    const eLearningCourses = [
      { _id: new ObjectId(), trainees: [users[0]._id, users[1]._id] },
      { _id: new ObjectId(), trainees: [users[0]._id] },
      { _id: new ObjectId(), trainees: [users[1]._id] },
    ];

    findUser.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));
    findCourseHistory.returns(SinonMongoose.stubChainedQueries(courseHistories));
    findCourse.returns(SinonMongoose.stubChainedQueries(eLearningCourses, ['lean']));

    const result = await UsersHelper.getLearnerList(query, credentials);

    expect(result).toEqual(learnerList);
    sinon.assert.notCalled(findRole);
    sinon.assert.notCalled(findUserCompany);
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        {
          query: 'find',
          args: [{}, 'identity.firstname identity.lastname picture local.email', { autopopulate: false }],
        },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company', select: 'name' } }] },
        {
          query: 'populate',
          args: [{ path: 'activityHistories', select: 'updatedAt', options: { sort: { updatedAt: -1 } } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'userCompanyList',
            populate: {
              path: 'company',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser: !!get(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourseHistory,
      [
        { query: 'find', args: [{ trainee: { $in: [users[0]._id, users[1]._id] }, action: TRAINEE_ADDITION }] },
        { query: 'populate', args: [{ path: 'course', select: 'trainees' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        { query: 'find', args: [{ trainees: { $in: [users[0]._id, users[1]._id] }, format: STRICTLY_E_LEARNING }] },
        { query: 'lean' },
      ]
    );
  });

  it('should get all company learners (client directory)', async () => {
    const companyId = new ObjectId();
    const query = { companies: companyId, action: DIRECTORY };
    const credentials = { role: { vendor: new ObjectId() } };
    const roleId1 = new ObjectId();
    const roleId2 = new ObjectId();
    const rolesToExclude = [{ _id: roleId1 }, { _id: roleId2 }];
    const users = [
      {
        _id: new ObjectId(),
        activityHistories: [{ _id: new ObjectId() }],
        company: { name: 'Alenvi', holding: 'holding' },
      },
      {
        _id: new ObjectId(),
        activityHistories: [{ _id: new ObjectId() }],
        company: { name: 'Alenvi', holding: 'holding' },
      },
    ];
    const usersCompany = [
      { user: users[0]._id, startDate: '2022-12-20T15:30:00.000Z' },
      { user: users[1]._id, startDate: '2022-12-19T15:30:00.000Z' },
    ];
    const learnerList = [
      {
        _id: users[0]._id,
        activityHistoryCount: 1,
        lastActivityHistory: users[0].activityHistories[0],
        blendedCoursesCount: 1,
        eLearningCoursesCount: 1,
        company: { name: 'Alenvi', holding: 'holding' },
      },
      {
        _id: users[1]._id,
        activityHistoryCount: 1,
        lastActivityHistory: users[1].activityHistories[0],
        blendedCoursesCount: 1,
        eLearningCoursesCount: 2,
        company: { name: 'Alenvi', holding: 'holding' },
      },
    ];
    const courseIds = [new ObjectId()];
    const courseHistories = [
      {
        course: { _id: courseIds[0], trainees: [users[0]._id] },
        trainee: users[0]._id,
        createdAt: '2022-12-20T15:30:00.000Z',
        company: companyId,
      },
      {
        course: { _id: courseIds[0], trainees: [users[0]._id] },
        trainee: users[0]._id,
        createdAt: '2022-12-22T15:30:00.000Z',
        company: companyId,
      },
      {
        course: { _id: courseIds[1], trainees: [users[0]._id, users[1]._id] },
        trainee: users[1]._id,
        createdAt: '2022-12-20T15:30:00.000Z',
        company: companyId,
      },
    ];
    const eLearningCourses = [
      { _id: new ObjectId(), trainees: [users[0]._id, users[1]._id], accessRules: [companyId] },
      { _id: new ObjectId(), trainees: [users[1]._id], accessRules: [] },
    ];

    findUserCompany.returns(SinonMongoose.stubChainedQueries(usersCompany, ['lean']));
    findRole.returns(SinonMongoose.stubChainedQueries(rolesToExclude, ['lean']));
    findUser.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));
    findCourseHistory.returns(SinonMongoose.stubChainedQueries(courseHistories));
    findCourse.returns(SinonMongoose.stubChainedQueries(eLearningCourses, ['lean']));

    const result = await UsersHelper.getLearnerList(query, credentials);

    expect(result).toEqual(learnerList);
    SinonMongoose.calledOnceWithExactly(
      findRole,
      [{ query: 'find', args: [{ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{
        query: 'find',
        args: [
          {
            company: { $in: query.companies },
            startDate: { $lt: CompaniDate('2022-12-21T16:00:00.000Z').toISO() },
            $or: [
              { endDate: { $exists: false } },
              { endDate: { $gt: CompaniDate('2022-12-21T16:00:00.000Z').toISO() } },
            ],
          },
          { user: 1 },
        ],
      }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        {
          query: 'find',
          args: [
            { _id: { $in: [users[0]._id, users[1]._id] }, 'role.client': { $not: { $in: [roleId1, roleId2] } } },
            'identity.firstname identity.lastname picture local.email',
            { autopopulate: false },
          ],
        },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company', select: 'name' } }] },
        {
          query: 'populate',
          args: [{ path: 'activityHistories', select: 'updatedAt', options: { sort: { updatedAt: -1 } } }],
        },
        {
          query: 'populate',
          args: [{
            path: 'userCompanyList',
            populate: {
              path: 'company',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser: !!get(credentials, 'role.vendor') }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourseHistory,
      [
        {
          query: 'find',
          args: [{ trainee: { $in: [users[0]._id, users[1]._id] }, action: TRAINEE_ADDITION, company: companyId }],
        },
        { query: 'populate', args: [{ path: 'course', select: 'trainees' }] },
        { query: 'lean' },
      ]
    );
    SinonMongoose.calledOnceWithExactly(
      findCourse,
      [
        {
          query: 'find',
          args: [{
            trainees: { $in: [users[0]._id, users[1]._id] },
            format: STRICTLY_E_LEARNING,
            $or: [{ accessRules: companyId }, { accessRules: [] }],
          }],
        },
        { query: 'lean' },
      ]
    );
  });

  it('should get learners from company to date', async () => {
    const query = { companies: new ObjectId(), action: COURSE };
    const credentials = { role: { client: new ObjectId() } };
    const roleId1 = new ObjectId();
    const roleId2 = new ObjectId();
    const rolesToExclude = [{ _id: roleId1 }, { _id: roleId2 }];
    const users = [{ _id: new ObjectId() }, { _id: new ObjectId() }];
    const usersCompany = [
      { user: users[0]._id, startDate: '2022-12-20T15:30:00.000Z' },
      { user: users[1]._id, startDate: '2022-12-19T15:30:00.000Z' },
    ];

    findUserCompany.returns(SinonMongoose.stubChainedQueries(usersCompany, ['lean']));
    findRole.returns(SinonMongoose.stubChainedQueries(rolesToExclude, ['lean']));
    findUser.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));

    const result = await UsersHelper.getLearnerList(query, credentials);

    expect(result).toEqual(users);
    SinonMongoose.calledOnceWithExactly(
      findRole,
      [{ query: 'find', args: [{ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{
        query: 'find',
        args: [
          {
            company: { $in: query.companies },
            startDate: { $lt: CompaniDate('2022-12-21T16:00:00.000Z').toISO() },
            $or: [
              { endDate: { $exists: false } },
              { endDate: { $gt: CompaniDate('2022-12-21T16:00:00.000Z').toISO() } },
            ],
          },
          { user: 1 },
        ],
      }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        {
          query: 'find',
          args: [
            { _id: { $in: [users[0]._id, users[1]._id] }, 'role.client': { $not: { $in: [roleId1, roleId2] } } },
            'identity.firstname identity.lastname picture local.email',
            { autopopulate: false },
          ],
        },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company', select: 'name' } }] },
        { query: 'populate', args: [false] },
        {
          query: 'populate',
          args: [{
            path: 'userCompanyList',
            populate: {
              path: 'company',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findCourse);
    sinon.assert.notCalled(findCourseHistory);
  });

  it('should get current or future learners from company', async () => {
    const query = { companies: new ObjectId(), startDate: '2022-12-21T16:00:00.000Z', action: COURSE };
    const credentials = { role: { client: new ObjectId() } };
    const roleId1 = new ObjectId();
    const roleId2 = new ObjectId();
    const rolesToExclude = [{ _id: roleId1 }, { _id: roleId2 }];
    const users = [
      { _id: new ObjectId(), company: { name: 'Alenvi', holding: 'holding' } },
      { _id: new ObjectId(), company: { name: 'Alenvi', holding: 'holding' } }];
    const usersCompany = [
      { user: users[0]._id, startDate: '2022-12-20T15:30:00.000Z' },
      { user: users[1]._id, startDate: '2022-12-19T15:30:00.000Z' },
    ];

    findUserCompany.returns(SinonMongoose.stubChainedQueries(usersCompany, ['lean']));
    findRole.returns(SinonMongoose.stubChainedQueries(rolesToExclude, ['lean']));
    findUser.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));

    const result = await UsersHelper.getLearnerList(query, credentials);

    expect(result).toEqual(users);
    SinonMongoose.calledOnceWithExactly(
      findRole,
      [{ query: 'find', args: [{ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{
        query: 'find',
        args: [
          {
            company: { $in: query.companies },
            $or: [
              { endDate: { $exists: false } },
              { endDate: { $gt: CompaniDate('2022-12-21T16:00:00.000Z').toISO() } },
            ],
          },
          { user: 1 },
        ],
      }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        {
          query: 'find',
          args: [
            { _id: { $in: [users[0]._id, users[1]._id] }, 'role.client': { $not: { $in: [roleId1, roleId2] } } },
            'identity.firstname identity.lastname picture local.email',
            { autopopulate: false },
          ],
        },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company', select: 'name' } }] },
        { query: 'populate', args: [false] },
        {
          query: 'populate',
          args: [{
            path: 'userCompanyList',
            populate: {
              path: 'company',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findCourse);
    sinon.assert.notCalled(findCourseHistory);
  });

  it('should get learners at a certain date', async () => {
    const query = {
      companies: new ObjectId(),
      startDate: '2022-12-19T23:00:00.000Z',
      endDate: '2022-12-20T22:59:59.999Z',
      action: COURSE,
    };
    const credentials = { role: { client: new ObjectId() } };
    const roleId1 = new ObjectId();
    const roleId2 = new ObjectId();
    const rolesToExclude = [{ _id: roleId1 }, { _id: roleId2 }];
    const users = [
      { _id: new ObjectId(), company: { name: 'Alenvi', holding: 'holding' } },
      { _id: new ObjectId(), company: { name: 'Alenvi', holding: 'holding' } },
    ];
    const usersCompany = [
      { user: users[0]._id, startDate: '2020-12-20T15:30:00.000Z' },
      { user: users[1]._id, startDate: '2020-12-19T15:30:00.000Z' },
    ];

    findUserCompany.returns(SinonMongoose.stubChainedQueries(usersCompany, ['lean']));
    findRole.returns(SinonMongoose.stubChainedQueries(rolesToExclude, ['lean']));
    findUser.returns(SinonMongoose.stubChainedQueries(users, ['populate', 'setOptions', 'lean']));

    const result = await UsersHelper.getLearnerList(query, credentials);

    expect(result).toEqual(users);
    SinonMongoose.calledOnceWithExactly(
      findRole,
      [{ query: 'find', args: [{ name: { $in: [HELPER, AUXILIARY_WITHOUT_COMPANY] } }] }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUserCompany,
      [{
        query: 'find',
        args: [
          {
            company: { $in: query.companies },
            startDate: { $lt: CompaniDate('2022-12-20T22:59:59.999Z').toISO() },
            $or: [
              { endDate: { $gt: CompaniDate('2022-12-19T23:00:00.000Z').toISO() } },
              { endDate: { $exists: false } },
            ],
          },
          { user: 1 },
        ],
      }, { query: 'lean' }]
    );
    SinonMongoose.calledOnceWithExactly(
      findUser,
      [
        {
          query: 'find',
          args: [
            { _id: { $in: [users[0]._id, users[1]._id] }, 'role.client': { $not: { $in: [roleId1, roleId2] } } },
            'identity.firstname identity.lastname picture local.email',
            { autopopulate: false },
          ],
        },
        { query: 'populate', args: [{ path: 'company', populate: { path: 'company', select: 'name' } }] },
        { query: 'populate', args: [false] },
        {
          query: 'populate',
          args: [{
            path: 'userCompanyList',
            populate: {
              path: 'company',
              select: 'name',
              populate: { path: 'holding', populate: { path: 'holding', select: 'name' } },
            },
          }],
        },
        { query: 'setOptions', args: [{ isVendorUser: false }] },
        { query: 'lean' },
      ]
    );
    sinon.assert.notCalled(findCourse);
    sinon.assert.notCalled(findCourseHistory);
  });
});

describe('getUser', () => {
  let findOne;
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should return user as client', async () => {
    const userId = new ObjectId();
    const user = {
      _id: userId,
      role: { name: 'helper', rights: [] },
      userCompanyList: [{ company: new ObjectId() }],
    };
    const credentials = { role: { client: 'coach' }, company: { _id: new ObjectId() }, _id: new ObjectId() };

    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.getUser(userId, credentials);
    expect(res).toEqual({ ...user, userCompanyList: [] });

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        {
          query: 'populate',
          args: [{
            path: 'company',
            populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'holding',
            populate: { path: 'holding', populate: { path: 'companies' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } }],
        },
        { query: 'populate', args: [{ path: 'userCompanyList' }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });

  it('should return user as holding', async () => {
    const holdingCompany = new ObjectId();
    const userId = new ObjectId();
    const user = {
      _id: userId,
      role: { name: 'helper', rights: [] },
      userCompanyList: [{ company: new ObjectId() }, { company: holdingCompany }],
    };
    const credentials = {
      role: { holding: 'holding_admin' },
      holding: { companies: [holdingCompany] },
      company: { _id: new ObjectId() },
    };

    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.getUser(userId, credentials);
    expect(res).toEqual({ ...user, userCompanyList: [{ company: holdingCompany }] });

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        {
          query: 'populate',
          args: [{
            path: 'company',
            populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'holding',
            populate: { path: 'holding', populate: { path: 'companies' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } }],
        },
        { query: 'populate', args: [{ path: 'userCompanyList' }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });

  it('should return user as vendor', async () => {
    const userId = new ObjectId();
    const user = {
      _id: userId,
      role: { vendor: 'trainer', rights: [] },
      userCompanyList: [{ company: new ObjectId() }, { company: new ObjectId() }],
    };
    const credentials = { company: { _id: new ObjectId() }, _id: new ObjectId(), role: { vendor: 'trainer' } };

    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.getUser(userId, credentials);
    expect(res).toEqual(user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        {
          query: 'populate',
          args: [{
            path: 'company',
            populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'holding',
            populate: { path: 'holding', populate: { path: 'companies' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } }],
        },
        { query: 'populate', args: [{ path: 'userCompanyList' }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });

  it('should return user as itself', async () => {
    const userId = new ObjectId();
    const user = { _id: userId, userCompanyList: [{ company: new ObjectId() }, { company: new ObjectId() }] };
    const credentials = { company: { _id: new ObjectId() }, _id: userId };

    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.getUser(userId, credentials);
    expect(res).toEqual(user);

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        {
          query: 'populate',
          args: [{
            path: 'company',
            populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{
            path: 'holding',
            populate: { path: 'holding', populate: { path: 'companies' } },
            select: '-__v -createdAt -updatedAt',
          }],
        },
        {
          query: 'populate',
          args: [{ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } }],
        },
        { query: 'populate', args: [{ path: 'userCompanyList' }] },
        { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
      ]
    );
  });

  it('should throw error if user not found', async () => {
    const userId = new ObjectId();
    const credentials = {
      company: { _id: new ObjectId() },
      role: { vendor: { _id: new ObjectId() } },
      _id: new ObjectId(),
    };

    try {
      findOne.returns(SinonMongoose.stubChainedQueries(null));

      await UsersHelper.getUser(userId, credentials);
    } catch (e) {
      expect(e.output.statusCode).toEqual(404);
    } finally {
      SinonMongoose.calledOnceWithExactly(
        findOne,
        [
          { query: 'findOne', args: [{ _id: userId }] },
          {
            query: 'populate',
            args: [{
              path: 'company',
              populate: { path: 'company', populate: { path: 'billingRepresentative salesRepresentative' } },
              select: '-__v -createdAt -updatedAt',
            }],
          },
          {
            query: 'populate',
            args: [{
              path: 'holding',
              populate: { path: 'holding', populate: { path: 'companies' } },
              select: '-__v -createdAt -updatedAt',
            }],
          },
          {
            query: 'populate',
            args: [{ path: 'companyLinkRequest', populate: { path: 'company', select: '_id name' } }],
          },
          { query: 'populate', args: [{ path: 'userCompanyList' }] },
          { query: 'lean', args: [{ autopopulate: true, virtuals: true }] },
        ]
      );
    }
  });
});

describe('userExists', () => {
  let findOne;
  const email = 'test@test.fr';
  const nonExistantEmail = 'toto.gateau@alenvi.io';
  const company = new ObjectId();
  const user = {
    _id: new ObjectId(),
    local: { email: 'test@test.fr' },
    role: { client: { _id: new ObjectId() } },
    company,
    userCompanyList: [{ company }],
    serialNumber: '123',
  };

  const userWithoutCompany = { ...user, company: null, userCompanyList: [] };
  const vendorCredentials = { role: { vendor: { _id: new ObjectId() } }, company: { _id: new ObjectId() } };
  const clientCredentials = { role: { client: { name: 'coach' } }, company: { _id: new ObjectId() } };
  const holdingCredentials = {
    role: { holding: { name: 'holding_admin' }, client: { name: 'coach' } },
    holding: { _id: new ObjectId(), companies: [company] },
  };
  beforeEach(() => {
    findOne = sinon.stub(User, 'findOne');
  });
  afterEach(() => {
    findOne.restore();
  });

  it('should find a user if credentials', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.userExists(email, vendorCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual(omit(user, 'serialNumber'));

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should not find as email does not exist', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(null));

    const res = await UsersHelper.userExists(nonExistantEmail, vendorCredentials);

    expect(res.exists).toBe(false);
    expect(res.user).toEqual({});

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': nonExistantEmail },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should only confirm targeted user exist, as logged user has only client role', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.userExists(email, clientCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual({});
    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should confirm targeted user exist and send info, as targeted user has same company in the future', async () => {
    const userCompanyList = [
      {
        company: clientCredentials.company._id,
        startDate: CompaniDate().add('P1D').toISO(),
        user: userWithoutCompany._id,
      },
    ];
    findOne.returns(SinonMongoose.stubChainedQueries({ ...userWithoutCompany, userCompanyList }));

    const res = await UsersHelper.userExists(email, clientCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual(
      { ...omit(userWithoutCompany, 'serialNumber'), userCompanyList: [omit(userCompanyList[0], 'user')] }
    );

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should only confirm targeted user exist, as targeted user has other company in the future', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(
      {
        ...userWithoutCompany,
        userCompanyList: [{ company: new ObjectId(), startDate: CompaniDate().add('P1D').toISO() }],
      }
    ));

    const res = await UsersHelper.userExists(email, clientCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual({});

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should confirm targeted user exist and send info, as targeted user has holding company', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.userExists(email, holdingCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual(omit(user, 'serialNumber'));

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should find targeted user and give all infos, as targeted user has no company', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(userWithoutCompany));

    const res = await UsersHelper.userExists(email, clientCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual(omit(userWithoutCompany, 'serialNumber'));

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should find targeted user and give some infos, as targeted user has only ending company', async () => {
    const userId = new ObjectId();
    const roleId = new ObjectId();

    const userWithEndingCompany = {
      _id: userId,
      local: { email: 'test@compani.fr', password: 'notshow' },
      contact: { phone: '0987654321' },
      identity: { firstname: 'test', lastname: 'test' },
      role: { client: roleId },
      mentor: 'mentor',
      userCompanyList: [
        { company, startDate: '2021-01-01T00:00:00.000Z', endDate: '2022-01-01T00:00:00.000Z', user: userId },
        { company, startDate: '2024-01-01T00:00:00.000Z', endDate: '2045-01-01T00:00:00.000Z', user: userId },
      ],
    };

    findOne.returns(SinonMongoose.stubChainedQueries(userWithEndingCompany));

    const res = await UsersHelper.userExists(email, clientCredentials);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual({
      _id: userId,
      local: { email: 'test@compani.fr' },
      contact: { phone: '0987654321' },
      identity: { firstname: 'test', lastname: 'test' },
      role: { client: roleId },
      userCompanyList: [{ company, startDate: '2024-01-01T00:00:00.000Z', endDate: '2045-01-01T00:00:00.000Z' }],
    });

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });

  it('should find an email but no user if no credentials', async () => {
    findOne.returns(SinonMongoose.stubChainedQueries(user));

    const res = await UsersHelper.userExists(email, null);

    expect(res.exists).toBe(true);
    expect(res.user).toEqual({});

    SinonMongoose.calledOnceWithExactly(
      findOne,
      [
        {
          query: 'findOne',
          args: [
            { 'local.email': email },
            { role: 1, 'local.email': 1, 'identity.firstname': 1, 'identity.lastname': 1, 'contact.phone': 1 },
          ],
        },
        { query: 'populate', args: [{ path: 'company' }] },
        { query: 'populate', args: [{ path: 'userCompanyList', options: { sort: { startDate: 1 } } }] },
        { query: 'lean' },
      ]
    );
  });
});

describe('createUser', () => {
  let userFindOne;
  let roleFindById;
  let userCreate;
  let userCompanyCreate;
  let userFindOneAndUpdate;
  let objectIdStub;
  const userId = new ObjectId();
  const roleId = new ObjectId();

  beforeEach(() => {
    userFindOne = sinon.stub(User, 'findOne');
    roleFindById = sinon.stub(Role, 'findById');
    userCreate = sinon.stub(User, 'create');
    userCompanyCreate = sinon.stub(UserCompaniesHelper, 'create');
    userFindOneAndUpdate = sinon.stub(User, 'findOneAndUpdate');
    objectIdStub = sinon.stub(mongoose.Types, 'ObjectId').returns(userId);
  });

  afterEach(() => {
    userFindOne.restore();
    roleFindById.restore();
    userCreate.restore();
    userCompanyCreate.restore();
    userFindOneAndUpdate.restore();
    objectIdStub.restore();
  });

  it('should create a new account for not logged user', async () => {
    const payload = {
      identity: { lastname: 'Test' },
      local: { email: 'toto@test.com' },
      contact: { phone: '0606060606' },
      origin: WEBAPP,
    };

    userCreate.returns({ identity: payload.identity, local: payload.local, contact: payload.contact });

    const result = await UsersHelper.createUser(payload, null);

    expect(result).toEqual({ identity: payload.identity, local: payload.local, contact: payload.contact });
    sinon.assert.notCalled(userCompanyCreate);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(roleFindById);
    sinon.assert.calledOnceWithExactly(userCreate, { ...payload, refreshToken: sinon.match.string });
  });

  it('client admin - should create a coach for his organization', async () => {
    const companyId = new ObjectId();
    const payload = {
      identity: { lastname: 'Test', firstname: 'Toto' },
      local: { email: 'toto@test.com' },
      role: { client: roleId },
      origin: WEBAPP,
    };
    const newUser = { ...payload, _id: userId, role: { _id: roleId, name: 'coach' } };

    roleFindById.returns(SinonMongoose.stubChainedQueries(
      { _id: roleId, name: 'coach', interface: 'client' },
      ['lean']
    ));
    userCreate.returns(newUser);
    userFindOne.returns(SinonMongoose.stubChainedQueries(newUser, ['lean']));

    const result = await UsersHelper.createUser(payload, { company: { _id: companyId } });

    expect(result).toEqual(newUser);
    sinon.assert.calledOnceWithExactly(userCompanyCreate, { user: userId, company: companyId });
    SinonMongoose.calledOnceWithExactly(
      roleFindById,
      [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(userCreate, { ...payload, refreshToken: sinon.match.string });
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
      ]
    );
  });

  it('vendor admin - should create a client admin with company', async () => {
    const credentialsCompanyId = new ObjectId();
    const userCompanyId = new ObjectId();
    const payload = {
      identity: { lastname: 'Admin', firstname: 'Toto' },
      local: { email: 'admin@test.com' },
      role: roleId,
      company: userCompanyId,
      origin: WEBAPP,
    };
    const newUser = { ...payload, _id: userId, role: { _id: roleId, name: 'client_admin' } };

    roleFindById.returns(SinonMongoose.stubChainedQueries(
      { _id: roleId, name: 'client_admin', interface: 'client' },
      ['lean']
    ));
    userCreate.returns(newUser);
    userFindOne.returns(SinonMongoose.stubChainedQueries(newUser, ['lean']));

    const result = await UsersHelper.createUser(payload, { company: { _id: credentialsCompanyId } });

    expect(result).toEqual(newUser);
    sinon.assert.calledOnceWithExactly(userCompanyCreate, { user: userId, company: userCompanyId });
    SinonMongoose.calledOnceWithExactly(
      roleFindById,
      [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(
      userCreate,
      { ...payload, role: { client: roleId }, refreshToken: sinon.match.string }
    );
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
      ]
    );
  });

  it('vendor admin - should create a trainer without company', async () => {
    const companyId = new ObjectId();
    const payload = {
      identity: { lastname: 'Admin', firstname: 'Toto' },
      local: { email: 'trainer@test.com' },
      role: roleId,
      origin: WEBAPP,
    };
    const newUser = { ...payload, _id: userId, role: { _id: roleId, name: 'trainer' } };

    roleFindById.returns(SinonMongoose.stubChainedQueries(
      { _id: roleId, name: 'trainer', interface: 'vendor' },
      ['lean']
    ));
    userCreate.returns(newUser);

    const result = await UsersHelper.createUser(payload, { company: { _id: companyId } });

    expect(result).toEqual(newUser);
    sinon.assert.notCalled(userFindOne);
    sinon.assert.notCalled(userCompanyCreate);
    SinonMongoose.calledOnceWithExactly(
      roleFindById,
      [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(
      userCreate,
      { ...payload, role: { vendor: roleId }, refreshToken: sinon.match.string }
    );
  });

  it('vendor admin - should create a user without role but with company', async () => {
    const credentialsCompanyId = new ObjectId();
    const userCompanyId = new ObjectId();
    const payload = {
      identity: { lastname: 'Test', firstname: 'Toto' },
      local: { email: 'toto@test.com' },
      company: userCompanyId,
      userCompanyStartDate: '2022-12-13T16:00:12.000Z',
      origin: WEBAPP,
    };
    const newUser = { ...payload, _id: userId };

    userCreate.returns(newUser);
    userFindOne.returns(SinonMongoose.stubChainedQueries(newUser, ['lean']));

    const result = await UsersHelper.createUser(payload, { company: { _id: credentialsCompanyId } });

    expect(result).toEqual(newUser);
    sinon.assert.notCalled(roleFindById);
    sinon.assert.calledOnceWithExactly(
      userCompanyCreate,
      { user: userId, company: userCompanyId, startDate: '2022-12-13T16:00:12.000Z' }
    );
    sinon.assert.calledOnceWithExactly(userCreate, { ...payload, refreshToken: sinon.match.string });
    SinonMongoose.calledOnceWithExactly(
      userFindOne,
      [
        { query: 'findOne', args: [{ _id: userId }] },
        { query: 'lean', args: [{ virtuals: true, autopopulate: true }] },
      ]
    );
  });

  it('should return a 400 error if role does not exist', async () => {
    const companyId = new ObjectId();
    const payload = {
      identity: { lastname: 'Test', firstname: 'Toto' },
      local: { email: 'toto@test.com' },
      role: roleId,
      origin: WEBAPP,
    };
    try {
      roleFindById.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

      await UsersHelper.createUser(payload, { company: { _id: companyId } });
    } catch (e) {
      expect(e).toEqual(Boom.badRequest('Le rôle n\'existe pas.'));
    } finally {
      sinon.assert.notCalled(userCreate);
      sinon.assert.notCalled(userCompanyCreate);
      sinon.assert.notCalled(userFindOne);
      SinonMongoose.calledOnceWithExactly(
        roleFindById,
        [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
      );
    }
  });
});

describe('removeUser', () => {
  let deleteOne;
  let deleteOneCompanyLinkRequest;
  let updateManyCourse;
  let deleteManyActivityHistories;
  beforeEach(() => {
    deleteOne = sinon.stub(User, 'deleteOne');
    deleteOneCompanyLinkRequest = sinon.stub(CompanyLinkRequest, 'deleteOne');
    updateManyCourse = sinon.stub(Course, 'updateMany');
    deleteManyActivityHistories = sinon.stub(ActivityHistory, 'deleteMany');
  });
  afterEach(() => {
    deleteOne.restore();
    deleteOneCompanyLinkRequest.restore();
    updateManyCourse.restore();
    deleteManyActivityHistories.restore();
  });

  it('should delete account', async () => {
    const userId = new ObjectId();

    await UsersHelper.removeUser({ _id: userId }, { _id: userId });

    sinon.assert.calledOnceWithExactly(deleteManyActivityHistories, { user: userId });
    sinon.assert.calledOnceWithExactly(deleteOne, { _id: userId });
    sinon.assert.calledOnceWithExactly(deleteOneCompanyLinkRequest, { user: userId });
    sinon.assert.calledOnceWithExactly(updateManyCourse, { trainees: userId }, { $pull: { trainees: userId } });
  });
});

describe('updateUser', () => {
  let userUpdateOne;
  let roleFindById;
  let roleFindOne;
  let userHoldingCreate;
  const userId = new ObjectId();

  beforeEach(() => {
    userUpdateOne = sinon.stub(User, 'updateOne');
    roleFindById = sinon.stub(Role, 'findById');
    roleFindOne = sinon.stub(Role, 'findOne');
    userHoldingCreate = sinon.stub(UserHolding, 'create');
  });
  afterEach(() => {
    userUpdateOne.restore();
    roleFindById.restore();
    roleFindOne.restore();
    userHoldingCreate.restore();
  });

  it('should update a user', async () => {
    const payload = { identity: { firstname: 'Titi' } };

    await UsersHelper.updateUser(userId, payload);

    sinon.assert.calledOnceWithExactly(userUpdateOne, { _id: userId }, { $set: flat(payload) });
    sinon.assert.notCalled(roleFindById);
    sinon.assert.notCalled(userHoldingCreate);
    sinon.assert.notCalled(roleFindOne);
  });

  it('should update a user role', async () => {
    const payload = { role: new ObjectId() };
    const payloadWithRole = { 'role.client': payload.role };

    roleFindById.returns(SinonMongoose.stubChainedQueries(
      { _id: payload.role, name: 'test', interface: 'client' },
      ['lean']
    ));

    await UsersHelper.updateUser(userId, payload);

    sinon.assert.calledOnceWithExactly(userUpdateOne, { _id: userId }, { $set: payloadWithRole });
    SinonMongoose.calledOnceWithExactly(
      roleFindById,
      [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
    );
    sinon.assert.notCalled(userHoldingCreate);
    sinon.assert.notCalled(roleFindOne);
  });

  it('should return a 400 error if role does not exists', async () => {
    const payload = { role: new ObjectId() };

    roleFindById.returns(SinonMongoose.stubChainedQueries(null, ['lean']));

    try {
      await UsersHelper.updateUser(userId, payload);
    } catch (e) {
      expect(e).toEqual(Boom.badRequest('Le rôle n\'existe pas.'));
    } finally {
      SinonMongoose.calledOnceWithExactly(
        roleFindById,
        [{ query: 'findById', args: [payload.role, { name: 1, interface: 1 }] }, { query: 'lean' }]
      );
      sinon.assert.notCalled(userUpdateOne);
      sinon.assert.notCalled(userHoldingCreate);
      sinon.assert.notCalled(roleFindOne);
    }
  });

  it('should update a user holding', async () => {
    const payload = { holding: new ObjectId() };
    const holdingRole = { _id: new ObjectId() };

    roleFindOne.returns(SinonMongoose.stubChainedQueries(holdingRole, ['lean']));

    await UsersHelper.updateUser(userId, payload);

    sinon.assert.calledOnceWithExactly(
      userHoldingCreate,
      { user: userId, holding: payload.holding }
    );
    SinonMongoose.calledOnceWithExactly(
      roleFindOne,
      [{ query: 'findOne', args: [{ name: HOLDING_ADMIN }] }, { query: 'lean' }]
    );
    sinon.assert.calledOnceWithExactly(userUpdateOne, { _id: userId }, { $set: { 'role.holding': holdingRole._id } });
    sinon.assert.notCalled(roleFindById);
  });
});

describe('uploadPicture', () => {
  let updateOneStub;
  let uploadUserMedia;
  beforeEach(() => {
    updateOneStub = sinon.stub(User, 'updateOne');
    uploadUserMedia = sinon.stub(GCloudStorageHelper, 'uploadUserMedia');
  });
  afterEach(() => {
    updateOneStub.restore();
    uploadUserMedia.restore();
  });

  it('should upload image', async () => {
    uploadUserMedia.returns({
      publicId: 'jesuisunsupernomdefichier',
      link: 'https://storage.googleapis.com/BucketKFC/myMedia',
    });

    const userId = new ObjectId();
    const payload = { file: new ArrayBuffer(32), fileName: 'illustration' };

    await UsersHelper.uploadPicture(userId, payload);

    sinon.assert.calledOnceWithExactly(uploadUserMedia, { file: new ArrayBuffer(32), fileName: 'illustration' });
    sinon.assert.calledOnceWithExactly(
      updateOneStub,
      { _id: userId },
      {
        $set: flat({
          picture: { publicId: 'jesuisunsupernomdefichier', link: 'https://storage.googleapis.com/BucketKFC/myMedia' },
        }),
      }
    );
  });
});

describe('deleteMedia', () => {
  let updateOne;
  let deleteUserMedia;
  beforeEach(() => {
    updateOne = sinon.stub(User, 'updateOne');
    deleteUserMedia = sinon.stub(GCloudStorageHelper, 'deleteUserMedia');
  });
  afterEach(() => {
    updateOne.restore();
    deleteUserMedia.restore();
  });

  it('should do nothing as publicId is not set', async () => {
    const userId = new ObjectId();
    await UsersHelper.deletePicture(userId, '');

    sinon.assert.notCalled(updateOne);
    sinon.assert.notCalled(deleteUserMedia);
  });

  it('should update user and delete media', async () => {
    const userId = new ObjectId();
    await UsersHelper.deletePicture(userId, 'publicId');

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: userId },
      { $unset: { 'picture.publicId': '', 'picture.link': '' } }
    );
    sinon.assert.calledOnceWithExactly(deleteUserMedia, 'publicId');
  });
});

describe('addExpoToken', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(User, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should remove expoToken from user', async () => {
    const userId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { _id: userId, company: { _id: companyId } };
    const payload = { formationExpoToken: 'ExponentPushToken[jeSuisUnIdExpo]' };

    await UsersHelper.addExpoToken(payload, credentials);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: userId },
      { $addToSet: { formationExpoTokenList: 'ExponentPushToken[jeSuisUnIdExpo]' } }
    );
  });
});

describe('removeExpoToken', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = sinon.stub(User, 'updateOne');
  });
  afterEach(() => {
    updateOne.restore();
  });

  it('should remove expoToken from user', async () => {
    const userId = new ObjectId();
    const companyId = new ObjectId();
    const credentials = { _id: userId, company: { _id: companyId } };

    await UsersHelper.removeExpoToken('ExponentPushToken[jeSuisUnIdExpo]', credentials);

    sinon.assert.calledOnceWithExactly(
      updateOne,
      { _id: userId },
      { $pull: { formationExpoTokenList: 'ExponentPushToken[jeSuisUnIdExpo]' } }
    );
  });
});
