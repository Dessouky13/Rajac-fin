const fs = require('fs');
const path = require('path');
// Import the already-authenticated drive client from googleSheets.js
const { drive } = require('./googleSheets');

class GoogleDriveService {
  constructor() {
    this.drive = drive;
    this.uploadFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    // allow explicit archive folder id via env; fall back to configured default id if provided
    this.archiveFolderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID || '13FvTqzoe82IWe01IlhQwc9E8i3RjAPTz';
  }

  async uploadFile(filePath, fileName) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: [this.uploadFolderId]
      };

      const media = {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, createdTime'
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }

  async createArchiveFolder() {
    try {
      // If an archive folder id was provided via env, prefer and return it.
      if (this.archiveFolderId) {
        console.log('Using archiveFolderId from config:', this.archiveFolderId);
        return this.archiveFolderId;
      }

      const folderMetadata = {
        name: 'Archive',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.uploadFolderId]
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name'
      });

      return response.data.id;
    } catch (error) {
      // attempt to find existing Archive folder (search across drives)
      try {
        const folders = await this.drive.files.list({
          q: `name='Archive' and '${this.uploadFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
          fields: 'files(id, name)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });

        if (folders.data.files && folders.data.files.length > 0) {
          return folders.data.files[0].id;
        }
      } catch (innerErr) {
        console.warn('Could not list existing Archive folders:', innerErr && innerErr.message ? innerErr.message : innerErr);
      }
      throw error;
    }
  }

  async archiveFile(fileId) {
    try {
      const archiveFolderId = await this.createArchiveFolder();

      // fetch current parents (supporting all drives)
      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'parents',
        supportsAllDrives: true
      });

      const previousParentsArr = file.data.parents || [];
      const previousParents = previousParentsArr.join(',');

      const updateParams = {
        fileId: fileId,
        addParents: archiveFolderId,
        fields: 'id, parents',
        supportsAllDrives: true
      };
      if (previousParents && previousParents.length > 0) updateParams.removeParents = previousParents;

      try {
        await this.drive.files.update(updateParams);
        console.log(`File ${fileId} archived (moved) successfully to ${archiveFolderId}`);
        return true;
      } catch (err) {
        console.warn('Drive update (move) failed, attempting copy/delete fallback:', err && err.message ? err.message : err);
        // If move fails, try copy into archive and delete original (may fail for service accounts without quota)
        try {
          const copyRes = await this.drive.files.copy({
            fileId,
            resource: { parents: [archiveFolderId] },
            fields: 'id',
            supportsAllDrives: true
          });
          await this.drive.files.delete({ fileId, supportsAllDrives: true });
          console.log(`File ${fileId} archived (copied then deleted) successfully as ${copyRes.data.id}`);
          return true;
        } catch (copyErr) {
          console.error('Copy/delete fallback also failed:', copyErr && copyErr.message ? copyErr.message : copyErr);
          throw copyErr;
        }
      }
    } catch (error) {
      console.error('Error archiving file:', error);
      throw error;
    }
  }

  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, createdTime, modifiedTime'
      });
      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  async listFiles(folderId = null) {
    try {
      const query = folderId 
        ? `'${folderId}' in parents` 
        : `'${this.uploadFolderId}' in parents`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }
}

module.exports = new GoogleDriveService();