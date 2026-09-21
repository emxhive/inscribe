import { app, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const RECENT_PROJECTS_FILE = 'recent-projects.json';

export class RecentProjectsManager {
  private recentProjects: string[] = [];
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), RECENT_PROJECTS_FILE);
    this.load();
  }


  private load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.recentProjects = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load recent projects', e);
        this.recentProjects = [];
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.recentProjects, null, 2));
    } catch (e) {
      console.error('Failed to save recent projects', e);
    }
  }

  addProject(repoRoot: string) {
    const absolutePath = path.resolve(repoRoot);
    this.recentProjects = [
      absolutePath,
      ...this.recentProjects.filter((p) => p !== absolutePath),
    ].slice(0, 10); // Keep last 10
    this.save();
    
    // Notify all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('recent-projects-updated', this.recentProjects);
    });
  }

  getRecentProjects(): string[] {
    // Filter out non-existent directories
    const existing = this.recentProjects.filter((p) => {
      try {
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
    
    if (existing.length !== this.recentProjects.length) {
      this.recentProjects = existing;
      this.save();
    }
    
    return this.recentProjects;
  }
}

export const recentProjectsManager = new RecentProjectsManager();
