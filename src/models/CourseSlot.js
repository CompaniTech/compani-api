const mongoose = require('mongoose');
const addressSchemaDefinition = require('./schemaDefinitions/address');

const CourseSlotSchema = mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  startDate: { type: Date, required () { return this.endDate } },
  endDate: { type: Date, required () { return this.startDate } },
  address: { type: mongoose.Schema(addressSchemaDefinition, { _id: false, id: false }) },
}, { timestamps: true });

module.exports = mongoose.model('CourseSlot', CourseSlotSchema);
