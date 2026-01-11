# Marketplace Theme Structure Verification

## ✅ Theme Structure Matches Marketplace Requirements

The theme stored in the starter repository is structured correctly for O2VEND marketplace submission.

## Current Theme Structure

```
theme/
├── theme.json.example     # Template for marketplace manifest
├── layout/
│   └── theme.liquid
├── templates/
│   └── ... (all template files)
├── sections/
│   └── ... (all section files)
├── widgets/
│   └── ... (all widget files)
├── snippets/
│   └── ... (all snippet files)
├── assets/
│   └── ... (CSS, JS, images)
├── config/
│   ├── settings_schema.json
│   └── settings_data.json
└── migrations/            # Migration scripts folder (optional)
    ├── README.md
    └── example-v1.0.0-to-v1.0.1.js.example
```

## Marketplace Package Structure

When packaged using `o2vend package`, the ZIP file will have:

```
theme.zip
├── theme.json              # Manifest file (required by marketplace)
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
└── migrations/             # Migration scripts (optional)
    └── v1.0.0-to-v1.0.1.js
```

## Marketplace Requirements Compliance

### ✅ Required Structure

- **Layout files** (`layout/`) - ✅ Present
- **Template files** (`templates/`) - ✅ Present
- **Section files** (`sections/`) - ✅ Present
- **Widget files** (`widgets/`) - ✅ Present
- **Snippet files** (`snippets/`) - ✅ Present
- **Asset files** (`assets/`) - ✅ Present
- **Config files** (`config/`) - ✅ Present
- **Migrations folder** (`migrations/`) - ✅ Present (optional for first version)

### ✅ theme.json Manifest

The CLI `package` command ensures `theme.json` is included:

1. **Checks for existing `theme.json`** - Uses if found
2. **Falls back to `theme.json.example`** - Copies and fills values
3. **Generates minimal `theme.json`** - If neither exists

**Required fields in theme.json:**
- ✅ `id` - Theme identifier
- ✅ `name` - Display name
- ✅ `version` - Semantic version
- ✅ `author` - Author name
- ✅ `description` - Theme description
- ✅ `migration` - Migration info (can be minimal for first version)
  - ✅ `files` - File change information
  - ✅ `script` - Path to migration script (optional, can be null)
- ✅ `compatibility` - Compatibility requirements

### Migration Scripts

Migration scripts are stored in the `migrations/` folder:

- **Naming pattern:** `v{fromVersion}-to-v{toVersion}.js`
- **Example:** `v1.0.0-to-v1.0.1.js`
- **Location in package:** `migrations/v1.0.0-to-v1.0.1.js`
- **Referenced in theme.json:** `"script": "migrations/v1.0.0-to-v1.0.1.js"`

**For first version (v1.0.0):**
- Migration scripts are **optional** (set `"script": null` in theme.json)
- Migrations folder can be empty or not included

**For version upgrades:**
- Create migration scripts in `migrations/` folder
- Reference in `theme.json` migration.script field
- CLI includes migrations folder automatically

### Marketplace Storage Structure

When uploaded to marketplace, themes are stored in S3 at:
```
published/themes/{themeId}/v{version}/theme.json
published/themes/{themeId}/v{version}/layout/
published/themes/{themeId}/v{version}/templates/
published/themes/{themeId}/v{version}/migrations/
  └── v{fromVersion}-to-v{toVersion}.js
...
```

The ZIP package structure matches this (without the version folder, which is added by marketplace).

## Packaging Process

### Using CLI (Recommended)

```bash
cd theme  # Or use --cwd option
o2vend package \
  --theme-id "default" \
  --theme-name "Default Theme" \
  --theme-version "1.0.0" \
  --author "O2VEND" \
  --output "../dist/theme.zip"
```

The CLI will:
1. ✅ Read or generate `theme.json`
2. ✅ Validate required fields
3. ✅ Create ZIP with `theme.json` at root
4. ✅ Include all theme files
5. ✅ Include `migrations/` folder (if it exists)
6. ✅ Exclude development files (.env, .git, node_modules, etc.)
7. ✅ Exclude example files (*.example, README.md in migrations)

### Manual Process

If packaging manually:
1. Create `theme.json` at theme root
2. Create ZIP with `theme.json` at root level
3. Include all theme directories (layout, templates, sections, widgets, snippets, assets, config)
4. Include `migrations/` folder if migration scripts exist
5. Exclude development files

## Verification Checklist

- [x] Theme structure matches marketplace requirements
- [x] All required directories present (layout, templates, sections, widgets, snippets, assets, config)
- [x] `migrations/` folder present (for version upgrades)
- [x] `theme.json.example` template provided
- [x] Migration scripts example provided
- [x] CLI `package` command implemented
- [x] CLI generates `theme.json` correctly
- [x] CLI packages ZIP with correct structure (including migrations)
- [x] CLI excludes example files from migrations
- [x] Documentation provided (THEME_PACKAGING.md, migrations/README.md)
- [x] README updated with marketplace submission info

## Notes

1. **Development vs Marketplace:**
   - For **development**: Use the theme directory structure as-is
   - For **marketplace**: Package using `o2vend package` (adds `theme.json`, includes migrations)

2. **theme.json Location:**
   - In **development**: `theme.json` is optional (can use `theme.json.example`)
   - In **package**: `theme.json` is required at ZIP root
   - CLI handles this automatically

3. **Migrations Folder:**
   - In **development**: Include migrations folder structure
   - In **package**: Migrations folder is included if it exists
   - Example files (`.example`) and README.md are excluded from package
   - Only actual migration scripts (`.js` files) are included

4. **Version Management:**
   - Update `theme.json` version for each release
   - Add migration info for updates
   - Create migration scripts in `migrations/` folder when needed
   - Follow semantic versioning (1.0.0, 1.0.1, 1.1.0, 2.0.0)

## Conclusion

✅ **The theme structure in the starter repository is correctly structured for O2VEND marketplace.**

The CLI `package` command ensures marketplace compliance by:
- Generating or using `theme.json` manifest
- Creating ZIP with correct structure
- Including all required files
- Including `migrations/` folder when migration scripts exist
- Excluding development files
- Excluding example files from migrations

Developers can develop themes locally and package them for marketplace submission using the CLI.