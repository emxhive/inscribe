import * as fs from 'fs';
import * as path from 'path';
import { ApplyPlan, BACKUP_DIR, Operation } from '@inscribe/shared';

interface BackupMetadata {
  timestamp: string;
  files: string[];
}

export function createBackup(plan: ApplyPlan, repoRoot: string): { backupPath: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(repoRoot, BACKUP_DIR, timestamp);

  // Collect files that will be modified
  const filesToBackup = plan.operations
    .map((op: Operation) => path.join(repoRoot, op.file))
    .filter((filePath: string) => fs.existsSync(filePath));

  // Create backup directory
  fs.mkdirSync(backupPath, { recursive: true });

  // Backup existing files
  for (const filePath of filesToBackup) {
    const relativePath = path.relative(repoRoot, filePath);
    const backupFilePath = path.join(backupPath, relativePath);
    fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
    fs.copyFileSync(filePath, backupFilePath);
  }

  const metadata: BackupMetadata = {
    timestamp,
    files: filesToBackup.map((f: string) => path.relative(repoRoot, f)),
  };

  writeBackupMetadata(backupPath, metadata);

  return { backupPath };
}

export function writeBackupMetadata(backupPath: string, metadata: BackupMetadata): void {
  fs.writeFileSync(
    path.join(backupPath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
}

export function readBackupMetadata(backupPath: string): BackupMetadata {
  return JSON.parse(fs.readFileSync(path.join(backupPath, 'metadata.json'), 'utf-8'));
}

export function getBackupRoot(repoRoot: string): string {
  return path.join(repoRoot, BACKUP_DIR);
}

export function getLatestBackupPath(repoRoot: string): string | undefined {
  const backupRoot = getBackupRoot(repoRoot);
  const backups = fs.readdirSync(backupRoot)
    .filter((name: string) => {
      const backupPath = path.join(backupRoot, name);
      return fs.statSync(backupPath).isDirectory();
    })
    .sort()
    .reverse();

  if (backups.length === 0) {
    return undefined;
  }

  return path.join(backupRoot, backups[0]);
}
