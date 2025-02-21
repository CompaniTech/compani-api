const mongoose = require('mongoose');

const CompletionCertificateSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, immutable: true },
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  month: {
    type: String,
    required: true,
    immutable: true,
    validate: /^([0]{1}[1-9]{1}|[1]{1}[0-2]{1})-[2]{1}[0]{1}[0-9]{2}$/,
  },
});

module.exports = mongoose.model('CompletionCertificate', CompletionCertificateSchema);
