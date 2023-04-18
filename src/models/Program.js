const mongoose = require('mongoose');
const { formatQuery, queryMiddlewareList } = require('./preHooks/validate');

const ProgramSchema = mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  learningGoals: { type: String },
  subPrograms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubProgram' }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  image: {
    publicId: { type: String, required() { return !!this.image.link; } },
    link: { type: String, trim: true, required() { return !!this.image.publicId; } },
  },
  testers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

queryMiddlewareList.map(middleware => ProgramSchema.pre(middleware, formatQuery));

module.exports = mongoose.model('Program', ProgramSchema);
