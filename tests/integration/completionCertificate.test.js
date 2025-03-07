const { expect } = require('expect');
const app = require('../../server');
const { getToken } = require('./helpers/authentication');
const { populateDB } = require('./seed/coursesSeed');

describe('NODE ENV', () => {
  it('should be \'test\'', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('TRAINING_ORGANISATION_MANAGER', () => {
  let authToken;
  beforeEach(populateDB);

  beforeEach(async () => {
    authToken = await getToken('training_organisation_manager');
  });

  it('should get completion certificates by month #tag', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/completioncertificates?months=06-2024',
      headers: { Cookie: `alenvi_token=${authToken}` },
    });

    expect(response.statusCode).toBe(200);
  });
});
