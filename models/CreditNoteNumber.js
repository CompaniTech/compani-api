const mongoose = require('mongoose');

const CreditNoteNumberSchema = mongoose.Schema({
  prefix: String,
  seq: { type: Number, default: 1 },
});

module.exports = mongoose.model('CreditNoteNumber', CreditNoteNumberSchema);
