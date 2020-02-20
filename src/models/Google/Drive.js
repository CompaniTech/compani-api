const fs = require('fs');
const { google } = require('googleapis');

const jwtClient = () => new google.auth.JWT(
  process.env.GOOGLE_DRIVE_API_EMAIL,
  null,
  process.env.GOOGLE_DRIVE_API_PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/drive'],
  null
);

const drive = google.drive('v3');

exports.add = async (params) => {
  const fileMetadata = {
    name: params.name,
    mimeType: params.folder ? 'application/vnd.google-apps.folder' : null,
    parents: [params.parentFolderId] || [],
  };
  const media = params.folder ? null : { body: params.body, mimeType: params.type };

  const auth = jwtClient();
  await auth.authorize();

  return new Promise((resolve, reject) => {
    drive.files.create(
      { auth, resource: fileMetadata, media, fields: ['id, webViewLink'] },
      (err, item) => {
        if (err) reject(new Error(`Google Drive API ${err}`));
        else resolve(item.data);
      }
    );
  });
};

exports.deleteFile = async (params) => {
  const auth = jwtClient();
  await auth.authorize();

  return new Promise((resolve, reject) => drive.files.delete(
    { auth, fileId: params.fileId },
    (err, file) => {
      if (err) reject(new Error(`Google Drive API ${err}`));
      else resolve(file.data);
    }
  ));
};

exports.getFileById = async (params) => {
  const auth = jwtClient();
  await auth.authorize();

  return new Promise((resolve, reject) => drive.files.get(
    { auth, fileId: `${params.fileId}`, fields: ['name, webViewLink, thumbnailLink'] },
    (err, response) => {
      if (err) reject(new Error(`Google Drive API ${err}`));
      else resolve(response.data);
    }
  ));
};

exports.downloadFileById = async (params) => {
  const dest = fs.createWriteStream(params.tmpFilePath);
  const auth = jwtClient();
  await auth.authorize();

  return new Promise((resolve, reject) => drive.files.get(
    { auth, fileId: `${params.fileId}`, alt: 'media' },
    { responseType: 'stream' },
    (err, res) => {
      if (err || !res || !res.data) {
        return reject(new Error(`Error during Google drive doc download ${err}`));
      }

      res.data.on('end', () => {
        resolve();
      }).on('error', () => {
        reject(new Error(`Error during Google drive doc download ${err}`));
      }).pipe(dest);
    }
  ));
};

exports.list = async (params) => {
  const auth = jwtClient();
  await auth.authorize();

  return new Promise((resolve, reject) => drive.files.list({
    auth,
    ...(params.folderId && { q: `'${params.folderId}' in parents and mimeType != 'application/vnd.google-apps.folder'` }),
    fields: 'nextPageToken, files(name, webViewLink, createdTime)',
    pageToken: params.nextPageToken || '',
  }, (err, response) => {
    if (err) reject(new Error(`Google Drive API ${err}`));
    else resolve(response.data);
  }));
};
