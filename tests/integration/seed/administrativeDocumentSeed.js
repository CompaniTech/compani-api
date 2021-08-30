const { ObjectID } = require('mongodb');
const AdministrativeDocument = require('../../../src/models/AdministrativeDocument');
const { authCompany, otherCompany } = require('../../seed/authCompaniesSeed');
const { deleteNonAuthenticationSeeds } = require('../helpers/authentication');

const administrativeDocumentsList = [
  {
    _id: new ObjectID(),
    company: authCompany._id,
    name: 'test',
    driveFile: { driveId: '1234', link: 'www.test.fr' },
  },
  {
    _id: new ObjectID(),
    company: authCompany._id,
    name: 'paie',
    driveFile: { driveId: '4567', link: 'www.1234.fr' },
  },
  {
    _id: new ObjectID(),
    company: otherCompany._id,
    name: 'contrat',
    driveFile: { driveId: '9876', link: 'www.alenvi.fr' },
  },
];

const populateDB = async () => {
  await deleteNonAuthenticationSeeds();

  await Promise.all([
    AdministrativeDocument.create(administrativeDocumentsList),
  ]);
};

module.exports = {
  administrativeDocumentsList,
  populateDB,
};
