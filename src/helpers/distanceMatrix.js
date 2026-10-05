const get = require('lodash/get');
const DistanceMatrix = require('../models/DistanceMatrix');
const maps = require('../models/Google/Maps');
const { TRANSIT, WALKING, DRIVING } = require('./constants');

exports.getDistanceMatrices = async credentials =>
  DistanceMatrix.find({ company: get(credentials, 'company._id') }).lean();

const TRAVEL_MODE = { [DRIVING]: 'DRIVE', [WALKING]: 'WALK', [TRANSIT]: 'TRANSIT' };

const parseDurationSeconds = duration => parseFloat(duration.replace('s', ''));

exports.isDistanceMatrixDefine = res => (res.status === 200 && get(res, 'data[0].condition') === 'ROUTE_EXISTS' &&
  !!get(res, 'data[0].duration'));

const computeDistance = async (params) => {
  const { origins, destinations, mode } = params;
  const query = {
    origins: [{ waypoint: { address: origins } }],
    destinations: [{ waypoint: { address: destinations } }],
    travelMode: TRAVEL_MODE[mode],
    key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY,
  };
  const res = await maps.getDistanceMatrix(query);
  if (!exports.isDistanceMatrixDefine(res)) return null;

  return { distance: res.data[0].distanceMeters || 0, duration: parseDurationSeconds(res.data[0].duration) };
};

exports.createDistanceMatrix = async (params, companyId = null) => {
  let res;
  if (params.mode === TRANSIT) {
    const transitRes = await computeDistance(params);
    const walkingRes = await computeDistance({ ...params, mode: WALKING });

    if (!transitRes && !walkingRes) return null;

    if (!transitRes) res = walkingRes;
    else if (!walkingRes) res = transitRes;
    else res = transitRes.duration < walkingRes.duration ? transitRes : walkingRes;
  } else {
    res = await computeDistance(params);
  }

  if (!res) return null;

  const payload = new DistanceMatrix({ ...params, ...companyId && { company: companyId }, ...res });
  const newDistanceMatrix = await payload.save();

  return newDistanceMatrix;
};

exports.getOrCreateDistanceMatrix = async (params) => {
  const distanceMatrix = await DistanceMatrix.findOne(params).lean();
  if (distanceMatrix) return distanceMatrix;

  return exports.createDistanceMatrix(params);
};
