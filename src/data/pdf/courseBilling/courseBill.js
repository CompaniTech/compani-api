const { COPPER_600, PAYMENT } = require('../../../helpers/constants');
const UtilsPdfHelper = require('./utils');
const PdfHelper = require('../../../helpers/pdf');
const CourseBillHelper = require('../../../helpers/courseBills');

exports.getPdfContent = async (bill) => {
  const { coursePayments, courseCreditNote } = bill;
  const netInclTaxes = CourseBillHelper.getNetInclTaxes(bill);
  const amountPaid = coursePayments
    .reduce((acc, p) => (p.nature === PAYMENT ? acc + p.netInclTaxes : acc - p.netInclTaxes), 0);
  const totalBalance = courseCreditNote ? -amountPaid : netInclTaxes - amountPaid;
  const isPaid = !courseCreditNote && totalBalance <= 0;

  const [compani, signature] = await UtilsPdfHelper.getImages(isPaid);

  const header = UtilsPdfHelper.getHeader(bill, compani, true, isPaid);
  const feeTable = UtilsPdfHelper.getFeeTable(bill);
  const totalInfos = UtilsPdfHelper.getTotalInfos(netInclTaxes);
  const balanceInfos = UtilsPdfHelper.getBalanceInfos(courseCreditNote, amountPaid, netInclTaxes, totalBalance);

  const footer = [
    { text: 'Modes de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
    { text: '- Prélèvement ou virement bancaire', fontSize: 8 },
    { text: `- Pour les virements : IBAN : ${bill.vendorCompany.iban} / BIC : ${bill.vendorCompany.bic}`, fontSize: 8 },
    { text: 'Conditions de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
    { text: '- 1er paiement à réception, le solde selon l’échéancier contractuel', fontSize: 8 },
    { text: '- Escompte en cas de paiement anticipé : aucun', fontSize: 8 },
    {
      text: '- Pénalité en cas de retard de paiement : trois fois le taux de l’intérêt légal, conformément aux '
      + 'dispositions légales en vigueur, majoré d’une indemnité  forfaitaire de 40€ pour frais de recouvrement',
      fontSize: 8,
    },
    {
      text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
        + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
      fontSize: 8,
      marginTop: 8,
    },
    ...(isPaid ? [{ image: signature, width: 112, marginTop: 8, alignment: 'right' }] : []),
  ];

  const content = [header, feeTable, totalInfos, balanceInfos, footer];

  return {
    template: {
      content: content.flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: COPPER_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
      },
    },
    images: [compani, ...(isPaid ? [signature] : [])],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
