# Theme Packaging for Marketplace

This guide explains how to package your theme for O2VEND marketplace submission.

## Marketplace Theme Structure

O2VEND marketplace expects themes to be packaged with a `theme.json` manifest file at the root of the theme package.

### Required Structure

```
theme.zip
├── theme.json          # Theme manifest (required)
├── layout/
│   └── theme.liquid
├── templates/
│   └── ...
├── sections/
│   └── ...
├── widgets/
│   └── ...
├── snippets/
│   └── ...
├── assets/
│   └── ...
├── config/
│   └── ...
└── migrations/         # Migration scripts (optional)
    └── v1.0.0-to-v1.0.1.js
```

## theme.json Format

The `theme.json` file must follow the O2VEND marketplace structure (see `docs/THEME_JSON_STRUCTURE.md` in webstore repository).

### Required Fields

- `id` (string): Unique theme identifier
- `name` (string): Display name
- `version` (string): Semantic version (e.g., "1.0.0")
- `author` (string): Author name
- `description` (string): Theme description

### Example (Minimal)

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A beautiful O2VEND theme",
  "migration": {
    "files": {
      "modified": [],
      "added": [],
      "deleted": []
    },
    "script": null
  },
  "compatibility": {
    "minO2VENDVersion": "1.0.0",
    "dependencies": []
  }
}
```

## Packaging Your Theme

### Using CLI (Recommended)

```bash
# Package with default options
o2vend package

# Package with custom metadata
o2vend package \
  --theme-id "my-theme" \
  --theme-name "My Theme" \
  --theme-version "1.0.0" \
  --author "Your Name" \
  --output "dist/my-theme-v1.0.0.zip"
```

### Options

- `--output <path>`: Output ZIP file path (default: `dist/theme.zip`)
- `--validate`: Run validation before packaging
- `--theme-id <id>`: Theme ID for theme.json
- `--theme-name <name>`: Theme name for theme.json
- `--theme-version <version>`: Theme version
- `--author <author>`: Author name
- `--exclude <patterns>`: Comma-separated patterns to exclude

### Using theme.json.example

1. **Copy template:**
   ```bash
   cp theme.json.example theme.json
   ```

2. **Edit theme.json:**
   ```json
   {
     "id": "my-theme",
     "name": "My Theme",
     "version": "1.0.0",
     "author": "Your Name",
     "description": "Your theme description"
   }
   ```

3. **Package theme:**
   ```bash
   o2vend package
   ```

   The CLI will use your `theme.json` file automatically.

### Manual Packaging

If you prefer to package manually:

1. **Create theme.json:**
   Create `theme.json` in your theme root directory following the format above.

2. **Create ZIP file:**
   ```bash
   cd theme
   zip -r ../theme.zip . -x "*.example" ".env*" ".git*" "node_modules/*" ".vscode/*"
   ```

3. **Verify structure:**
   ```bash
   unzip -l theme.zip | head -20
   ```
   
   Ensure `theme.json` is at the root of the ZIP.

## Marketplace Submission

After packaging:

1. **Validate package:**
   ```bash
   o2vend validate
   ```

2. **Upload to marketplace:**
   - Log in to O2VEND marketplace
   - Go to "Submit Theme"
   - Upload `dist/theme.zip`
   - Fill in marketplace listing details
   - Submit for review

## Version Management

For theme updates:

1. **Increment version** in `theme.json`:
   ```json
   {
     "version": "1.0.1",
     "changelog": "Fixed bug in product card layout"
   }
   ```

2. **Add migration information** (for updates):
   ```json
   {
     "migration": {
       "from": "1.0.0",
       "to": "1.0.1",
       "type": "delta",
       "script": "migrations/v1.0.0-to-v1.0.1.js",
       "files": {
         "modified": ["snippets/product-card.liquid"],
         "added": [],
         "deleted": []
       }
     }
   }
   ```

3. **Create migration script** (if needed):
   - Create file: `migrations/v1.0.0-to-v1.0.1.js`
   - See `migrations/README.md` for script format
   - Migration scripts are optional (only if data transformation needed)

4. **Package and submit:**
   ```bash
   o2vend package --theme-version "1.0.1"
   ```
   
   The package will include:
   - All theme files
   - `theme.json` manifest
   - `migrations/` folder (if migration scripts exist)

## Notes

- `theme.json` must be valid JSON (no comments)
- Version must follow semantic versioning (e.g., "1.0.0")
- All required fields must be present
- Package size should be reasonable (optimize assets)
- Test your theme package before submission

## Resources

- [O2VEND Marketplace Theme Structure](../docs/THEME_JSON_STRUCTURE.md)
- [Semantic Versioning](https://semver.org/)
- [Theme Development Guide](./GETTING_STARTED.md)
