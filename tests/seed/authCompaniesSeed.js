const { ObjectId } = require('mongodb');

const authCompany = {
  _id: new ObjectId(),
  name: 'Test SAS',
  prefixNumber: 101,
  iban: 'FR1814508000404462679354N69',
  bic: 'ERTYFRPP',
  folderId: '0987654321',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'mnbvcxz',
  auxiliariesFolderId: 'iuytre',
  address: {
    fullAddress: '37 rue de Ponthieu 75008 Paris',
    city: 'Paris',
    street: '37 rue de Ponthieu',
    zipCode: '75008',
    location: { type: 'Point', coordinates: [0, 0] },
  },
  subscriptions: { erp: true },
  debitMandates: [
    {
      _id: new ObjectId(),
      rum: 'R-10125060000188CF46476EE0F6F9B702',
      createdAt: '2025-06-03T14:00:00.000Z',
      signedAt: '2025-07-20T14:00:00.000Z',
      file: { publicId: 'fileId', link: 'unLienVersLeMandatSigné/fileId' },
    },
    {
      _id: new ObjectId(),
      rum: 'R-10125060000188CF46476EE0F6F9B702',
      createdAt: '2025-01-03T14:00:00.000Z',
    },
  ],
};

const otherCompany = {
  _id: new ObjectId(),
  name: 'Un autre SAS',
  prefixNumber: 106,
  iban: 'FR6212739000307216726685C63',
  bic: 'TYUIFRPP',
  folderId: '2345678901',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'zxcvbnm',
  auxiliariesFolderId: 'ijnuhb',
  address: {
    fullAddress: '12 rue de Ponthieu 75008 Paris',
    city: 'Paris',
    street: '12 rue de Ponthieu',
    zipCode: '75008',
    location: { type: 'Point', coordinates: [0, 0] },
  },
  subscriptions: { erp: true },
  debitMandates: [
    { _id: new ObjectId(), rum: 'R-10625060000188CF46476EE0F6F9B702', createdAt: '2025-06-03T14:00:00.000Z' },
  ],
};

const companyWithoutSubscription = {
  _id: new ObjectId(),
  name: 'Test SAS withtout subscription',
  prefixNumber: 103,
  iban: 'FR2714508000506961784681H75',
  bic: 'RTYUFRPP',
  folderId: '1234567890',
  directDebitsFolderId: '1234567890',
  customersFolderId: 'qwerty',
  auxiliariesFolderId: 'asdfgh',
  subscriptions: { erp: false },
  debitMandates: [
    { _id: new ObjectId(), rum: 'R-10325060000188CF46476EE0F6F9B702', createdAt: '2025-06-03T14:00:00.000Z' },
  ],
};

const authHolding = { _id: new ObjectId(), name: 'Auth Holding' };
const otherHolding = { _id: new ObjectId(), name: 'Other Holding' };

const companyHoldingList = [
  { _id: new ObjectId(), holding: authHolding._id, company: authCompany._id },
  { _id: new ObjectId(), holding: otherHolding._id, company: otherCompany._id },
  { _id: new ObjectId(), holding: otherHolding._id, company: companyWithoutSubscription._id },
];

module.exports = {
  authCompany,
  companyWithoutSubscription,
  otherCompany,
  authHolding,
  otherHolding,
  companyHoldingList,
};
