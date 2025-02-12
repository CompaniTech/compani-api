const { expect } = require('expect');
const sinon = require('sinon');
const { ObjectId } = require('mongodb');
const omit = require('lodash/omit');
const pick = require('lodash/pick');
const UtilsHelper = require('../../../src/helpers/utils');

describe('getLastVersion', () => {
  it('should return the last version based on the date key', () => {
    const versions = [
      { startDate: '2021-09-21T00:00:00', createdAt: '2021-09-21T00:00:00', _id: 1 },
      { startDate: '2021-09-24T00:00:00', createdAt: '2021-09-18T00:00:00', _id: 2 },
    ];

    expect(UtilsHelper.getLastVersion(versions, 'startDate')).toBeDefined();
    expect(UtilsHelper.getLastVersion(versions, 'startDate')._id).toEqual(2);
    expect(UtilsHelper.getLastVersion(versions, 'createdAt')).toBeDefined();
    expect(UtilsHelper.getLastVersion(versions, 'createdAt')._id).toEqual(1);
  });

  it('should return null if versions is empty', () => {
    expect(UtilsHelper.getLastVersion([], 'toto')).toBeNull();
  });

  it('should return the single element if versions only contains one element', () => {
    const versions = [{ startDate: '2021-09-21T00:00:00', createdAt: '2021-09-21T00:00:00', _id: 1 }];

    const result = UtilsHelper.getLastVersion(versions, 'startDate');

    expect(result).toBeDefined();
    expect(result._id).toEqual(1);
  });
});

describe('getFirstVersion', () => {
  it('should return the first version based on the date key', () => {
    const versions = [
      { startDate: '2021-09-21T00:00:00', createdAt: '2021-09-21T00:00:00', _id: 1 },
      { startDate: '2021-09-24T00:00:00', createdAt: '2021-09-18T00:00:00', _id: 2 },
    ];

    expect(UtilsHelper.getFirstVersion(versions, 'startDate')).toBeDefined();
    expect(UtilsHelper.getFirstVersion(versions, 'startDate')._id).toEqual(1);
    expect(UtilsHelper.getFirstVersion(versions, 'createdAt')).toBeDefined();
    expect(UtilsHelper.getFirstVersion(versions, 'createdAt')._id).toEqual(2);
  });

  it('should return null if versions is empty', () => {
    expect(UtilsHelper.getFirstVersion([], 'toto')).toBeNull();
  });

  it('should return the single element if versions only contains one element', () => {
    const versions = [{ startDate: '2021-09-21T00:00:00', createdAt: '2021-09-21T00:00:00', _id: 1 }];

    const result = UtilsHelper.getFirstVersion(versions, 'startDate');

    expect(result).toBeDefined();
    expect(result._id).toEqual(1);
  });
});

describe('mergeLastVersionWithBaseObject', () => {
  let getLastVersion;
  beforeEach(() => {
    getLastVersion = sinon.stub(UtilsHelper, 'getLastVersion');
  });
  afterEach(() => {
    getLastVersion.restore();
  });

  it('should merge last version of given object with that same object', () => {
    const baseObj = { tpp: '123456', frequency: 'once', versions: [{ createdAt: '2021-09-21T00:00:00' }] };

    getLastVersion.returns(baseObj.versions[0]);

    const result = UtilsHelper.mergeLastVersionWithBaseObject(baseObj, 'createdAt');

    expect(result).toEqual(expect.objectContaining({ ...baseObj.versions[0], ...omit(baseObj, ['versions']) }));
    sinon.assert.calledWithExactly(getLastVersion, baseObj.versions, 'createdAt');
  });

  it('should throw an error if last version cannot be found', () => {
    const baseObj = { tpp: '123456', frequency: 'once', versions: [{ createdAt: '2021-09-21T00:00:00' }] };
    getLastVersion.returns(null);

    expect(() => UtilsHelper.mergeLastVersionWithBaseObject(baseObj, 'createdAt'))
      .toThrowError('Unable to find last version from base object !');
  });
});

