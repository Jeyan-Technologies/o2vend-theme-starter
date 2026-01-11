# O2VEND Theme Starter

**Ready-to-use starter template for O2VEND theme development.**

This repository contains the complete default O2VEND theme, pre-configured with:
- O2VEND Theme CLI installed
- VS Code/Cursor extension recommendations
- Development environment setup scripts
- Complete default theme with all widgets and templates

## Quick Start

### Prerequisites

- Node.js 18+ installed
- VS Code or Cursor installed

### Setup

1. **Clone this repository:**
   ```bash
   git clone https://github.com/Jeyan-Technologies/o2vend-theme-starter.git
   cd o2vend-theme-starter
   ```

2. **Run setup script:**
   
   **Windows (PowerShell):**
   ```powershell
   .\setup.ps1
   ```
   
   **Mac/Linux:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   
   **Or using Node.js:**
   ```bash
   node setup.js
   ```

   The setup script will:
   - Install O2VEND Theme CLI globally (`@o2vend/theme-cli`)
   - Install VS Code/Cursor extension (O2VEND Liquid)
   - Create `.env` file with default configuration
   - Install theme dependencies (if any)

3. **Start development server:**
   ```bash
   o2vend serve
   ```

   The server will start at `http://localhost:3000` with hot reload enabled.

## Project Structure

```
o2vend-theme-starter/
├── theme/                    # Theme files
│   ├── assets/              # CSS, JS, images
│   ├── config/              # Theme settings
│   ├── layout/              # Layout templates
│   ├── sections/            # Section templates
│   ├── snippets/            # Reusable snippets
│   ├── templates/           # Page templates
│   └── widgets/             # Widget templates
├── .vscode/                 # VS Code configuration
│   ├── settings.json        # Editor settings
│   ├── extensions.json      # Recommended extensions
│   └── tasks.json           # Build tasks
├── setup.js                 # Setup script (Node.js)
├── setup.ps1                # Setup script (Windows)
├── setup.sh                 # Setup script (Mac/Linux)
├── .env.example             # Environment variables template
└── README.md                # This file
```

## Development

### Using Mock API (Default)

The development server runs in **mock mode** by default, providing realistic test data:

```bash
o2vend serve
# or explicitly
o2vend serve --mode mock
```

### Using Real API

To connect to a real O2VEND Storefront API:

1. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. Configure environment variables:
   ```env
   O2VEND_TENANT_ID=your-tenant-id
   O2VEND_API_KEY=your-api-key
   O2VEND_API_BASE_URL=https://api.yourdomain.com
   API_MODE=real
   ```

3. Start server in real mode:
   ```bash
   o2vend serve --mode real
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_MODE` | API mode (`mock` or `real`) | `mock` |
| `PORT` | Development server port | `3000` |
| `HOST` | Development server host | `localhost` |
| `MOCK_API_PORT` | Mock API server port | `3001` |
| `O2VEND_TENANT_ID` | Tenant ID (real mode only) | - |
| `O2VEND_API_KEY` | API Key (real mode only) | - |
| `O2VEND_API_BASE_URL` | API Base URL (real mode only) | - |
| `OPEN_BROWSER` | Auto-open browser | `true` |

## Theme Development

### Creating a New Section

Create a new file in `theme/sections/`:

```liquid
<!-- theme/sections/my-section.liquid -->
<div class="my-section">
  <h2>{{ section.settings.title }}</h2>
  {% for widget in widgets.content %}
    {{ widget | render_widget }}
  {% endfor %}
</div>

{% schema %}
{
  "name": "My Section",
  "settings": [
    {
      "type": "text",
      "id": "title",
      "label": "Title",
      "default": "My Section Title"
    }
  ]
}
{% endschema %}
```

### Creating a New Widget

Create a new file in `theme/widgets/`:

```liquid
<!-- theme/widgets/my-widget.liquid -->
<div class="widget my-widget">
  <h3>{{ widget.settings.title }}</h3>
  <p>{{ widget.settings.description }}</p>
</div>
```

### Creating a New Template

Create a new file in `theme/templates/`:

