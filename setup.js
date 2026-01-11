#!/usr/bin/env node

/**
 * O2VEND Theme Starter - Cross-platform Setup Script
 * Installs CLI and VS Code Extension automatically
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up O2VEND Theme Development Environment...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.error('❌ Node.js 18+ is required. Current version:', nodeVersion);
  process.exit(1);
}
console.log(`✅ Node.js found: ${nodeVersion}\n`);

// Install CLI globally
console.log('📦 Installing O2VEND Theme CLI...');
try {
  execSync('npm install -g @o2vend/theme-cli', { stdio: 'inherit' });
  console.log('✅ CLI installed successfully!\n');
} catch (error) {
  console.error('❌ Failed to install CLI. Please check npm permissions.');
  console.error('   Try: sudo npm install -g @o2vend/theme-cli (Unix/Mac)');
  console.error('   Or: npm install -g @o2vend/theme-cli --force (Windows)\n');
  process.exit(1);
}

// Install VS Code Extension
console.log('🔌 Installing VS Code Extension...');
try {
  execSync('code --install-extension O2VEND.o2vend-liquid', { stdio: 'inherit' });
  console.log('✅ Extension installed successfully!\n');
} catch (error) {
  console.warn('⚠️  Failed to install extension. Install manually:');
  console.warn('   1. Open VS Code');
  console.warn('   2. Go to Extensions (Ctrl+Shift+X)');
  console.warn('   3. Search for "O2VEND Liquid"');
  console.warn('   4. Click Install');
  console.warn('   Or visit: https://marketplace.visualstudio.com/items?itemName=O2VEND.o2vend-liquid\n');
}

// Copy .env.example to .env if it doesn't exist
const envExamplePath = path.join(__dirname, '.env.example');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created!\n');
  } catch (error) {
    console.warn('⚠️  Failed to create .env file. Create manually from .env.example\n');
  }
} else if (!fs.existsSync(envExamplePath)) {
  console.log('📝 Creating .env.example file...');
  const envExampleContent = `# O2VEND API Configuration
# Leave default (mock) for local development without API credentials
API_MODE=mock

# For real API mode, uncomment and configure:
# API_MODE=real
# O2VEND_API_BASE_URL=https://your-store.com/shopfront/api/v2
# O2VEND_TENANT_ID=your-tenant-id
# O2VEND_API_KEY=your-api-key
# O2VEND_API_TIMEOUT=10000

# Development Configuration (all optional)
PORT=3000
MOCK_API_PORT=3001
HOT_RELOAD_ENABLED=true
OPEN_BROWSER=true
`;
  try {
    fs.writeFileSync(envExamplePath, envExampleContent);
    if (!fs.existsSync(envPath)) {
      fs.copyFileSync(envExamplePath, envPath);
    }
    console.log('✅ .env.example created!\n');
  } catch (error) {
    console.warn('⚠️  Failed to create .env.example file\n');
  }
}

console.log('✨ Setup complete!\n');
console.log('📝 Next steps:');
console.log('   o2vend serve');
console.log('');
console.log('📖 See README.md for full documentation');
console.log('');
