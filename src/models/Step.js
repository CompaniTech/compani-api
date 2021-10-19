const mongoose = require('mongoose');
const has = require('lodash/has');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { E_LEARNING, ON_SITE, REMOTE, DRAFT, LIVE_STEPS } = require('../helpers/constants');
const { STATUS_TYPES } = require('./SubProgram');

const STEP_TYPES = [E_LEARNING, ON_SITE, REMOTE];

const StepSchema = mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: STEP_TYPES },
  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }],
  status: { type: String, default: DRAFT, enum: STATUS_TYPES },
}, { timestamps: true, id: false });

StepSchema.virtual('subProgram', {
  ref: 'SubProgram',
  localField: '_id',
  foreignField: 'steps',
  justOne: true,
});

StepSchema.virtual('courseSlotsCount', {
  ref: 'CourseSlot',
  localField: '_id',
  foreignField: 'step',
  count: true,
});

// eslint-disable-next-line consistent-return
function setAreActivitiesValid() {
  const hasActivities = this.activities && this.activities.length !== 0;
  if (LIVE_STEPS.includes(this.type) && !hasActivities) return true;
  if (this.type === E_LEARNING && !hasActivities) return false;

  if (this.activities && this.activities.length && has(this.activities[0], 'areCardsValid')) {
    return this.activities.every(activity => activity.areCardsValid);
  }
}

StepSchema.virtual('areActivitiesValid').get(setAreActivitiesValid);

StepSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('Step', StepSchema);
module.exports.STEP_TYPES = STEP_TYPES;
