Write-Host "🚀 Setting up O2VEND Theme Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js found: $(node --version)" -ForegroundColor Green
Write-Host ""

# Install CLI globally
Write-Host "📦 Installing O2VEND Theme CLI..." -ForegroundColor Cyan
npm install -g @o2vend/theme-cli

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ CLI installed successfully!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ Failed to install CLI. Please check npm permissions." -ForegroundColor Red
    Write-Host "   Try: npm install -g @o2vend/theme-cli --force" -ForegroundColor Yellow
    exit 1
}

# Install VS Code Extension
Write-Host "🔌 Installing VS Code Extension..." -ForegroundColor Cyan
if (Get-Command code -ErrorAction SilentlyContinue) {
    code --install-extension o2vend.language-support
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Extension installed successfully!" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  Failed to install extension. Install manually from VS Code Extensions marketplace." -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host "⚠️  VS Code 'code' command not found. Install extension manually:" -ForegroundColor Yellow
    Write-Host "   1. Open VS Code"
    Write-Host "   2. Go to Extensions (Ctrl+Shift+X)"
    Write-Host "   3. Search for 'O2VEND Language Support'"
    Write-Host "   4. Click Install"
    Write-Host ""
}

# Copy .env.example to .env
if ((Test-Path .env.example) -and (-not (Test-Path .env))) {
    Write-Host "📝 Creating .env file from .env.example..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "✅ .env file created!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "✨ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. cd theme"
Write-Host "   2. o2vend theme serve"
Write-Host ""
Write-Host "💡 Or use VS Code tasks:" -ForegroundColor Cyan
Write-Host "   - Press Ctrl+Shift+P"
Write-Host "   - Type 'Tasks: Run Task'"
Write-Host "   - Select 'O2VEND: Serve Theme'"
Write-Host ""
