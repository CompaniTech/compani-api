const axios = require('axios');

exports.getDistanceMatrix = async ({ key, ...body }) => axios.post(
  'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
  body,
  {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration',
    },
  }
);
