#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the package directory (where this script is located)
function getPackageDir() {
  // When run via npx, __dirname points to the package directory
  // This could be in node_modules or a temporary directory
  const scriptPath = __filename;
  const scriptDir = path.dirname(path.resolve(scriptPath));
  
  // Check if template files exist in the script directory
  const templateDir = path.join(scriptDir, '{domainName}');
  if (fs.existsSync(templateDir)) {
    return scriptDir;
  }
  
  // If not found, try to find it relative to node_modules
  // This handles cases where npx creates a temporary directory
  const cwd = process.cwd();
  const nodeModulesPath = path.join(cwd, 'node_modules', '@burgan-tech', 'vnext-template');
  if (fs.existsSync(path.join(nodeModulesPath, '{domainName}'))) {
    return nodeModulesPath;
  }
  
  // Last resort: use script directory
  return scriptDir;
}

// Validate domain name
function validateDomainName(domainName) {
  if (!domainName) {
    console.error('❌ Domain name cannot be empty');
    return false;
  }
  // Validate domain name format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(domainName)) {
    console.error('❌ Domain name can only contain letters, numbers, hyphens, and underscores');
    return false;
  }
  return true;
}

// Replace {domainName} in file content
function replaceInContent(content, domainName) {
  return content.replace(/\{domainName\}/g, domainName);
}

// Copy directory contents without creating the directory itself
function copyDirectoryContents(src, dest, domainName) {
  if (!fs.existsSync(src)) {
    return;
  }
  
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  // Copy all contents
  const entries = fs.readdirSync(src);
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    copyAndReplace(srcPath, destPath, domainName, ['node_modules', '.git', 'dist']);
  }
}

// Copy directory recursively and replace {domainName}
function copyAndReplace(src, dest, domainName, skipDirs = []) {
  if (!fs.existsSync(src)) {
    return;
  }

  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    // Skip certain directories
    const dirName = path.basename(src);
    if (skipDirs.includes(dirName) || dirName.startsWith('.')) {
      return;
    }
    
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    // Copy contents
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copyAndReplace(srcPath, destPath, domainName, skipDirs);
    }
  } else if (stat.isFile()) {
    // Read and replace content
    const ext = path.extname(src).toLowerCase();
    const fileName = path.basename(src);
    
    // Process text files
    if (['.json', '.js', '.md', '.sh', '.txt', '.yml', '.yaml'].includes(ext) ||
        fileName === '.gitignore' ||
        fileName === '.gitattributes' ||
        fileName === '.cursorrules') {
      const content = fs.readFileSync(src, 'utf8');
      const replaced = replaceInContent(content, domainName);
      fs.writeFileSync(dest, replaced, 'utf8');
    } else {
      // Copy binary files as-is
      fs.copyFileSync(src, dest);
    }
  }
}

// Main init function
function init() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: npx @burgan-tech/vnext-template <domain-name>');
    console.error('   Example: npx @burgan-tech/vnext-template user-management');
    process.exit(1);
  }
  
  const domainName = args[0].trim();
  
  if (!validateDomainName(domainName)) {
    process.exit(1);
  }
  
  // Project will be created in current directory, not in a subdirectory
  const targetDir = process.cwd();
  const domainDir = path.join(targetDir, domainName);
  
  // Check if domain directory already exists
  if (fs.existsSync(domainDir)) {
    console.error(`❌ Error: Domain directory "${domainName}" already exists`);
    process.exit(1);
  }
  
  // Check if project files already exist
  if (fs.existsSync(path.join(targetDir, 'package.json'))) {
    console.error(`❌ Error: package.json already exists in current directory`);
    process.exit(1);
  }
  
  console.log('🚀 vNext Template Initialization');
  console.log('=================================\n');
  console.log(`📝 Initializing project with domain: ${domainName}\n`);
  
  // Get package directory
  const packageDir = getPackageDir();
  
  // Verify template directory exists
  const templateDir = path.join(packageDir, '{domainName}');
  if (!fs.existsSync(templateDir)) {
    console.error(`❌ Error: Template directory not found in package`);
    console.error(`   Expected: ${templateDir}`);
    console.error(`   Package directory: ${packageDir}`);
    process.exit(1);
  }
  
  // Create domain directory (targetDir is current directory, no need to create it)
  fs.mkdirSync(domainDir, { recursive: true });
  
  // Files and directories to copy
  const itemsToCopy = [
    '{domainName}',
    'vnext.config.json',
    'package.json',
    'index.js',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'test.js',
    'validate.js',
    'build.js',
    'setup.js',
    'sync-schema-version.js',
    'test-domain-detection.sh',
    '.gitignore',
    '.gitattributes'
  ];
  
  console.log('📦 Copying template files...');
  
  // Copy each item
  for (const item of itemsToCopy) {
    const srcPath = path.join(packageDir, item);
    
    if (item === '{domainName}') {
      // Copy {domainName} contents to domainDir (test/core/)
      if (fs.existsSync(srcPath)) {
        const entries = fs.readdirSync(srcPath);
        for (const entry of entries) {
          const srcEntryPath = path.join(srcPath, entry);
          const destEntryPath = path.join(domainDir, entry);
          
          // Use a custom copy function to avoid nested directory creation
          if (fs.statSync(srcEntryPath).isDirectory()) {
            copyDirectoryContents(srcEntryPath, destEntryPath, domainName);
          } else {
            copyAndReplace(srcEntryPath, destEntryPath, domainName, ['node_modules', '.git', 'dist', '.github']);
          }
        }
      }
    } else {
      const destPath = path.join(targetDir, item);
      if (fs.existsSync(srcPath)) {
        if (fs.statSync(srcPath).isDirectory()) {
          copyAndReplace(srcPath, destPath, domainName, ['node_modules', '.git', 'dist', '.github']);
        } else {
          const content = fs.readFileSync(srcPath, 'utf8');
          const replaced = replaceInContent(content, domainName);
          fs.writeFileSync(destPath, replaced, 'utf8');
        }
      }
    }
  }
  
  console.log(`  ✓ Created domain directory: ${domainName}/`);
  console.log(`  ✓ Replaced {domainName} with ${domainName} in all files`);
  console.log(`  ✓ Copied project files to current directory\n`);
  
  // Install dependencies
  console.log('📥 Installing dependencies...');
  try {
    // targetDir is already current directory, no need to chdir
    execSync('npm install', { stdio: 'inherit' });
    console.log('\n✅ Project initialized successfully!\n');
    console.log(`📁 Project location: ${targetDir}`);
    console.log(`📁 Domain directory: ${domainDir}`);
    console.log(`\n🚀 Next steps:`);
    console.log(`   npm run validate`);
    console.log(`   npm test\n`);
  } catch (error) {
    console.error('\n⚠️  Warning: Failed to install dependencies automatically');
    console.error(`   Please run: npm install\n`);
    process.exit(1);
  }
}

// Run init
init();

