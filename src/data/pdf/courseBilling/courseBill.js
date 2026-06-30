const { COPPER_600, PAYMENT } = require('../../../helpers/constants');
const UtilsPdfHelper = require('./utils');
const PdfHelper = require('../../../helpers/pdf');
const NumbersHelper = require('../../../helpers/numbers');
const CourseBillHelper = require('../../../helpers/courseBills');

exports.getPdfContent = async (bill) => {
  const { coursePayments, courseCreditNote } = bill;
  const { netExclTaxes, netInclTaxes } = CourseBillHelper.getNetInclTaxes(bill);
  const amountPaid = coursePayments
    .reduce(
      (acc, p) =>
        (p.nature === PAYMENT ? NumbersHelper.add(acc, p.netInclTaxes) : NumbersHelper.subtract(acc, p.netInclTaxes)),
      NumbersHelper.toString(0)
    );

  const vatAmount = bill.vat ? NumbersHelper.multiply(netExclTaxes, NumbersHelper.divide(bill.vat, 100)) : null;
  const totalBalance = courseCreditNote ? -amountPaid : NumbersHelper.subtract(netInclTaxes, amountPaid);
  const isPaid = !courseCreditNote && totalBalance <= 0;

  const [compani, signature] = await UtilsPdfHelper.getImages(isPaid);

  const header = UtilsPdfHelper.getHeader(bill, compani, true, isPaid);
  const feeTable = UtilsPdfHelper.getFeeTable(bill);
  const totalInfos = UtilsPdfHelper.getTotalInfos(netExclTaxes, netInclTaxes, bill.vat, vatAmount);
  const balanceInfos = UtilsPdfHelper.getBalanceInfos(courseCreditNote, amountPaid, netInclTaxes, totalBalance);

  const footer = [
    { text: 'Modes de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
    {
      text: '- Prélèvement ou virement bancaire, conformément aux CGP Compani s\'appliquant à la prestation objet de '
      + 'la présente facture',
      fontSize: 8,
    },
    { text: `- Pour les virements : IBAN : ${bill.vendorCompany.iban} / BIC : ${bill.vendorCompany.bic}`, fontSize: 8 },
    { text: 'Conditions de paiement', fontSize: 8, decoration: 'underline', marginTop: 8 },
    { text: '- Paiement à réception', fontSize: 8 },
    { text: '- Conditions d\'escompte : non applicable', fontSize: 8 },
    {
      text: '- Taux des pénalités de retard : trois fois le taux de l\'intérêt légal, majoré d\'une indemnité'
      + ' forfaitaire pour frais de recouvrement de 40 €',
      fontSize: 8,
    },
    {
      text: 'En tant qu\'organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
        + 'en vertu de l\'article 261 du Code Général des Impôts (CGI).',
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
      footer: UtilsPdfHelper.getFooter(bill.vendorCompany),
    },
    images: [compani, ...(isPaid ? [signature] : [])],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
