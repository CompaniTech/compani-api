const Boom = require('@hapi/boom');
const StudyTrackHelper = require('../helpers/studyTracks');
const translate = require('../helpers/translate');

const { language } = translate;

const create = async (req) => {
  try {
    await StudyTrackHelper.create(req.payload);

    return { message: translate[language].studyTrackCreated };
  } catch (e) {
    req.log('error', e);
    return Boom.isBoom(e) ? e : Boom.badImplementation(e);
  }
};

module.exports = { create };
