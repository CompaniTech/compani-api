const get = require('lodash/get');
const DistanceMatrix = require('../models/DistanceMatrix');
const maps = require('../models/Google/Maps');
const { TRANSIT, WALKING } = require('./constants');

exports.getDistanceMatrices = async credentials =>
  DistanceMatrix.find({ company: get(credentials, 'company._id') }).lean();

const isDistanceMatrixDefine = res => (res.status === 200 && get(res, 'data.rows[0].elements[0].distance') &&
  get(res, 'data.rows[0].elements[0].duration'));

exports.createDistanceMatrix = async (params, companyId) => {
  let res;
  const query = { ...params, key: process.env.GOOGLE_CLOUD_PLATFORM_API_KEY };
  if (params.mode === TRANSIT) {
    const transitRes = await maps.getDistanceMatrix(query);
    const walkingRes = await maps.getDistanceMatrix({ ...query, mode: WALKING });

    if (!isDistanceMatrixDefine(transitRes) && !isDistanceMatrixDefine(walkingRes)) return null;

    if (!isDistanceMatrixDefine(transitRes)) res = walkingRes;
    else if (!isDistanceMatrixDefine(walkingRes)) res = transitRes;
    else {
      const transitDuration = transitRes.data.rows[0].elements[0].duration.value;
      const walkingDuration = walkingRes.data.rows[0].elements[0].duration.value;
      res = transitDuration < walkingDuration ? transitRes : walkingRes;
    }
  } else {
    res = await maps.getDistanceMatrix(query);
  }

  if (!isDistanceMatrixDefine(res)) return null;

  const payload = new DistanceMatrix({
    ...params,
    company: companyId,
    distance: res.data.rows[0].elements[0].distance.value,
    duration: res.data.rows[0].elements[0].duration.value,
  });
  const newDistanceMatrix = await payload.save();

  return newDistanceMatrix;
};
