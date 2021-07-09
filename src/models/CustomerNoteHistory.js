const mongoose = require('mongoose');
const { NOTE_CREATION } = require('../helpers/constants');

const CustomerNoteHistorySchema = mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
  customerNote: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerNote', required: true, immutable: true },
  title: { type: String, required() { return this.action === NOTE_CREATION; }, immutable: true },
  description: { type: String, required() { return this.action === NOTE_CREATION; }, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  action: { type: String, required: true, immutable: true, enum: [NOTE_CREATION] },
}, { timestamps: true });

module.exports = mongoose.model('CustomerNoteHistory', CustomerNoteHistorySchema);
