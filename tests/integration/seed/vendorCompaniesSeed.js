const VendorCompany = require('../../../src/models/VendorCompany');
const { vendorAdmin } = require('../../seed/authUsersSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/db');

const vendorCompany = {
  name: 'Test Company',
  siret: '12345678901234',
  activityDeclarationNumber: '13736343575',
  address: {
    fullAddress: '12 rue du test 92160 Antony',
    street: '12 rue du test',
    zipCode: '92160',
    city: 'Antony',
    location: { type: 'Point', coordinates: [2.377133, 48.801389] },
  },
  billingRepresentative: vendorAdmin._id,
};

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    VendorCompany.insertMany(vendorCompany),
  ]);
};

module.exports = {
  populateDB,
};
