const { ORANGE_600 } = require('../../../helpers/constants');
const UtilsPdfHelper = require('./utils');
const NumbersHelper = require('../../../helpers/numbers');
const PdfHelper = require('../../../helpers/pdf');
const CourseBillHelper = require('../../../helpers/courseBills');

exports.getPdfContent = async (creditNote) => {
  const [compani] = await UtilsPdfHelper.getImages();
  const header = UtilsPdfHelper.getHeader(creditNote, compani);
  const feeTable = UtilsPdfHelper.getFeeTable(creditNote);
  const netExclTaxes = CourseBillHelper.getNetInclTaxes(creditNote);
  const { vat } = creditNote.vendorCompany;
  const { subjectToVat } = creditNote.course.subProgram;
  const netInclTaxes = CourseBillHelper.getNetInclTaxes(creditNote, subjectToVat ? vat : null);
  const vatAmount = subjectToVat ? NumbersHelper.multiply(netExclTaxes, NumbersHelper.divide(vat, 100)) : null;

  const totalInfos = UtilsPdfHelper.getTotalInfos(netExclTaxes, netInclTaxes, vat, vatAmount);

  const footer = [
    {
      text: 'En tant qu\'organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
        + 'en vertu de l\'article 261 du Code Général des Impôts (CGI).',
      fontSize: 8,
      marginTop: 48,
    },
  ];

  const content = [header, feeTable, totalInfos, footer];

  return {
    template: {
      content: content.flat(),
      defaultStyle: { font: 'SourceSans', fontSize: 10 },
      styles: {
        header: { fillColor: ORANGE_600, color: 'white' },
        description: { alignment: 'left', marginLeft: 8, fontSize: 10 },
      },
      footer: UtilsPdfHelper.getFooter(creditNote.vendorCompany),
    },
    images: [compani],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
