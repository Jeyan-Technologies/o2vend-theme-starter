# Getting Started with O2VEND Theme Development

Welcome to O2VEND theme development! This guide will help you get started quickly.

## Step 1: Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **VS Code or Cursor** - [Download VS Code](https://code.visualstudio.com/) | [Download Cursor](https://cursor.sh/)
- **Git** - [Download](https://git-scm.com/)

## Step 2: Clone and Setup

1. **Clone the starter repository:**
   ```bash
   git clone https://github.com/Jeyan-Technologies/o2vend-theme-starter.git
   cd o2vend-theme-starter
   ```

2. **Run the setup script:**
   
   **Windows:**
   ```powershell
   .\setup.ps1
   ```
   
   **Mac/Linux:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
   
   The script will automatically:
   - Install O2VEND Theme CLI globally
   - Install VS Code/Cursor extension
   - Create configuration files
   - Set up the development environment

## Step 3: Start Developing

1. **Start the development server:**
   ```bash
   o2vend serve
   ```

2. **Open your browser:**
   - The server will automatically open at `http://localhost:3000`
   - Hot reload is enabled - changes will automatically refresh

3. **Start editing:**
   - Open the `theme/` directory in VS Code/Cursor
   - Make changes to Liquid templates, CSS, or JavaScript
   - See changes instantly in your browser

## Step 4: Understanding the Theme Structure

```
theme/
├── layout/
│   └── theme.liquid          # Main layout wrapper
├── templates/
│   ├── index.liquid          # Homepage
│   ├── product-detail.liquid # Product page
│   └── ...
├── sections/
│   ├── header.liquid         # Site header
│   ├── footer.liquid         # Site footer
│   └── ...
├── widgets/
│   ├── product.liquid        # Product widget
│   ├── product-carousel.liquid
│   └── ...
├── snippets/
│   ├── product-card.liquid   # Reusable components
│   └── ...
├── assets/
│   ├── theme.css             # Main stylesheet
│   ├── theme.js              # Main JavaScript
│   └── ...
└── config/
    ├── settings_schema.json  # Theme settings definition
    └── settings_data.json    # Theme settings values
```

## Step 5: Your First Change

Let's modify the homepage:

1. **Open `theme/templates/index.liquid`**
2. **Add a welcome message:**
   ```liquid
   {% layout 'theme' %}
   
   <div class="homepage">
     <h1>Welcome to {{ shop.name }}!</h1>
     <p>Start building your theme here.</p>
     
     {% for widget in widgets.hero %}
       {{ widget | render_widget }}
     {% endfor %}
   </div>
   ```
3. **Save the file** - The browser will automatically reload!

## Step 6: Working with Widgets

Widgets are dynamic content components managed in the O2VEND admin:

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

## Step 7: Using Liquid Filters

O2VEND provides many helpful filters:

```liquid
<!-- Format money -->
{{ product.price | money }}
{{ product.price | money_with_currency: 'USD' }}

<!-- Generate URLs -->
{{ product | product_url }}
{{ collection | collection_url }}

<!-- String manipulation -->
{{ product.title | upcase }}
{{ product.description | truncate: 100 }}
```

## Step 8: Theme Settings

Define customizable settings in `config/settings_schema.json`:

```json
{
  "name": "Theme Settings",
  "settings": [
    {
      "type": "text",
      "id": "primary_color",
      "label": "Primary Color",
      "default": "#000000"
    }
  ]
}
```

Use in templates:

```liquid
<div style="color: {{ settings.primary_color }}">
  This text uses the primary color setting.
</div>
```

## Step 9: Testing

Test your theme in different scenarios:

1. **Mock Mode (Default):**
   ```bash
   o2vend serve --mode mock
   ```
   Uses realistic mock data - perfect for development

2. **Real API Mode:**
   ```bash
   # Set environment variables first
   export O2VEND_TENANT_ID=your-tenant-id
   export O2VEND_API_KEY=your-api-key
   export O2VEND_API_BASE_URL=https://api.yourdomain.com
   
   o2vend serve --mode real
   ```
   Connects to a real O2VEND store

## Step 10: Packaging Your Theme

When ready to submit to marketplace:

```bash
# Validate theme first
o2vend validate

# Package theme
o2vend package

# Theme package will be in dist/theme.zip
```

## Next Steps

- Explore the default theme templates
- Customize widgets and sections
- Add your own assets (CSS, JS, images)
- Read the [full documentation](../README.md)
- Check out [O2VEND Theme API docs](https://docs.o2vend.com/themes)

## Common Commands

```bash
# Start dev server
o2vend serve

# Initialize new theme
o2vend init my-theme

# Validate theme
o2vend validate

# Check for issues
o2vend check

# Package for marketplace
o2vend package

# Optimize assets
o2vend optimize
```

## Getting Help

- **Documentation:** [README.md](../README.md)
- **Issues:** [GitHub Issues](https://github.com/Jeyan-Technologies/o2vend-theme-starter/issues)
- **Support:** [O2VEND Support](https://support.o2vend.com)

Happy theme developing! 🎨