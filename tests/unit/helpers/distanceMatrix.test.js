const expect = require('expect');
const { ObjectId } = require('mongodb');
const sinon = require('sinon');

const DistanceMatrixHelper = require('../../../src/helpers/distanceMatrix');
const DistanceMatrix = require('../../../src/models/DistanceMatrix');
const maps = require('../../../src/models/Google/Maps');
const SinonMongoose = require('../sinonMongoose');

describe('getDistanceMatrices', () => {
  const distanceMatrix = {
    data: {
      rows: [{ elements: [{ distance: { value: 363998 }, duration: { value: 13790 } }] }],
    },
    status: 200,
  };
  const companyId = new ObjectId();
  let find;

  beforeEach(() => {
    find = sinon.stub(DistanceMatrix, 'find');
  });
  afterEach(() => {
    find.restore();
  });

  it('should return a distance matrix', async () => {
    find.returns(SinonMongoose.stubChainedQueries(distanceMatrix, ['lean']));

    const credentials = { company: { _id: companyId } };
    const result = await DistanceMatrixHelper.getDistanceMatrices(credentials);

    expect(result).toEqual(distanceMatrix);
    SinonMongoose.calledOnceWithExactly(find, [{ query: 'find', args: [{ company: companyId }] }, { query: 'lean' }]);
  });
});

describe('createDistanceMatrix', () => {
  const distanceMatrixRequest = {
    origins: 'Washington, DC',
    destinations: 'New York City, NY',
    mode: 'driving',
  };
  const distanceMatrixTransitRequest = {
    origins: 'Washington, DC',
    destinations: 'New York City, NY',
    mode: 'transit',
  };
  const distanceMatrixResult = {
    data: {
      rows: [{
        elements: [{
          distance: { value: 363998 },
          duration: { value: 13790 },
        }],
      }],
    },
    status: 200,
  };
  const distanceMatrixWalkingResult = {
    data: {
      rows: [{
        elements: [{
          distance: { value: 363970 },
          duration: { value: 12790 },
        }],
      }],
    },
    status: 200,
  };
  const companyId = new ObjectId();
  let save;
  let getDistanceMatrix;

  beforeEach(() => {
    save = sinon.stub(DistanceMatrix.prototype, 'save').returnsThis();
    getDistanceMatrix = sinon.stub(maps, 'getDistanceMatrix');
  });

  afterEach(() => {
    save.restore();
    getDistanceMatrix.restore();
  });

  it('should return a new DistanceMatrix', async () => {
    getDistanceMatrix.returns(distanceMatrixResult);

    const result = await DistanceMatrixHelper.createDistanceMatrix(distanceMatrixRequest, companyId);

    sinon.assert.calledOnce(save);
    sinon.assert.calledOnceWithExactly(
      getDistanceMatrix,
      { ...distanceMatrixRequest, key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY }
    );
    expect(result).toEqual(expect.objectContaining({
      company: companyId,
      _id: expect.any(Object),
      destinations: 'New York City, NY',
      distance: 363998,
      duration: 13790,
      origins: 'Washington, DC',
      mode: 'driving',
    }));
  });

  it('should return minimum duration between walking and transit', async () => {
    getDistanceMatrix.onCall(0).returns(distanceMatrixResult);
    getDistanceMatrix.onCall(1).returns(distanceMatrixWalkingResult);

    const result = await DistanceMatrixHelper.createDistanceMatrix(distanceMatrixTransitRequest, companyId);

    sinon.assert.calledOnce(save);
    sinon.assert.calledWithExactly(
      getDistanceMatrix.getCall(0),
      { ...distanceMatrixTransitRequest, key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY }
    );
    sinon.assert.calledWithExactly(
      getDistanceMatrix.getCall(1),
      { ...distanceMatrixTransitRequest, key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY, mode: 'walking' }
    );
    expect(result).toEqual(expect.objectContaining({
      company: companyId,
      _id: expect.any(Object),
      destinations: 'New York City, NY',
      distance: 363970,
      duration: 12790,
      origins: 'Washington, DC',
      mode: 'transit',
    }));
  });

  it('should return null if distance or duration is not defined', async () => {
    getDistanceMatrix.returns({ data: { rows: [{ elements: [{ duration: { value: 13790 } }] }] }, status: 200 });

    const result = await DistanceMatrixHelper.createDistanceMatrix(distanceMatrixRequest, companyId);

    sinon.assert.notCalled(save);
    sinon.assert.calledOnceWithExactly(
      getDistanceMatrix,
      { ...distanceMatrixRequest, key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY }
    );
    expect(result).toEqual(null);
  });
});
