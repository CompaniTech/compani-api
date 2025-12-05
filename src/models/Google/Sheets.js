const google = require('@googleapis/sheets');

const jwtClient = () => new google.auth.JWT({
  email: process.env.GOOGLE_DRIVE_API_EMAIL,
  key: process.env.GOOGLE_DRIVE_API_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets('v4');

exports.writeData = async (params) => {
  const { spreadsheetId, range, values } = params;
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
};
