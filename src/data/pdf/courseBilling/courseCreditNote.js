const { ORANGE_600 } = require('../../../helpers/constants');
const UtilsPdfHelper = require('./utils');
const PdfHelper = require('../../../helpers/pdf');
const CourseBillHelper = require('../../../helpers/courseBills');
const UtilsHelper = require('../../../helpers/utils');

exports.getPdfContent = async (creditNote) => {
  const [compani] = await UtilsPdfHelper.getImages();
  const netInclTaxes = CourseBillHelper.getNetInclTaxes(creditNote);
  const header = UtilsPdfHelper.getHeader(creditNote, compani);
  const feeTable = UtilsPdfHelper.getFeeTable(creditNote);
  const totalInfos = UtilsPdfHelper.getTotalInfos(netInclTaxes);

  const footer = [
    {
      text: 'En tant qu’organisme de formation, Compani est exonéré de la Taxe sur la Valeur Ajoutée (TVA) '
        + 'en vertu de l’article 261 du Code Général des Impôts (CGI).',
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
      footer: {
        text:
          `${creditNote.vendorCompany.name} au capital social de `
          + `${UtilsHelper.formatPrice(creditNote.vendorCompany.shareCapital)} `
          + `- SIRET ${UtilsHelper.formatSiret(creditNote.vendorCompany.siret || '')}`,
        italics: true,
        fontSize: 8,
        marginTop: 24,
        marginRight: 16,
        alignment: 'center',
      },
    },
    images: [compani],
  };
};

exports.getPdf = async (data) => {
  const { template, images } = await exports.getPdfContent(data);

  return PdfHelper.generatePdf(template, images);
};
