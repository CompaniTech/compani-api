const mongoose = require('mongoose');
const has = require('lodash/has');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { DRAFT, PUBLISHED, E_LEARNING } = require('../helpers/constants');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const STATUS_TYPES = [DRAFT, PUBLISHED];

const SubProgramSchema = mongoose.Schema({
  name: { type: String, required: true },
  steps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Step' }],
  status: { type: String, default: DRAFT, enum: STATUS_TYPES },
  priceVersions: [{
    _id: false,
    prices: [{
      _id: false,
      step: { type: mongoose.Schema.Types.ObjectId, ref: 'Step', required: true },
      hourlyAmount: { type: Number, required: true },
    }],
    effectiveDate: { type: Date, required: true },
  }],
}, { timestamps: true, id: false });

SubProgramSchema.virtual('program', {
  ref: 'Program',
  localField: '_id',
  foreignField: 'subPrograms',
  justOne: true,
});

SubProgramSchema.virtual('courses', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'subProgram',
});

function setIsStrictlyELearning() {
  if (this.steps && this.steps.length && this.steps[0].type) {
    return this.steps.every(step => step.type === E_LEARNING);
  }

  return false;
}

// eslint-disable-next-line consistent-return
function setAreStepsValid() {
  if (this.steps && this.steps.length === 0) return false;

  if (this.steps && this.steps.length && has(this.steps[0], 'areActivitiesValid')) {
    // if step is populated, areActivitiesValid exists

    return this.steps.every(step => step.areActivitiesValid && !!step.theoreticalDuration);
  }
}

SubProgramSchema.virtual('areStepsValid').get(setAreStepsValid);

SubProgramSchema.virtual('isStrictlyELearning').get(setIsStrictlyELearning);

queryMiddlewareList.map(middleware => SubProgramSchema.pre(middleware, formatQuery));

SubProgramSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('SubProgram', SubProgramSchema);
module.exports.STATUS_TYPES = STATUS_TYPES;
