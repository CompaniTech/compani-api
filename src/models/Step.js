const mongoose = require('mongoose');
const has = require('lodash/has');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { E_LEARNING, ON_SITE, REMOTE, DRAFT, LIVE_STEPS } = require('../helpers/constants');
const { STATUS_TYPES } = require('./SubProgram');
const {
  formatQuery,
  queryMiddlewareList,
  getDocMiddlewareList,
  getDocListMiddlewareList,
} = require('./preHooks/validate');
const { CompaniDuration } = require('../helpers/dates/companiDurations');
const { formatSecondsToISODuration } = require('../helpers/dates/utils');

const STEP_TYPES = [E_LEARNING, ON_SITE, REMOTE];

const StepSchema = mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: STEP_TYPES },
  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Activity' }],
  status: { type: String, default: DRAFT, enum: STATUS_TYPES },
  theoreticalDuration: { type: Number },
}, { timestamps: true, id: false });

StepSchema.virtual('subPrograms', { ref: 'SubProgram', localField: '_id', foreignField: 'steps' });

// eslint-disable-next-line consistent-return
function setAreActivitiesValid() {
  const hasActivities = this.activities && this.activities.length !== 0;
  if (LIVE_STEPS.includes(this.type) && !hasActivities) return true;
  if (this.type === E_LEARNING && !hasActivities) return false;

  if (this.activities && this.activities.length && has(this.activities[0], 'areCardsValid')) {
    // if activity is populated, areCardsValid exists

    return this.activities.every(activity => activity.areCardsValid);
  }
}

function update() {
  const { theoreticalDuration } = this.getUpdate().$set;
  if (theoreticalDuration) {
    this.getUpdate().$set.theoreticalDuration = CompaniDuration(theoreticalDuration).asSeconds();
  }
}

function formatTheoreticalDuration(doc) {
  if (doc && doc.theoreticalDuration) {
    // eslint-disable-next-line no-param-reassign
    doc.theoreticalDuration = formatSecondsToISODuration(doc.theoreticalDuration);
  }
}

function formatTheoreticalDurationList(docs) {
  for (const doc of docs) {
    formatTheoreticalDuration(doc);
  }
}

StepSchema.pre('updateOne', update);
StepSchema.pre('updateMany', update);
StepSchema.pre('findOneAndUpdate', update);
StepSchema.virtual('areActivitiesValid').get(setAreActivitiesValid);
queryMiddlewareList.map(middleware => StepSchema.pre(middleware, formatQuery));
getDocMiddlewareList.map(middleware => StepSchema.post(middleware, formatTheoreticalDuration));
getDocListMiddlewareList.map(middleware => StepSchema.post(middleware, formatTheoreticalDurationList));

StepSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('Step', StepSchema);
module.exports.STEP_TYPES = STEP_TYPES;
