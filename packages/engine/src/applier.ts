/**
 * Applier for Inscribe
 * Applies changes with backups and supports undo
 */

import * as fs from 'fs';
import * as path from 'path';
import { ApplyPlan, ApplyResult, UndoResult, BACKUP_DIR } from '@inscribe/shared';

/**
 * Apply changes with backup
 */
export function applyChanges(plan: ApplyPlan, repoRoot: string): ApplyResult {
  try {
    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(repoRoot, BACKUP_DIR, timestamp);
    
    // Collect files that will be modified
    const filesToBackup = plan.operations
      .map(op => path.join(repoRoot, op.file))
      .filter(filePath => fs.existsSync(filePath));

    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    // Backup existing files
    for (const filePath of filesToBackup) {
      const relativePath = path.relative(repoRoot, filePath);
      const backupFilePath = path.join(backupPath, relativePath);
      fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
      fs.copyFileSync(filePath, backupFilePath);
    }

    // Store backup metadata
    const metadata = {
      timestamp,
      files: filesToBackup.map(f => path.relative(repoRoot, f)),
    };
    fs.writeFileSync(
      path.join(backupPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Apply all operations
    for (const operation of plan.operations) {
      const filePath = path.join(repoRoot, operation.file);
      
      switch (operation.type) {
        case 'create':
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, operation.content);
          break;

        case 'replace':
          fs.writeFileSync(filePath, operation.content);
          break;

        case 'append':
          fs.appendFileSync(filePath, operation.content);
          break;

        case 'range':
          applyRangeReplace(filePath, operation);
          break;
      }
    }

    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Apply range replace operation
 */
function applyRangeReplace(filePath: string, operation: any): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { START, END, SCOPE_START, SCOPE_END } = operation.directives || {};

  // Find the search content
  let searchContent = content;
  let searchOffset = 0;

  if (SCOPE_START && SCOPE_END) {
    const scopeStartPos = content.indexOf(SCOPE_START);
    const scopeEndPos = content.indexOf(SCOPE_END, scopeStartPos) + SCOPE_END.length;
    searchContent = content.substring(scopeStartPos, scopeEndPos);
    searchOffset = scopeStartPos;
  }

  // Find START and END positions
  const startPos = searchContent.indexOf(START);
  const endPos = searchContent.indexOf(END, startPos) + END.length;

  // Calculate absolute positions
  const absoluteStartPos = searchOffset + startPos + START.length;
  const absoluteEndPos = searchOffset + endPos - END.length;

  // Replace content between anchors
  const newContent =
    content.substring(0, absoluteStartPos) +
    operation.content +
    content.substring(absoluteEndPos);

  fs.writeFileSync(filePath, newContent);
}

/**
 * Undo last apply by restoring from backup
 */
export function undoLastApply(repoRoot: string): UndoResult {
  try {
    const backupRoot = path.join(repoRoot, BACKUP_DIR);
    
    if (!fs.existsSync(backupRoot)) {
      return {
        success: false,
        message: 'No backups found',
      };
    }

    // Find the most recent backup
    const backups = fs.readdirSync(backupRoot)
      .filter(name => {
        const backupPath = path.join(backupRoot, name);
        return fs.statSync(backupPath).isDirectory();
      })
      .sort()
      .reverse();

    if (backups.length === 0) {
      return {
        success: false,
        message: 'No backups found',
      };
    }

    const latestBackup = backups[0];
    const backupPath = path.join(backupRoot, latestBackup);

    // Read metadata
    const metadataPath = path.join(backupPath, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return {
        success: false,
        message: 'Backup metadata not found',
      };
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // Restore files
    for (const file of metadata.files) {
      const backupFilePath = path.join(backupPath, file);
      const targetFilePath = path.join(repoRoot, file);
      
      if (fs.existsSync(backupFilePath)) {
        fs.copyFileSync(backupFilePath, targetFilePath);
      }
    }

    return {
      success: true,
      message: `Restored from backup: ${latestBackup}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Index repository to list allowed file paths
 */
export function indexRepository(repoRoot: string, indexedRoots: string[]): string[] {
  const files: string[] = [];

  for (const root of indexedRoots) {
    const rootPath = path.join(repoRoot, root);
    if (fs.existsSync(rootPath)) {
      collectFiles(rootPath, repoRoot, files);
    }
  }

  return files;
}

/**
 * Recursively collect files
 */
function collectFiles(dir: string, repoRoot: string, files: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      collectFiles(fullPath, repoRoot, files);
    } else if (entry.isFile()) {
      const relativePath = path.relative(repoRoot, fullPath);
      files.push(relativePath);
    }
  }
}
