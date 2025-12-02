const sinon = require('sinon');
const { expect } = require('expect');
const Boom = require('@hapi/boom');
const Gdrive = require('../../../src/models/Google/Drive');
const Gsheets = require('../../../src/models/Google/Sheets');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');

describe('createFolder', () => {
  let addStub;
  const parentFolderId = '1234567890';

  beforeEach(() => {
    addStub = sinon.stub(Gdrive, 'add');
  });

  afterEach(() => {
    addStub.restore();
  });

  it('should create a folder in google drive (identity as string)', async () => {
    const identity = 'Test SAS';
    addStub.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolder(identity, parentFolderId);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(addStub, {
      name: identity,
      parentFolderId,
      folder: true,
    });
  });

  it('should create a folder in google drive (identity as object)', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    addStub.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolder(identity, parentFolderId);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(addStub, {
      name: `${identity.lastname.toUpperCase()} ${identity.firstname || ''}`,
      parentFolderId,
      folder: true,
    });
  });

  it('should throw a 422 error if folder creation fails', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    addStub.returns(null);

    try {
      await GDriveStorageHelper.createFolder(identity, parentFolderId);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive folder creation failed.'));
    } finally {
      sinon.assert.calledWithExactly(addStub, {
        name: `${identity.lastname.toUpperCase()} ${identity.firstname || ''}`,
        parentFolderId,
        folder: true,
      });
    }
  });
});

describe('createFolderForCompany', () => {
  let addStub;

  beforeEach(() => {
    addStub = sinon.stub(Gdrive, 'add');
    process.env.GOOGLE_DRIVE_COMPANY_FOLDER_ID = '0987654321';
  });

  afterEach(() => {
    addStub.restore();
    delete process.env.GOOGLE_DRIVE_COMPANY_FOLDER_ID;
  });

  it('should create a company folder in google drive (identity as string)', async () => {
    const identity = 'Test SAS';
    addStub.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolderForCompany(identity);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(addStub, {
      name: identity,
      parentFolderId: '0987654321',
      folder: true,
    });
  });

  it('should throw a 422 error if folder creation fails', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    addStub.returns(null);
    try {
      await GDriveStorageHelper.createFolderForCompany(identity);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive folder creation failed.'));
    } finally {
      sinon.assert.calledWithExactly(addStub, {
        name: identity,
        parentFolderId: '0987654321',
        folder: true,
      });
    }
  });
});

describe('addFile', () => {
  it('should add file to google drive', async () => {
    const addStub = sinon.stub(Gdrive, 'add');
    const payload = {
      name: 'Test',
      parentFolderId: '0987654321',
      type: 'application/pdf',
      body: 'This is a file',
    };
    addStub.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.addFile(payload);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(
      addStub,
      {
        name: payload.name,
        parentFolderId: payload.parentFolderId,
        type: payload.type,
        body: payload.body,
        folder: false,
      }
    );
    addStub.restore();
  });
});

describe('deleteFile', () => {
  let deleteFile;

  beforeEach(() => {
    deleteFile = sinon.stub(Gdrive, 'deleteFile');
  });

  afterEach(() => {
    deleteFile.restore();
  });

  it('should delete a file in google drive', async () => {
    await GDriveStorageHelper.deleteFile('fileId');

    sinon.assert.calledWithExactly(deleteFile, { fileId: 'fileId' });
  });
});

describe('createCourseFolderAndSheet', () => {
  let addStub;
  let copyStub;
  let writeDataStub;

  beforeEach(() => {
    addStub = sinon.stub(Gdrive, 'add');
    copyStub = sinon.stub(Gdrive, 'copy');
    writeDataStub = sinon.stub(Gsheets, 'writeData');
    process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID = 'parent_folder_id';
    process.env.GOOGLE_SHEET_TEMPLATE_ID = 'templateId';
  });

  afterEach(() => {
    addStub.restore();
    copyStub.restore();
    writeDataStub.restore();
    delete process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID;
    delete process.env.GOOGLE_SHEET_TEMPLATE_ID;
  });

  it('should create a VAEI course folder and sheet and write data in it', async () => {
    const traineeName = 'TITI Toto';
    const traineeEmail = 'toto.titi@compani.fr';
    const traineePhone = '+33612345678';

    addStub.returns({ id: 'folder_id' });
    copyStub.returns({ id: 'sheet_id' });

    const result = await GDriveStorageHelper.createCourseFolderAndSheet({ traineeName, traineeEmail, traineePhone });

    expect(result).toEqual({ folderId: 'folder_id', sheetId: 'sheet_id' });

    sinon.assert.calledOnceWithExactly(
      addStub,
      { name: traineeName, parentFolderId: 'parent_folder_id', folder: true }
    );

    sinon.assert.calledWithExactly(
      copyStub,
      { fileId: 'templateId', name: 'TITI Toto - Fichier Apprenant', parents: ['folder_id'] }
    );

    sinon.assert.calledOnceWithExactly(writeDataStub, {
      spreadsheetId: 'sheet_id',
      range: 'Coordonnées!E2:E4',
      values: [['TITI Toto'], ['toto.titi@compani.fr'], ['\'+33612345678']],
    });
  });
});
