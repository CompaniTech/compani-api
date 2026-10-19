const mongoose = require('mongoose');
const addressSchemaDefinition = require('./address');

// address fields are encrypted, so location cannot be array of Number
module.exports = {
  ...addressSchemaDefinition,
  location: { type: mongoose.Schema.Types.Mixed, required: true },
};
