/**
 * Applier for Inscribe
 * Applies changes with backups and supports undo
 */

import * as fs from 'fs';
import * as path from 'path';
import { ApplyPlan, ApplyResult, UndoResult, BACKUP_DIR, Operation } from '@inscribe/shared';

/**
 * Apply changes with backup
 */
export function applyChanges(plan: ApplyPlan, repoRoot: string): ApplyResult {
  try {
    if (plan.errors && plan.errors.length > 0) {
      return {
        success: false,
        errors: plan.errors.map(error => error.message),
      };
    }

    if (!plan.operations || plan.operations.length === 0) {
      return {
        success: false,
        errors: ['No operations to apply'],
      };
    }

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
function applyRangeReplace(filePath: string, operation: Operation): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { START, END, SCOPE_START, SCOPE_END } = operation.directives || {};

  if (!START || !END) {
    throw new Error('Range operation requires START and END directives');
  }

  if ((SCOPE_START && !SCOPE_END) || (!SCOPE_START && SCOPE_END)) {
    throw new Error('Both SCOPE_START and SCOPE_END must be provided together');
  }

  let searchContent = content;
  let searchOffset = 0;

  if (SCOPE_START && SCOPE_END) {
    const scopeStartMatches = findAllOccurrences(content, SCOPE_START);
    const scopeEndMatches = findAllOccurrences(content, SCOPE_END);

    if (scopeStartMatches.length === 0) {
      throw new Error(`SCOPE_START anchor not found: "${SCOPE_START}"`);
    }

    if (scopeEndMatches.length === 0) {
      throw new Error(`SCOPE_END anchor not found: "${SCOPE_END}"`);
    }

    if (scopeStartMatches.length > 1) {
      throw new Error(`SCOPE_START anchor matches multiple times (${scopeStartMatches.length}), must match exactly once`);
    }

    if (scopeEndMatches.length > 1) {
      throw new Error(`SCOPE_END anchor matches multiple times (${scopeEndMatches.length}), must match exactly once`);
    }

    const scopeStartPos = scopeStartMatches[0];
    const scopeEndPos = scopeEndMatches[0];

    if (scopeStartPos >= scopeEndPos) {
      throw new Error('SCOPE_END must come after SCOPE_START');
    }

    searchContent = content.substring(scopeStartPos, scopeEndPos + SCOPE_END.length);
    searchOffset = scopeStartPos;
  }

  const startMatches = findAllOccurrences(searchContent, START);
  const endMatches = findAllOccurrences(searchContent, END);

  if (startMatches.length === 0) {
    throw new Error(`START anchor not found: "${START}"`);
  }

  if (endMatches.length === 0) {
    throw new Error(`END anchor not found: "${END}"`);
  }

  if (startMatches.length > 1) {
    throw new Error(`START anchor matches multiple times (${startMatches.length}), must match exactly once`);
  }

  if (endMatches.length > 1) {
    throw new Error(`END anchor matches multiple times (${endMatches.length}), must match exactly once`);
  }

  const startPos = startMatches[0];
  const endPos = endMatches[0];

  if (startPos >= endPos) {
    throw new Error('END anchor must come after START anchor');
  }

  const absoluteStartPos = searchOffset + startPos + START.length;
  const absoluteEndPos = searchOffset + endPos;

  const newContent =
    content.substring(0, absoluteStartPos) +
    operation.content +
    content.substring(absoluteEndPos);

  fs.writeFileSync(filePath, newContent);
}

function findAllOccurrences(content: string, search: string): number[] {
  const positions: number[] = [];
  let pos = content.indexOf(search);
  while (pos !== -1) {
    positions.push(pos);
    pos = content.indexOf(search, pos + 1);
  }
  return positions;
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
