const google = require('@googleapis/sheets');

const jwtClient = () => new google.auth.JWT({
  email: process.env.GOOGLE_DRIVE_API_EMAIL,
  key: process.env.GOOGLE_DRIVE_API_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets('v4');

exports.writeData = async (params) => {
  const { spreadsheetId, range, values, boldRanges, backgroundColorRanges } = params;
  const auth = jwtClient();
  await auth.authorize();

  await new Promise((resolve, reject) => {
    sheets.spreadsheets.values.update({
      auth,
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    }, (err, response) => {
      if (err) reject(new Error(`Google Sheets API ${err}`));
      else resolve(response.data);
    });
  });

  const requests = [];

  if (boldRanges && boldRanges.length > 0) {
    const boldRequests = boldRanges.map(boldRange => ({
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: boldRange.startRow - 1,
          endRowIndex: boldRange.endRow,
          startColumnIndex: boldRange.startCol - 1,
          endColumnIndex: boldRange.endCol,
        },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    }));
    requests.push(...boldRequests);
  }

  if (backgroundColorRanges && backgroundColorRanges.length > 0) {
    const colorRequests = backgroundColorRanges.map((colorRange) => {
      const hex = colorRange.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;

      return {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: colorRange.startRow - 1,
            endRowIndex: colorRange.endRow,
            startColumnIndex: colorRange.startCol - 1,
            endColumnIndex: colorRange.endCol,
          },
          cell: { userEnteredFormat: { backgroundColor: { red: r, green: g, blue: b } } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      };
    });
    requests.push(...colorRequests);
  }

  if (requests.length > 0) {
    await new Promise((resolve, reject) => {
      sheets.spreadsheets.batchUpdate({ auth, spreadsheetId, requestBody: { requests } }, (err, response) => {
        if (err) reject(new Error(`Google Sheets API formatting ${err}`));
        else resolve(response.data);
      });
    });
  }
};
