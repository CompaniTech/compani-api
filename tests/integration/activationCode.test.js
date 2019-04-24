const expect = require('expect');

const app = require('../../server');
const {
  populateUsers,
  getToken,
  userList
} = require('./seed/usersSeed');
const { populateActivationCode, activationCode } = require('./seed/activationCodeSeed');
const { populateRoles } = require('./seed/rolesSeed');
const { populateCompanies } = require('./seed/companiesSeed');
const ActivationCode = require('../../models/ActivationCode');

describe('NODE ENV', () => {
  it("should be 'test'", () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('ACTIVATION CODE ROUTES', () => {
  let token = null;
  before(populateActivationCode);
  before(populateCompanies);
  before(populateRoles);
  before(populateUsers);
  beforeEach(async () => {
    token = await getToken();
  });
  describe('POST /activation', () => {
    it('should create an activation code', async () => {
      const payload = {
        userEmail: 'toto@test.com',
        newUserId: userList[3]._id
      };
      const res = await app.inject({
        method: 'POST',
        url: '/activation',
        payload,
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data.activationData).toEqual(expect.objectContaining({
        _id: expect.any(Object),
        firstSMS: expect.any(Date),
        newUserId: payload.newUserId,
        userEmail: payload.userEmail,
      }));
      const codeData = await ActivationCode.findById(res.result.data.activationData._id);
      expect(codeData).toEqual(expect.objectContaining({
        firstSMS: expect.any(Date),
        newUserId: payload.newUserId,
        userEmail: payload.userEmail
      }));
    });

    it("should return a 400 error if 'userEmail' parameter is missing", async () => {
      const payload = { newUserId: userList[3]._id };
      const res = await app.inject({
        method: 'POST',
        url: '/activation',
        payload,
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it("should return a 400 error if 'newUserId' is missing", async () => {
      const payload = { userEmail: 'toto@test.com' };
      const res = await app.inject({
        method: 'POST',
        url: '/activation',
        payload,
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /activation/{code}', () => {
    it('should check activation code provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/activation/${activationCode.code}`,
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.result.data).toEqual(expect.objectContaining({
        token: expect.any(String),
        activationData: expect.objectContaining({
          _id: activationCode._id,
          firstSMS: expect.any(Date),
          userEmail: activationCode.userEmail,
          newUserId: activationCode.newUserId,
        })
      }));
    });

    it('should return a 400 error if activation code is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/activation/987',
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(400);
    });

    it('should return a 404 error if activation code does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/activation/0987',
        headers: {
          'x-access-token': token
        }
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