describe('getMatchingVersion', () => {
  it('should return null if versions is empty', () => {
    expect(UtilsHelper.getMatchingVersion('2021-09-21T00:00:00', { versions: [] }, 'startDate')).toBeNull();
  });

  it('should return the matching version', () => {
    const obj = {
      versions: [
        { startDate: '2021-09-12T00:00:00', _id: 1 },
        { startDate: '2021-10-21T00:00:00', _id: 2 },
      ],
    };

    const result = UtilsHelper.getMatchingVersion('2021-09-21T00:00:00', obj, 'startDate');
    expect(result).toBeDefined();
    expect(result.versionId).toEqual(1);
  });

  it('should return the last matching version', () => {
    const obj = {
      versions: [
        { startDate: '2021-09-01T00:00:00', _id: 1 },
        { startDate: '2021-09-12T00:00:00', _id: 3 },
        { startDate: '2021-10-21T00:00:00', _id: 2 },
      ],
    };

    const result = UtilsHelper.getMatchingVersion('2021-09-21T00:00:00', obj, 'startDate');
    expect(result).toBeDefined();
    expect(result.versionId).toEqual(3);
  });

  it('should return null if no matching version', () => {
    const obj = {
      versions: [
        { startDate: '2021-09-12T00:00:00', endDate: '2021-09-13T00:00:00', _id: 1 },
        { startDate: '2021-10-21T00:00:00', _id: 2 },
      ],
    };

    expect(UtilsHelper.getMatchingVersion('2021-09-21T00:00:00', obj, 'startDate')).toBeNull();
  });
});

describe('getMatchingObject', () => {
  it('should return null if versions is empty', () => {
    expect(UtilsHelper.getMatchingObject('2021-09-21T00:00:00', [], 'startDate')).toBeNull();
  });

  it('should return the matching object', () => {
    const obj = [
      { startDate: '2021-09-12T00:00:00', _id: 1 },
      { startDate: '2021-10-12T00:00:00', _id: 2 },
    ];

    const result = UtilsHelper.getMatchingObject('2021-09-21T00:00:00', obj, 'startDate');
    expect(result).toBeDefined();
    expect(result._id).toEqual(1);
  });

  it('should return null if no matching version', () => {
    const obj = [
      { startDate: '2021-09-12T00:00:00', endDate: '2021-09-13T00:00:00', _id: 1 },
      { startDate: '2021-10-12T00:00:00', _id: 2 },
    ];

    expect(UtilsHelper.getMatchingObject('2021-09-21T00:00:00', obj, 'startDate')).toBeNull();
  });
});

describe('getFixedNumber', () => {
  it('should return number to string with number of decimals as provided by parameter', () => {
    const result = UtilsHelper.getFixedNumber(10, 2);
    expect(result).toBe('10.00');
  });

  it('should round number', () => {
    const result = UtilsHelper.getFixedNumber(10.175, 2);
    expect(result).toBe('10.18');
  });
});

describe('removeSpaces', () => {
  it('should remove all spaces from string', () => {
    const result = UtilsHelper.removeSpaces('he llo  world  ');
    expect(result).toBe('helloworld');
  });

  it('should return an empty string if parameter is missing', () => {
    const result = UtilsHelper.removeSpaces();
    expect(result).toBe('');
  });
});

describe('formatPrice', () => {
  it('should format price', () => {
    const res = UtilsHelper.formatPrice('595.7549999999999838');
    expect(res).toEqual('595,75\u00a0€');
  });

  it('should format price for 0', () => {
    const res = UtilsHelper.formatPrice(0);
    expect(res).toEqual('0,00\u00a0€');
  });
});

describe('roundFrenchNumber', () => {
  it('should round french number', () => {
    const res = UtilsHelper.roundFrenchNumber('595.7549999999999838', 2);
    expect(res).toEqual('595,75');
  });

  it('should round french number with 5 digits', () => {
    const res = UtilsHelper.roundFrenchNumber('12.256343213', 5);
    expect(res).toEqual('12,25634');
  });
});

describe('formatPercentage', () => {
  it('should format percentage', () => {
    const res = UtilsHelper.formatPercentage('0.344449999999999999999');
    expect(res).toEqual('34,44\u00a0%');
  });

  it('should format percentage for 0', () => {
    const res = UtilsHelper.formatPercentage(0);
    expect(res).toEqual('0,00\u00a0%');
  });
});

describe('formatHour', () => {
  it('should format hour', () => {
    const res = UtilsHelper.formatHour(5.5);
    expect(res).toEqual('5,50h');
  });
});