```liquid
<!-- theme/templates/custom-page.liquid -->
{% layout 'theme' %}

<div class="custom-page">
  <h1>{{ page.title }}</h1>
  <div class="content">{{ page.content }}</div>
</div>
```

## VS Code Integration

### Recommended Extensions

The `.vscode/extensions.json` file includes:
- **O2VEND Liquid** - Language support for O2VEND Liquid
- **Prettier** - Code formatting
- **ESLint** - JavaScript linting

Extensions are automatically recommended when you open the project.

### Features

- **Syntax Highlighting** - Full Liquid syntax support
- **IntelliSense** - Auto-completion for Liquid tags, filters, and O2VEND objects
- **Snippets** - Code templates for common patterns
- **Schema Validation** - JSON schema validation for `settings_schema.json` and `theme.json`
- **Hot Reload** - Automatic browser refresh on file changes

## CLI Commands

### `o2vend serve`

Start development server with hot reload:

```bash
o2vend serve [options]

Options:
  -m, --mode <mode>           API mode (mock|real) [default: mock]
  -p, --port <port>           Server port [default: 3000]
  --host <host>               Server host [default: localhost]
  --cwd <path>                Working directory [default: current]
  --open                       Open browser automatically [default: true]
  --no-open                   Don't open browser
  --mock-api-port <port>      Mock API port [default: 3001]
```

### `o2vend init <name>`

Initialize a new theme project:

```bash
o2vend init my-theme
```

### `o2vend validate`

Validate theme structure:

```bash
o2vend validate
```

### `o2vend package`

Package theme for marketplace:

```bash
o2vend package
```

### `o2vend check`

Check theme for issues:

```bash
o2vend check
```

## Hot Reload

The development server includes automatic hot reload:

- **CSS changes** - Injected without page reload
- **Liquid/JS changes** - Full page reload
- **File watching** - Automatic detection of changes

## Theme Structure

### Layouts

Layouts define the HTML structure of pages:

- `theme/layout/theme.liquid` - Main theme layout

### Templates

Templates define specific page types:

- `templates/index.liquid` - Homepage
- `templates/product-detail.liquid` - Product page
- `templates/products.liquid` - Product listing
- `templates/categories.liquid` - Category listing
- `templates/cart.liquid` - Shopping cart
- `templates/search.liquid` - Search results
- `templates/page.liquid` - Custom pages
- `templates/error.liquid` - Error page

### Sections

Sections are reusable components:

- `sections/header.liquid` - Site header
- `sections/footer.liquid` - Site footer
- `sections/hero.liquid` - Hero banner
- `sections/content.liquid` - Content section

### Widgets

Widgets are dynamic content components:

- `widgets/product.liquid` - Product widget
- `widgets/product-carousel.liquid` - Product carousel
- `widgets/category-list.liquid` - Category list
- `widgets/brand-carousel.liquid` - Brand carousel
- And many more...

### Snippets

Snippets are reusable code fragments:

- `snippets/product-card.liquid` - Product card
- `snippets/cart-drawer.liquid` - Shopping cart drawer
- `snippets/pagination.liquid` - Pagination
- And more...

## Marketplace Submission

When your theme is ready:

1. **Create theme.json:**
   ```bash
   cp theme/theme.json.example theme/theme.json
   # Edit theme.json with your theme details
   ```

2. **Package theme:**
   ```bash
   o2vend package
   # Or with custom options:
   o2vend package --theme-id "my-theme" --theme-name "My Theme" --theme-version "1.0.0"
   ```

3. **Upload to marketplace:**
   - Theme package will be created in `dist/` directory
   - Upload `dist/theme.zip` to O2VEND Theme Marketplace
   - The package includes `theme.json` manifest required by marketplace

See [THEME_PACKAGING.md](./THEME_PACKAGING.md) for detailed packaging instructions.

## Resources

- [O2VEND Theme Documentation](https://docs.o2vend.com/themes)
- [Liquid Documentation](https://shopify.github.io/liquid/)
- [Theme Development Guide](https://docs.o2vend.com/themes/development)

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/Jeyan-Technologies/o2vend-theme-starter/issues)
- Documentation: [O2VEND Docs](https://docs.o2vend.com)

## License

MIT License - See LICENSE file for details