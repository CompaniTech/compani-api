const get = require('lodash/get');
const DistanceMatrix = require('../models/DistanceMatrix');
const maps = require('../models/Google/Maps');
const { TRANSIT, WALKING, DRIVING } = require('./constants');

exports.getDistanceMatrices = async credentials =>
  DistanceMatrix.find({ company: get(credentials, 'company._id') }).lean();

const TRAVEL_MODE = { [DRIVING]: 'DRIVE', [WALKING]: 'WALK', [TRANSIT]: 'TRANSIT' };

const parseDurationSeconds = duration => parseFloat(duration.replace('s', ''));

exports.isDistanceMatrixDefine = res => (res.status === 200 && get(res, 'data[0].condition') === 'ROUTE_EXISTS' &&
  get(res, 'data[0].distanceMeters') != null && !!get(res, 'data[0].duration'));

exports.createDistanceMatrix = async (params, companyId) => {
  let res;
  const { origins, destinations, mode } = params;
  const query = {
    origins: [{ waypoint: { address: origins } }],
    destinations: [{ waypoint: { address: destinations } }],
    travelMode: TRAVEL_MODE[mode],
    key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY,
  };
  if (params.mode === TRANSIT) {
    const transitRes = await maps.getDistanceMatrix(query);
    const walkingRes = await maps.getDistanceMatrix({ ...query, travelMode: TRAVEL_MODE[WALKING] });

    if (!exports.isDistanceMatrixDefine(transitRes) && !exports.isDistanceMatrixDefine(walkingRes)) return null;

    if (!exports.isDistanceMatrixDefine(transitRes)) res = walkingRes;
    else if (!exports.isDistanceMatrixDefine(walkingRes)) res = transitRes;
    else {
      const transitDuration = parseDurationSeconds(transitRes.data[0].duration);
      const walkingDuration = parseDurationSeconds(walkingRes.data[0].duration);
      res = transitDuration < walkingDuration ? transitRes : walkingRes;
    }
  } else {
    res = await maps.getDistanceMatrix(query);
  }

  if (!exports.isDistanceMatrixDefine(res)) return null;

  const payload = new DistanceMatrix({
    ...params,
    company: companyId,
    distance: res.data[0].distanceMeters,
    duration: parseDurationSeconds(res.data[0].duration),
  });
  const newDistanceMatrix = await payload.save();

  return newDistanceMatrix;
};
