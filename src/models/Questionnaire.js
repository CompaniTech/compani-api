const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { DRAFT, PUBLISHED, EXPECTATIONS, END_OF_COURSE } = require('../helpers/constants');

const STATUS_TYPES = [DRAFT, PUBLISHED];
const QUESTIONNAIRE_TYPES = [EXPECTATIONS, END_OF_COURSE];

const QuestionnaireSchema = mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, default: DRAFT, enum: STATUS_TYPES },
  type: { type: String, required: true, enum: QUESTIONNAIRE_TYPES },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }],
}, { timestamps: true, id: false });

QuestionnaireSchema.virtual('histories', {
  ref: 'QuestionnaireHistory',
  localField: '_id',
  foreignField: 'questionnaire',
});

// eslint-disable-next-line consistent-return
function setAreCardsValid() {
  if (!this.cards || this.cards.length === 0) return false;

  if (this.cards && this.cards.length && this.cards[0].template) { // if card is populated, template exists
    return this.cards.every(card => card.isValid);
  }
}

QuestionnaireSchema.virtual('areCardsValid').get(setAreCardsValid);

QuestionnaireSchema.plugin(mongooseLeanVirtuals);
module.exports = mongoose.model('Questionnaire', QuestionnaireSchema);
module.exports.QUESTIONNAIRE_TYPES = QUESTIONNAIRE_TYPES;