describe('getFullTitleFromIdentity', () => {
  const identityBase = {
    title: 'mr',
    firstname: 'Bojack',
    lastname: 'Horseman',
  };

  it('should return the title, the firstname and the name', () => {
    const result = UtilsHelper.getFullTitleFromIdentity(identityBase);
    expect(result).toBe('M. Bojack HORSEMAN');
  });

  it('should return the title and the lastname', () => {
    const result = UtilsHelper.getFullTitleFromIdentity(omit(identityBase, 'firstname'));
    expect(result).toBe('M. HORSEMAN');
  });

  it('should return the firstname and the name', () => {
    const result = UtilsHelper.getFullTitleFromIdentity(omit(identityBase, 'title'));
    expect(result).toBe('Bojack HORSEMAN');
  });

  it('should return the firstname', () => {
    const result = UtilsHelper.getFullTitleFromIdentity(pick(identityBase, 'firstname'));
    expect(result).toBe('Bojack');
  });

  it('should return the lastname', () => {
    const result = UtilsHelper.getFullTitleFromIdentity(pick(identityBase, 'lastname'));
    expect(result).toBe('HORSEMAN');
  });

  it('should return an empty string if the identity is not provided', () => {
    expect(UtilsHelper.getFullTitleFromIdentity()).toBe('');
  });
});

describe('formatFloatForExport', () => {
  const validCases = [[0, '0,00'], [1, '1,00'], [7.1, '7,10'], [3.56, '3,56'], [4.23506, '4,24'], [4.23400, '4,23']];
  const invalidValues = [null, undefined, NaN, ''];

  validCases.forEach(([param, result]) => {
    it('should return a formatted float on a valid float', () => {
      expect(UtilsHelper.formatFloatForExport(param)).toBe(result);
    });
  });

  invalidValues.forEach((param) => {
    it('should return an empty string on an invalid value', () => {
      expect(UtilsHelper.formatFloatForExport(param)).toBe('');
    });
  });
});

describe('flatQuery', () => {
  it('should return flatten object', () => {
    const payerId = new ObjectId();
    const payload = { card: { text: 'text' }, payer: { company: payerId } };

    const result = UtilsHelper.flatQuery(payload);

    expect(result).toEqual({ 'card.text': 'text', 'payer.company': payerId });
  });
});

describe('areObjectIdsEquals', () => {
  it('should return true if object ids are the same', () => {
    const id1 = new ObjectId();
    const id2 = id1.toHexString();

    const result = UtilsHelper.areObjectIdsEquals(id1, id2);

    expect(result).toBe(true);
  });

  it('should return false if object ids are not the same', () => {
    const id1 = new ObjectId();
    const id2 = new ObjectId().toHexString();

    const result = UtilsHelper.areObjectIdsEquals(id1, id2);

    expect(result).toBe(false);
  });

  it('should return false if one object id is missing', () => {
    const id1 = '';
    const id2 = new ObjectId().toHexString();

    const result = UtilsHelper.areObjectIdsEquals(id1, id2);

    expect(result).toBe(false);
  });

  it('should return false if both object ids are missing', () => {
    const id1 = '';
    const id2 = '';

    const result = UtilsHelper.areObjectIdsEquals(id1, id2);

    expect(result).toBe(false);
  });
});

describe('doesArrayIncludeId', () => {
  let areObjectIdsEqualStub;

  beforeEach(() => { areObjectIdsEqualStub = sinon.stub(UtilsHelper, 'areObjectIdsEquals'); });

  afterEach(() => { areObjectIdsEqualStub.restore(); });

  it('should return true if the array includes the id', () => {
    const correctId = new ObjectId();
    const incorrectId = new ObjectId();
    areObjectIdsEqualStub.onCall(0).returns(false);
    areObjectIdsEqualStub.onCall(1).returns(true);

    const result = UtilsHelper.doesArrayIncludeId([incorrectId, correctId], correctId);

    expect(result).toBe(true);
    sinon.assert.calledWithExactly(areObjectIdsEqualStub.getCall(0), incorrectId, correctId);
    sinon.assert.calledWithExactly(areObjectIdsEqualStub.getCall(1), correctId, correctId);
  });

  it('should return false if the array does not include the id', () => {
    areObjectIdsEqualStub.onCall(0).returns(false);
    areObjectIdsEqualStub.onCall(1).returns(false);

    const result = UtilsHelper.doesArrayIncludeId([new ObjectId(), new ObjectId()], new ObjectId());

    expect(result).toBe(false);
  });

  it('should return false if no array', () => {
    const result = UtilsHelper.doesArrayIncludeId(undefined, new ObjectId());

    expect(result).toBe(false);
    sinon.assert.notCalled(areObjectIdsEqualStub);
  });
});

