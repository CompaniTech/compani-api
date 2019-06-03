const moment = require('moment');
const _ = require('lodash');

const Pay = require('../models/Pay');
const utils = require('./utils');

exports.exportPayHistory = async (startDate, endDate) => {
  const query = {
    endDate: { $lte: moment(endDate).endOf('d').toDate() },
    startDate: { $gte: moment(startDate).startOf('d').toDate() },
  };

  const pays = await Pay.find(query)
    .sort({ startDate: 'desc' })
    .populate({ path: 'auxiliary', select: 'identity sector', populate: { path: 'sector', select: 'name' } });

  const header = [
    'Auxiliaire',
    'Equipe',
    'Début',
    'Fin',
    'Heures contrat',
    'Heures travaillées',
    'Dont exo non majo',
    'Dont exo et majo',
    'Dont non exo et non majo',
    'Dont non exo et majo',
    'Solde heures',
    'Compteur',
    'Heures sup à payer',
    'Heures comp à payer',
    'Mutuelle',
    'Transport',
    'Autres frais',
    'Prime',
  ];

  const rows = [header];

  for (const pay of pays) {
    const cells = [
      utils.getFullTitleFromIdentity(_.get(pay.auxiliary, 'identity') || {}),
      _.get(pay.auxiliary, 'sector.name') || '',
      moment(pay.startDate).format('DD/MM/YYYY'),
      moment(pay.endDate).format('DD/MM/YYYY'),
      utils.formatFloatForExport(pay.contractHours),
      utils.formatFloatForExport(pay.workedHours),
      utils.formatFloatForExport(pay.notSurchargedAndExempt),
      utils.formatFloatForExport(pay.surchargedAndExempt),
      utils.formatFloatForExport(pay.notSurchargedAndNotExempt),
      utils.formatFloatForExport(pay.surchargedAndNotExempt),
      utils.formatFloatForExport(pay.hoursBalance),
      utils.formatFloatForExport(pay.hoursCounter),
      utils.formatFloatForExport(pay.overtimeHours),
      utils.formatFloatForExport(pay.additionalHours),
      pay.mutual ? 'Oui' : 'Non',
      utils.formatFloatForExport(pay.transport),
      utils.formatFloatForExport(pay.otherFees),
      utils.formatFloatForExport(pay.bonus),
    ];

    rows.push(cells);
  }

  return rows;
};
