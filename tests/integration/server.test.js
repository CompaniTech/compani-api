const { expect } = require('expect');
const app = require('../../server');

describe('SCAN PATH GUARD', () => {
  it('should not have any registered route matching the scan-bot blocklist regex', () => {
    const matchingRoutes = app.table()
      .map(route => route.path)
      .filter(path => app.scanPathRegex.test(path));

    expect(matchingRoutes).toEqual([]);
  });
});