describe('isStringedObjectId', () => {
  it('should return true if value objectId to HexString', () => {
    const value = new ObjectId().toHexString();

    const result = UtilsHelper.isStringedObjectId(value);

    expect(result).toBe(true);
  });

  it('should return true if value is a 14-digit hexadecimal number put into a string', () => {
    const value = '12A22F32AB1094ABCDE12345';

    const result = UtilsHelper.isStringedObjectId(value);

    expect(result).toBe(true);
  });

  it('should return false if value is random string', () => {
    const value = 'toto';

    const result = UtilsHelper.isStringedObjectId(value);

    expect(result).toBe(false);
  });
});

describe('getExclTaxes', () => {
  it('should return excluded taxes price', () => {
    const result = UtilsHelper.getExclTaxes(20, 25);

    expect(result).toEqual('16');
  });
});

describe('sumReduce', () => {
  it('should sum element in array', () => {
    const result = UtilsHelper.sumReduce([{ incl: 20 }, { incl: 12, excl: 23 }], 'incl');

    expect(result).toEqual('32');
  });
});

describe('computeExclTaxesWithDiscount', () => {
  it('should return excluded taxes price with discount', () => {
    const result = UtilsHelper.computeExclTaxesWithDiscount(18, 1.2, 20);
    expect(result).toEqual('14');
  });
});

describe('getTotalDuration', () => {
  it('should return duration with minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:00:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:30:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDuration(slots);

    expect(result).toEqual('4h30');
  });

  it('should return duration with leading zero minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:08:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:00:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDuration(slots);

    expect(result).toEqual('4h08');
  });

  it('should return duration without minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:00:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:00:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDuration(slots);

    expect(result).toEqual('4h');
  });

  it('should return duration without hours', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T09:15:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T09:30:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDuration(slots);

    expect(result).toEqual('0h45');
  });

  it('should return duration with days', () => {
    const slots = [
      { startDate: '2020-03-20T07:00:00.000Z', endDate: '2020-03-20T22:00:00.000Z' },
      { startDate: '2020-04-21T07:00:00.000Z', endDate: '2020-04-21T22:00:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDuration(slots);

    expect(result).toEqual('30h');
  });
});

describe('getISOTotalDuration', () => {
  it('should return duration in seconds with ISO format', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:00:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:30:00.000Z' },
    ];

    const result = UtilsHelper.getISOTotalDuration(slots);

    expect(result).toEqual('PT16200S');
  });
});

describe('getTotalDurationForExport', () => {
  it('should return duration with minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:00:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:30:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDurationForExport(slots);

    expect(result).toEqual('4,50');
  });

  it('should return duration without minutes', () => {
    const slots = [
      { startDate: '2020-03-20T09:00:00.000Z', endDate: '2020-03-20T11:00:00.000Z' },
      { startDate: '2020-04-21T09:00:00.000Z', endDate: '2020-04-21T11:00:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDurationForExport(slots);

    expect(result).toEqual('4,00');
  });

  it('should return duration with days', () => {
    const slots = [
      { startDate: '2020-03-20T07:00:00.000Z', endDate: '2020-03-20T22:00:00.000Z' },
      { startDate: '2020-04-21T07:00:00.000Z', endDate: '2020-04-21T22:00:00.000Z' },
    ];

    const result = UtilsHelper.getTotalDurationForExport(slots);

    expect(result).toEqual('30,00');
  });
});

describe('getDuration', () => {
  it('should return duration with minutes', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:30:00.000Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('2h30');
  });

  it('should return duration with leading zero minutes', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:08:00.000Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('2h08');
  });

  it('should return duration without minutes', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:00:00.000Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('2h');
  });

  it('should return duration without hours', () => {
    const startDate = '2020-03-20T10:15:00.000Z';
    const endDate = '2020-03-20T11:00:00.000Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('0h45');
  });

  it('should return duration with days', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-21T15:00:00.000Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('30h');
  });

  it('should return duration with meaningless second', () => {
    const startDate = '2020-03-20T09:00:04.230Z';
    const endDate = '2020-03-20T11:00:33.125Z';

    const result = UtilsHelper.getDuration(startDate, endDate);

    expect(result).toEqual('2h');
  });
});

