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
│   ├── assets/              # CSS, JS, images (customizable)
│   ├── config/              # Theme settings
│   ├── layout/              # Layout templates (customizable)
│   ├── sections/            # Section templates (predefined, customizable)
│   ├── snippets/            # Reusable snippets (customizable)
│   ├── templates/           # Page templates (predefined, customizable)
│   └── widgets/             # Widget templates (predefined, customizable)
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

> **Note:** Templates, sections, and widgets are **predefined by O2VEND**. You can customize the existing files but cannot create new template types, section types, or widget types. Widgets themselves are managed through the O2VEND admin panel and loaded via the Storefront API.

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

### Important Notes

**Templates, Sections, and Widgets:**
- Templates, sections, and widgets are **predefined** by O2VEND
- These come from the O2VEND Storefront API
- You **cannot create new templates, sections, or widgets**
- You can only **customize existing ones** by editing the Liquid files in this theme
- All available templates, sections, and widgets are provided in this starter theme

### Customizing Existing Templates

You can customize existing templates by editing files in `theme/templates/`:

```liquid
<!-- theme/templates/index.liquid -->
{% layout 'theme' %}

<div class="homepage">
  <h1>Welcome to {{ shop.name }}</h1>
  
  {% for widget in widgets.hero %}
    {{ widget | render_widget }}
  {% endfor %}
</div>
```

### Customizing Existing Sections

Edit existing section files in `theme/sections/`:

```liquid
<!-- theme/sections/header.liquid -->
<header class="site-header">
  <!-- Your custom header code -->
</header>

{% schema %}
{
  "name": "Header",
  "settings": [
    // Customize settings here
  ]
}
{% endschema %}
```

### Customizing Existing Widgets

Edit existing widget files in `theme/widgets/`:

```liquid
<!-- theme/widgets/product.liquid -->
<div class="widget product-widget">
  <!-- Your custom widget styling -->
  <h3>{{ widget.settings.title }}</h3>
</div>
```

### Working with Widgets

Widgets are dynamic content components managed through the O2VEND admin panel. They are loaded from the O2VEND API:

```liquid
{% for widget in widgets.section %}
  <div class="widget-container">
    {{ widget | render_widget }}
  </div>
{% endfor %}

{% unless widgets.section %}
  <!-- Fallback content when no widgets -->
  <p>No widgets configured for this section.</p>
{% endunless %}
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

> **Important:** Templates, sections, and widgets are **predefined by O2VEND** and come from the O2VEND Storefront API. You can customize existing files but cannot create new templates, sections, or widgets.

### Layouts

Layouts define the HTML structure of pages:

- `theme/layout/theme.liquid` - Main theme layout (customizable)

### Templates

Templates define specific page types (all predefined by O2VEND):

- `templates/index.liquid` - Homepage template
- `templates/product-detail.liquid` - Product page template
- `templates/products.liquid` - Product listing template
- `templates/categories.liquid` - Category listing template
- `templates/cart.liquid` - Shopping cart template
- `templates/search.liquid` - Search results template
- `templates/page.liquid` - Custom page template
- `templates/error.liquid` - Error page template
- And more...

**Note:** All templates are provided by O2VEND. You can customize them but cannot create new ones.

### Sections

Sections are reusable components (all predefined by O2VEND):

- `sections/header.liquid` - Site header section
- `sections/footer.liquid` - Site footer section
- `sections/hero.liquid` - Hero banner section
- `sections/content.liquid` - Content section
- And more...

**Note:** All sections are provided by O2VEND. You can customize them but cannot create new ones.

### Widgets

Widgets are dynamic content components loaded from the O2VEND API (all predefined):

- `widgets/product.liquid` - Product widget template
- `widgets/product-carousel.liquid` - Product carousel widget template
- `widgets/category-list.liquid` - Category list widget template
- `widgets/brand-carousel.liquid` - Brand carousel widget template
- And many more...

**Note:** All widget templates are provided by O2VEND. Widgets themselves are managed through the O2VEND admin panel and loaded via the Storefront API. You can customize widget templates but cannot create new widget types.

### Snippets

Snippets are reusable code fragments that you can use across templates:

- `snippets/product-card.liquid` - Product card component
- `snippets/cart-drawer.liquid` - Shopping cart drawer
- `snippets/pagination.liquid` - Pagination component
- And more...

**Note:** Snippets are reusable components you can create and use within your theme templates.

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

- **[O2VEND Developer Documentation](https://o2vend.com/developer/)** - Complete API documentation and guides
- **[O2VEND Liquid VS Code Extension](https://marketplace.visualstudio.com/items?itemName=O2VEND.o2vend-liquid)** - Syntax highlighting and IntelliSense for O2VEND Liquid templates

## Support & Resources

- **[O2VEND Developer Documentation](https://o2vend.com/developer/)** - Complete API documentation and guides
- **Support Email:** support@o2vend.com or developer@jeyantechnologies.com
- **Support Desk:** [O2VEND Support Portal](https://o2vend.atlassian.net/servicedesk/customer/portals)
- **Community:** [O2VEND Community Program](https://o2vend.com/community)
- **Partnership:** [O2VEND Partnership Program](https://o2vend.com/partnership)
- **Developer Portal:** [www.o2vend.com](https://www.o2vend.com)

## License

MIT License - See LICENSE file for details