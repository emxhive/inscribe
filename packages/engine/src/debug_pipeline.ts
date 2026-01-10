import * as path from 'path';
import * as fs from 'fs';
import { parseBlocks } from './parser';
import { validateBlocks } from './validator';
import { buildApplyPlan } from './planner';
import { applyChanges } from './applier';
import { indexRepository } from './repository';

// ==========================================
// 1. SETUP & INPUT
// ==========================================

// Define a temporary test directory for debugging
const DEBUG_REPO_ROOT = path.resolve(__dirname, '../debug_playground');

// Ensure the debug directory exists and is clean
if (fs.existsSync(DEBUG_REPO_ROOT)) {
  fs.rmSync(DEBUG_REPO_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(DEBUG_REPO_ROOT, { recursive: true });

// Create a dummy file for 'replace' and 'range' operations
const EXISTING_FILE_PATH = path.join(DEBUG_REPO_ROOT, 'existing_file.ts');
const EXISTING_FILE_CONTENT = `
function hello() {
  console.log("Hello World");
}

function goodbye() {
  console.log("Goodbye World");
}
`;
fs.writeFileSync(EXISTING_FILE_PATH, EXISTING_FILE_CONTENT);

// Initialize repository (indexing)
console.log('--- Indexing Repository ---');
indexRepository(DEBUG_REPO_ROOT);


// --- SAMPLE AI INPUT ---
// Modify this string to test different scenarios
const AI_INPUT = `
Here is a plan to update your code.

@inscribe BEGIN
@inscribe FILE: new_feature.ts
@inscribe MODE: create
\`\`\`typescript
export function newFeature() {
  return "This is a new feature";
}
\`\`\`
@inscribe END

@inscribe BEGIN
@inscribe FILE: existing_file.ts
@inscribe MODE: replace
\`\`\`typescript
function hello() {
  console.log("Hello Universe");
}

function goodbye() {
  console.log("Goodbye World");
}
\`\`\`
@inscribe END

@inscribe BEGIN
@inscribe FILE: existing_file.ts
@inscribe MODE: append
\`\`\`typescript

// Appended comment
console.log("End of file");
\`\`\`
@inscribe END
`;

async function runDebugPipeline() {
  try {
    console.log('\n==========================================');
    console.log('       INSCRIBE PIPELINE DEBUGGER       ');
    console.log('==========================================\n');

    // ==========================================
    // 2. PARSING
    // ==========================================
    console.log('--- 1. Parsing ---');
    const parseResult = parseBlocks(AI_INPUT);
    
    if (parseResult.errors.length > 0) {
      console.error('Parsing Errors:', parseResult.errors);
      // We continue even with errors if there are valid blocks, 
      // but usually you might stop here.
    }
    console.log(`Parsed ${parseResult.blocks.length} blocks.`);


    // ==========================================
    // 3. VALIDATION
    // ==========================================
    console.log('\n--- 2. Validation ---');
    const validationErrors = validateBlocks(parseResult.blocks, DEBUG_REPO_ROOT);

    if (validationErrors.length > 0) {
      console.error('Validation Errors:', validationErrors);
      return; // Stop if validation fails
    }
    console.log('Validation successful.');


    // ==========================================
    // 4. PLANNING
    // ==========================================
    console.log('\n--- 3. Planning ---');
    const plan = buildApplyPlan(parseResult.blocks);
    console.log(`Plan created with ${plan.operations.length} operations.`);


    // ==========================================
    // 5. APPLICATION
    // ==========================================
    console.log('\n--- 4. Application ---');
    const applyResult = applyChanges(plan, DEBUG_REPO_ROOT);

    if (applyResult.success) {
      console.log('Application successful!');
      console.log('Backup created at:', applyResult.backupPath);
      
      // Verify changes
      console.log('\n--- Verification ---');
      const newFileContent = fs.readFileSync(path.join(DEBUG_REPO_ROOT, 'new_feature.ts'), 'utf-8');
      console.log('new_feature.ts content:\n', newFileContent);
      
      const updatedFileContent = fs.readFileSync(EXISTING_FILE_PATH, 'utf-8');
      console.log('existing_file.ts content:\n', updatedFileContent);

    } else {
      console.error('Application failed:', applyResult.errors);
    }

  } catch (error) {
    console.error('Unexpected error in pipeline:', error);
  }
}

// Run the pipeline
runDebugPipeline();
