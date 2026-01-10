import * as fs from 'fs';
import * as path from 'path';
import { UndoResult } from '@inscribe/shared';
import { getBackupRoot, getLatestBackupPath, readBackupMetadata } from './backups';

/**
 * Undo last apply by restoring from backup
 */
export function undoLastApply(repoRoot: string): UndoResult {
  try {
    const backupRoot = getBackupRoot(repoRoot);
    
    if (!fs.existsSync(backupRoot)) {
      return {
        success: false,
        message: 'No backups found',
      };
    }

    // Find the most recent backup
    const latestBackup = getLatestBackupPath(repoRoot);

    if (!latestBackup) {
      return {
        success: false,
        message: 'No backups found',
      };
    }

    const metadataPath = path.join(latestBackup, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return {
        success: false,
        message: 'Backup metadata not found',
      };
    }

    const metadata = readBackupMetadata(latestBackup);

    // Restore files
    for (const file of metadata.files) {
      const backupFilePath = path.join(latestBackup, file);
      const targetFilePath = path.join(repoRoot, file);
      
      if (fs.existsSync(backupFilePath)) {
        fs.copyFileSync(backupFilePath, targetFilePath);
      }
    }

    return {
      success: true,
      message: `Restored from backup: ${path.basename(latestBackup)}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
