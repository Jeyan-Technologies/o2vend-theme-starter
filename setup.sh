#!/bin/bash

echo "🚀 Setting up O2VEND Theme Development Environment..."
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Install CLI globally
echo "📦 Installing O2VEND Theme CLI..."
npm install -g @o2vend/theme-cli

if [ $? -eq 0 ]; then
    echo "✅ CLI installed successfully!"
    echo ""
else
    echo "❌ Failed to install CLI. Please check npm permissions."
    echo "   Try: sudo npm install -g @o2vend/theme-cli"
    exit 1
fi

# Install VS Code Extension
echo "🔌 Installing VS Code Extension..."
if command -v code &> /dev/null; then
    code --install-extension O2VEND.o2vend-liquid
    if [ $? -eq 0 ]; then
        echo "✅ Extension installed successfully!"
        echo ""
    else
        echo "⚠️  Failed to install extension. Install manually:"
        echo "   Visit: https://marketplace.visualstudio.com/items?itemName=O2VEND.o2vend-liquid"
        echo "   Or search for 'O2VEND Liquid' in VS Code Extensions (Ctrl+Shift+X / Cmd+Shift+X)"
        echo ""
    fi
else
    echo "⚠️  VS Code 'code' command not found. Install extension manually:"
    echo "   1. Open VS Code"
    echo "   2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)"
    echo "   3. Search for 'O2VEND Liquid'"
    echo "   4. Click Install"
    echo "   Or visit: https://marketplace.visualstudio.com/items?itemName=O2VEND.o2vend-liquid"
    echo ""
fi

# Copy .env.example to .env
if [ -f .env.example ] && [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created!"
    echo ""
fi

echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   o2vend serve"
echo ""
echo "💡 Or use VS Code tasks:"
echo "   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)"
echo "   - Type 'Tasks: Run Task'"
echo "   - Select 'O2VEND: Serve Theme'"
echo ""