describe('getDurationForExport', () => {
  it('should return duration with minutes', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:30:00.000Z';

    const result = UtilsHelper.getDurationForExport(startDate, endDate);

    expect(result).toEqual('2,50');
  });

  it('should return duration without minutes', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:00:00.000Z';

    const result = UtilsHelper.getDurationForExport(startDate, endDate);

    expect(result).toEqual('2,00');
  });

  it('should return duration with days', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-21T15:00:00.000Z';

    const result = UtilsHelper.getDurationForExport(startDate, endDate);

    expect(result).toEqual('30,00');
  });

  it('should return duration with seconds', () => {
    const startDate = '2020-03-20T09:00:00.000Z';
    const endDate = '2020-03-20T11:00:31.230Z';

    const result = UtilsHelper.getDurationForExport(startDate, endDate);

    expect(result).toEqual('2,01');
  });
});

describe('getKeysOf2DepthObject', () => {
  it('should return keys of 1 depth object', () => {
    const nestedObject = {
      _id: new ObjectId(),
      starter: 3,
      dish: 2,
      dessert: 6,
      drink: [1, 3, 1, 2],
    };

    const result = UtilsHelper.getKeysOf2DepthObject(nestedObject);

    expect(result).toEqual(['_id', 'starter', 'dish', 'dessert', 'drink']);
  });

  it('should return keys of 2 depth object', () => {
    const nestedObject = {
      starter: 3,
      dish: {
        fishStew: 9,
      },
      dessert: {
        cake: 1,
        pie: 5,
      },
    };

    const result = UtilsHelper.getKeysOf2DepthObject(nestedObject);

    expect(result).toEqual(['starter', 'dish.fishStew', 'dessert.cake', 'dessert.pie']);
  });
});

describe('sortStrings', () => {
  it('should return a negative number if a > b', () => {
    const result = UtilsHelper.sortStrings('abc', 'bcd');

    expect(result).toBeLessThan(0);
  });

  it('should return a positive number if a < b', () => {
    const result = UtilsHelper.sortStrings('bcd', 'abc');

    expect(result).toBeGreaterThan(0);
  });

  it('should return 0 if a === b', () => {
    const result = UtilsHelper.sortStrings('abc', 'abc');

    expect(result).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('should return plural label with default plural mark', () => {
    const result = UtilsHelper.formatQuantity('formation', 4);

    expect(result).toBe('4 formations');
  });

  it('should return plural label with other plural mark', () => {
    const result = UtilsHelper.formatQuantity('créneau', 4, 'x');

    expect(result).toBe('4 créneaux');
  });

  it('should return plural label without quantity', () => {
    const result = UtilsHelper.formatQuantity('formation', 4, 's', false);

    expect(result).toBe('formations');
  });
});

describe('hasUserAccessToCompany', () => {
  const company = new ObjectId();

  it('should return true if user is in same company', () => {
    const credentials = { company: { _id: company } };

    const result = UtilsHelper.hasUserAccessToCompany(credentials, company);

    expect(result).toBeTruthy();
  });

  it('should return true if company is in user holding', () => {
    const credentials = { holding: { _id: new ObjectId(), companies: [company, new ObjectId()] } };

    const result = UtilsHelper.hasUserAccessToCompany(credentials, company);

    expect(result).toBeTruthy();
  });

  it('should return false if user is in another company and company is not in holding', () => {
    const credentials = {
      company: { _id: new ObjectId() },
      holding: { _id: new ObjectId(), companies: [new ObjectId(), new ObjectId()] },
    };

    const result = UtilsHelper.hasUserAccessToCompany(credentials, company);

    expect(result).toBeFalsy();
  });

  it('should return false if user doesn\'t have company or holding', () => {
    const credentials = { company: null, holding: null };

    const result = UtilsHelper.hasUserAccessToCompany(credentials, company);

    expect(result).toBeFalsy();
  });
});
