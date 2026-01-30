const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { DRAFT, PUBLISHED, EXPECTATIONS, END_OF_COURSE, SELF_POSITIONNING, ARCHIVED } = require('../helpers/constants');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const STATUS_TYPES = [DRAFT, PUBLISHED, ARCHIVED];
const QUESTIONNAIRE_TYPES = [EXPECTATIONS, END_OF_COURSE, SELF_POSITIONNING];

const QuestionnaireSchema = mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, default: DRAFT, enum: STATUS_TYPES },
  type: { type: String, required: true, enum: QUESTIONNAIRE_TYPES },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }],
  program: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  publishedAt: { type: Date },
  archivedAt: { type: Date },
}, { timestamps: true, id: false });

QuestionnaireSchema.virtual('histories', {
  ref: 'QuestionnaireHistory',
  localField: '_id',
  foreignField: 'questionnaire',
});

QuestionnaireSchema.virtual('historiesCount', {
  ref: 'QuestionnaireHistory',
  localField: '_id',
  foreignField: 'questionnaire',
  count: true,
});

// eslint-disable-next-line consistent-return
function setAreCardsValid() {
  if (!this.cards || this.cards.length === 0) return false;

  if (this.cards && this.cards.length && this.cards[0].template) { // if card is populated, template exists
    return this.cards.every(card => card.isValid);
  }
}

QuestionnaireSchema.virtual('areCardsValid').get(setAreCardsValid);
queryMiddlewareList.map(middleware => QuestionnaireSchema.pre(middleware, formatQuery));

QuestionnaireSchema.plugin(mongooseLeanVirtuals);
module.exports = mongoose.model('Questionnaire', QuestionnaireSchema);
module.exports.QUESTIONNAIRE_TYPES = QUESTIONNAIRE_TYPES;
