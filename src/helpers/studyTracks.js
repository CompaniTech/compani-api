const StudyTrack = require('../models/StudyTrack');

exports.create = async payload => StudyTrack.create({ ...payload, isDefault: true });
