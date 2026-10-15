const { PEACH_100 } = require('../../../helpers/constants');
const FileHelper = require('../../../helpers/file');

exports.getImages = async () => {
  const imageList = [
    { url: 'https://storage.googleapis.com/compani-main/aux-conscience-eclairee.png', name: 'conscience.png' },
    { url: 'https://storage.googleapis.com/compani-main/icons/compani_texte_bleu.png', name: 'compani.png' },
    { url: 'https://storage.googleapis.com/compani-main/aux-prisededecision.png', name: 'decision.png' },
    { url: 'https://storage.googleapis.com/compani-main/tsb_signature.png', name: 'signature.png' },
  ];

  return FileHelper.downloadImages(imageList);
};

exports.getHeader = (compani, conscience, title, columns) => [
  {
    columns: [
      { image: conscience, width: 64 },
      [
        { image: compani, width: 132, height: 28, alignment: 'right' },
        { text: title, style: 'title' },
      ],
    ],
    marginBottom: 20,
  },
  {
    canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 108, r: 0, color: PEACH_100 }],
    absolutePosition: { x: 40, y: 150 },
  },
  {
    columns,
    margin: [16, 0, 24, 24],
  },
];

exports.getFooter = signature => [
  {
    columns: [
      { text: 'Signature et tampon de l\'organisme de formation :', bold: true },
      {
        image: signature,
        width: 144,
        marginTop: 8,
        alignment: 'right',
      },
    ],
    unbreakable: true,
    marginLeft: 40,
    marginRight: 40,
  },
];
