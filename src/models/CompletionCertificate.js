const mongoose = require('mongoose');
const { validateQuery } = require('./preHooks/validate');

const CompletionCertificateSchema = mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, immutable: true },
  trainee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  month: {
    type: String,
    required: true,
    immutable: true,
    validate: /^([0]{1}[1-9]{1}|[1]{1}[0-2]{1})-[2]{1}[0]{1}[0-9]{2}$/,
  },
  file: {
    publicId: { type: String, required() { return !!this.file.link; } },
    link: { type: String, trim: true, required() { return !!this.file.publicId; } },
  },
}, { timestamps: true });

CompletionCertificateSchema.pre('find', validateQuery);

module.exports = mongoose.model('CompletionCertificate', CompletionCertificateSchema);
