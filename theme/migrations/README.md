# Theme Migration Scripts

This folder contains migration scripts for theme version updates.

## Migration Script Structure

Migration scripts are named using the pattern:
```
v{fromVersion}-to-v{toVersion}.js
```

Example:
- `v1.0.0-to-v1.0.1.js` - Migrates from version 1.0.0 to 1.0.1
- `v1.0.0-to-v2.0.0.js` - Migrates from version 1.0.0 to 2.0.0

## Migration Script Format

Migration scripts should export an async function that receives a context object:

```javascript
module.exports = async function(context) {
  const { tenantId, themeId, fromVersion, toVersion, s3Client, tenantBucket } = context;
  
  // Custom migration logic here
  // Example: Update configuration files, transform data, etc.
  
  console.log(`Migrating ${themeId} from ${fromVersion} to ${toVersion} for tenant ${tenantId}`);
  
  // Example: Update settings_data.json
  // const settingsPath = `themes/${tenantId}/${themeId}/config/settings_data.json`;
  // const settings = await getSettingsFromS3(s3Client, tenantBucket, settingsPath);
  // settings.updatedFeature = true;
  // await saveSettingsToS3(s3Client, tenantBucket, settingsPath, settings);
};
```

## Context Object

The context object provides:

- `tenantId` (string): The tenant ID being migrated
- `themeId` (string): The theme ID
- `fromVersion` (string): Source version (e.g., "1.0.0")
- `toVersion` (string): Target version (e.g., "2.0.0")
- `s3Client` (AWS S3 Client): S3 client for accessing tenant bucket
- `tenantBucket` (string): Tenant S3 bucket name

## When to Create Migration Scripts

Create migration scripts when:

1. **Configuration Changes** - Settings structure changed
2. **Data Transformations** - Need to transform existing data
3. **File Renames** - Files were renamed or moved
4. **Breaking Changes** - Structure changes that need migration
5. **New Default Values** - Adding new settings with defaults

## Examples

### Example 1: Update Settings Structure

```javascript
module.exports = async function(context) {
  const { tenantId, themeId, s3Client, tenantBucket } = context;
  
  const settingsPath = `themes/${tenantId}/${themeId}/config/settings_data.json`;
  
  try {
    // Get current settings
    const settings = await getSettingsFromS3(s3Client, tenantBucket, settingsPath);
    
    // Transform structure
    if (!settings.current) {
      settings.current = {};
    }
    
    // Migrate old settings to new structure
    if (settings.colors) {
      settings.current.colors = settings.colors;
      delete settings.colors;
    }
    
    // Save updated settings
    await saveSettingsToS3(s3Client, tenantBucket, settingsPath, settings);
    
    console.log(`Successfully migrated settings for tenant ${tenantId}`);
  } catch (error) {
    console.error(`Migration error: ${error.message}`);
    throw error;
  }
};
```

### Example 2: Add New Setting with Default

```javascript
module.exports = async function(context) {
  const { tenantId, themeId, s3Client, tenantBucket } = context;
  
  const settingsPath = `themes/${tenantId}/${themeId}/config/settings_data.json`;
  
  try {
    const settings = await getSettingsFromS3(s3Client, tenantBucket, settingsPath);
    
    // Add new setting with default value
    if (!settings.current) {
      settings.current = {};
    }
    
    if (!settings.current.newFeature) {
      settings.current.newFeature = {
        enabled: true,
        value: 'default'
      };
    }
    
    await saveSettingsToS3(s3Client, tenantBucket, settingsPath, settings);
    
    console.log(`Added new feature setting for tenant ${tenantId}`);
  } catch (error) {
    console.error(`Migration error: ${error.message}`);
    throw error;
  }
};
```

## Notes

- Migration scripts are **optional** - only include if needed
- Scripts run **after** theme files are updated
- Scripts have access to S3 client for tenant bucket operations
- Scripts should be **idempotent** (safe to run multiple times)
- Handle errors gracefully and log appropriately
- Test migration scripts thoroughly before publishing

## Packaging

When packaging your theme:

1. Include migration scripts in the `migrations/` folder
2. Reference scripts in `theme.json`:
   ```json
   {
     "migration": {
       "from": "1.0.0",
       "to": "2.0.0",
       "script": "migrations/v1.0.0-to-v2.0.0.js"
     }
   }
   ```
3. The CLI `package` command will include the migrations folder automatically

## For First Version

For the first version (v1.0.0), you don't need migration scripts:

```json
{
  "migration": {
    "files": {
      "modified": [],
      "added": [],
      "deleted": []
    },
    "script": null
  }
}
```

Migration scripts are only needed for version upgrades.
