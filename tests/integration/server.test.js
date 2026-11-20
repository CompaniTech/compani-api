const { expect } = require('expect');
const app = require('../../server');
const { SCAN_PATH_REGEX } = require('../../src/helpers/scanPathGuard');

describe('SCAN PATH GUARD', () => {
  it('should not have any registered route matching the scan-bot blocklist regex', () => {
    const matchingRoutes = app.table()
      .map(route => route.path)
      .filter(path => SCAN_PATH_REGEX.test(path));

    expect(matchingRoutes).toEqual([]);
  });

  it('should block a request whose resolved path matches the scan-bot blocklist', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/users/123/expo-token/.env' });

    expect(response.statusCode).toBe(403);
  });

  it('should not block a request whose resolved path does not match the scan-bot blocklist', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/users/123/expo-token/abcde' });

    expect(response.statusCode).not.toBe(403);
  });
});

describe('CORS', () => {
  it('should allow the webapp origin to call the api with credentials', async () => {
    const origin = process.env.WEBSITE_HOSTNAME;
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/users/forgot-password',
      headers: { origin, 'access-control-request-method': 'POST' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should allow the web version of the mobile app to call the api', async () => {
    const origin = process.env.MOBILE_WEBSITE_HOSTNAME;
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/users/forgot-password',
      headers: { origin, 'access-control-request-method': 'POST' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });

  it('should not allow another origin to call the api', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/users/forgot-password',
      headers: { origin: 'https://evil.example.com', 'access-control-request-method': 'POST' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
