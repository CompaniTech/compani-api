const sinon = require('sinon');
const { expect } = require('expect');
const Boom = require('@hapi/boom');
const Gdrive = require('../../../src/models/Google/Drive');
const Gsheets = require('../../../src/models/Google/Sheets');
const GDriveStorageHelper = require('../../../src/helpers/gDriveStorage');

describe('createFolder', () => {
  let add;
  const parentFolderId = '1234567890';

  beforeEach(() => {
    add = sinon.stub(Gdrive, 'add');
  });

  afterEach(() => {
    add.restore();
  });

  it('should create a folder in google drive (identity as string)', async () => {
    const identity = 'Test SAS';
    add.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolder(identity, parentFolderId);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(add, {
      name: identity,
      parentFolderId,
      folder: true,
    });
  });

  it('should create a folder in google drive (identity as object)', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    add.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolder(identity, parentFolderId);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(add, {
      name: `${identity.lastname.toUpperCase()} ${identity.firstname || ''}`,
      parentFolderId,
      folder: true,
    });
  });

  it('should throw a 422 error if folder creation fails', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    add.returns(null);

    try {
      await GDriveStorageHelper.createFolder(identity, parentFolderId);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive folder creation failed.'));
    } finally {
      sinon.assert.calledWithExactly(add, {
        name: `${identity.lastname.toUpperCase()} ${identity.firstname || ''}`,
        parentFolderId,
        folder: true,
      });
    }
  });
});

describe('createFolderForCompany', () => {
  let add;

  beforeEach(() => {
    add = sinon.stub(Gdrive, 'add');
    process.env.GOOGLE_DRIVE_COMPANY_FOLDER_ID = '0987654321';
  });

  afterEach(() => {
    add.restore();
    delete process.env.GOOGLE_DRIVE_COMPANY_FOLDER_ID;
  });

  it('should create a company folder in google drive (identity as string)', async () => {
    const identity = 'Test SAS';
    add.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.createFolderForCompany(identity);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(add, {
      name: identity,
      parentFolderId: '0987654321',
      folder: true,
    });
  });

  it('should throw a 422 error if folder creation fails', async () => {
    const identity = { firstname: 'Toto', lastname: 'Titi' };
    add.returns(null);
    try {
      await GDriveStorageHelper.createFolderForCompany(identity);
    } catch (e) {
      expect(e).toEqual(Boom.failedDependency('Google drive folder creation failed.'));
    } finally {
      sinon.assert.calledWithExactly(add, {
        name: identity,
        parentFolderId: '0987654321',
        folder: true,
      });
    }
  });
});

describe('addFile', () => {
  it('should add file to google drive', async () => {
    const add = sinon.stub(Gdrive, 'add');
    const payload = {
      name: 'Test',
      parentFolderId: '0987654321',
      type: 'application/pdf',
      body: 'This is a file',
    };
    add.returns({ id: '123456780' });

    const result = await GDriveStorageHelper.addFile(payload);

    expect(result).toEqual({ id: '123456780' });
    sinon.assert.calledWithExactly(
      add,
      {
        name: payload.name,
        parentFolderId: payload.parentFolderId,
        type: payload.type,
        body: payload.body,
        folder: false,
      }
    );
    add.restore();
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
  let add;
  let copy;
  let writeData;

  beforeEach(() => {
    add = sinon.stub(Gdrive, 'add');
    copy = sinon.stub(Gdrive, 'copy');
    writeData = sinon.stub(Gsheets, 'writeData');
    process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID = 'parent_folder_id';
    process.env.GOOGLE_SHEET_TEMPLATE_ID = 'templateId';
  });

  afterEach(() => {
    add.restore();
    copy.restore();
    writeData.restore();
    delete process.env.GOOGLE_DRIVE_VAEI_FOLDER_ID;
    delete process.env.GOOGLE_SHEET_TEMPLATE_ID;
  });

  it('should create a VAEI course folder and sheet and write data in it (with coach and architect)', async () => {
    const traineeName = 'TITI Toto';
    const traineeEmail = 'toto.titi@compani.fr';
    const traineePhone = '+33612345678';
    const traineeCompany = 'Company';
    const coach = { name: 'Jean COACH', email: 'coach@compani.fr', phone: '+33123456789' };
    const architect = { name: 'Jill ARCHIE', email: 'architect@compani.fr', phone: '' };

    add.returns({ id: 'folder_id' });
    copy.returns({ id: 'sheet_id' });

    const result = await GDriveStorageHelper
      .createCourseFolderAndSheet({ traineeName, traineeEmail, traineePhone, traineeCompany, coach, architect });

    expect(result).toEqual({ folderId: 'folder_id', gSheetId: 'sheet_id' });

    sinon.assert.calledOnceWithExactly(
      add,
      { name: 'TITI Toto (Company)', parentFolderId: 'parent_folder_id', folder: true }
    );

    sinon.assert.calledWithExactly(
      copy,
      { fileId: 'templateId', name: 'TITI Toto (Company) - Fichier Apprenant', parents: ['folder_id'] }
    );

    sinon.assert.calledWithExactly(writeData.getCall(0), {
      spreadsheetId: 'sheet_id',
      range: 'Coordonnées!E2:E4',
      values: [['TITI Toto'], ['toto.titi@compani.fr'], ['\'+33612345678']],
    });

    sinon.assert.calledWithExactly(writeData.getCall(1), {
      spreadsheetId: 'sheet_id',
      range: 'Coordonnées!C2:C4',
      values: [['Jean COACH'], ['coach@compani.fr'], ['\'+33123456789']],
    });

    sinon.assert.calledWithExactly(writeData.getCall(2), {
      spreadsheetId: 'sheet_id',
      range: 'Coordonnées!D2:D4',
      values: [['Jill ARCHIE'], ['architect@compani.fr'], ['']],
    });
  });

  it('should create a VAEI course folder and sheet and write data in it (without coach or architect)', async () => {
    const traineeName = 'TITI Toto';
    const traineeEmail = 'toto.titi@compani.fr';
    const traineePhone = '+33612345678';
    const traineeCompany = 'Company';

    add.returns({ id: 'folder_id' });
    copy.returns({ id: 'sheet_id' });

    const result = await GDriveStorageHelper.createCourseFolderAndSheet({
      traineeName,
      traineeEmail,
      traineePhone,
      traineeCompany,
      coach: null,
      architect: null,
    });

    expect(result).toEqual({ folderId: 'folder_id', gSheetId: 'sheet_id' });

    sinon.assert.calledOnceWithExactly(
      add,
      { name: 'TITI Toto (Company)', parentFolderId: 'parent_folder_id', folder: true }
    );

    sinon.assert.calledWithExactly(
      copy,
      { fileId: 'templateId', name: 'TITI Toto (Company) - Fichier Apprenant', parents: ['folder_id'] }
    );

    sinon.assert.calledOnceWithExactly(writeData, {
      spreadsheetId: 'sheet_id',
      range: 'Coordonnées!E2:E4',
      values: [['TITI Toto'], ['toto.titi@compani.fr'], ['\'+33612345678']],
    });
  });
});
