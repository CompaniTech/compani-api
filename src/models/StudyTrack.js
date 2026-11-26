const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');
const { MILESTONE_TARGETS, STEP_TARGETS } = require('../helpers/constants');

const StudyTrackSchema = mongoose.Schema({
  name: { type: String },
  subProgram: { type: mongoose.Schema.Types.ObjectId, ref: 'SubProgram', required: true },
  isDefault: { type: Boolean, default: undefined },
  isReusable: { type: Boolean, default: undefined },
  detailsPerStep: {
    type: [{
      _id: false,
      step: { type: mongoose.Schema.Types.ObjectId, ref: 'Step', required: true },
      durations: { type: [Number], required: true },
      targets: { type: [{ type: String, enum: STEP_TARGETS }], default: undefined },
    }],
    default: undefined,
  },
  eLearningDurations: { type: [Number], default: undefined },
  milestones: {
    type: [{
      _id: false,
      month: { type: Number, required: true },
      label: { type: String, required: true },
      targets: { type: [{ type: String, enum: MILESTONE_TARGETS }], required: true },
    }],
    default: undefined,
  },
}, { timestamps: true, id: false });

StudyTrackSchema.index({ subProgram: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

queryMiddlewareList.map(middleware => StudyTrackSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('StudyTrack', StudyTrackSchema);
