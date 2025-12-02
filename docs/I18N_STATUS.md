# i18n System Status & Migration Guide

**Last Updated:** 2025-12-02
**Current Coverage:** 1,048 hardcoded strings in 51 files
**Target:** 100% coverage using JSON-based system

## 🎯 Current State

### ✅ Completed

1. **JSON Translation Files Generated**
   - `lib/i18n/translations/ko.json` - 419 Korean translations
   - `lib/i18n/translations/en.json` - 419 English translations
   - All AI-translated and ready to use

2. **New i18n System Implemented**
   - `lib/i18n/index.json.ts` - New `useTranslation()` hook
   - `lib/i18n/translations.json.ts` - Type-safe translation utilities
   - Supports nested keys like `campaigns.create.title`

3. **Automation Scripts Created**
   - `scripts/i18n/generate-json-translations.ts` - Generate JSON from code
   - `scripts/i18n/refactor-to-json-keys.ts` - Automated code refactoring
   - `scripts/i18n/scan-hardcoded-strings.ts` - Comprehensive scanning

### ⚠️ Issues Fixed

1. **React Version Mismatch** - Cleared node_modules cache
2. **Nested pick() Calls** - Restored from backups
3. **Build Cache** - Cleared `.next` directory

### ⏳ Remaining Work

**1,048 hardcoded strings** across **51 files** still need migration:

#### Top Priority Files (Most Strings)

1. `components/features/create/GenerateMode.tsx` - 100 strings
2. `app/(dashboard)/insights/page.tsx` - 90 strings
3. `components/features/create/QuickCreateMode.tsx` - 69 strings
4. `app/(dashboard)/campaigns/[id]/compose/page.tsx` - 68 strings
5. `components/features/variation-modal.tsx` - 68 strings

#### File Categories

- **Dashboard Pages:** 15 files, ~300 strings
- **Create Components:** 6 files, ~280 strings
- **Feature Components:** 20 files, ~350 strings
- **Layout Components:** 5 files, ~60 strings
- **Shared Components:** 5 files, ~58 strings

## 🚀 Recommended Migration Path

### Option 1: Gradual Migration (RECOMMENDED)

Migrate files one-by-one in priority order:

```bash
# 1. Review current state
npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan.json

# 2. Test on single file first
npx ts-node scripts/i18n/refactor-to-json-keys.ts --file components/ui/spinner.tsx --dry-run

# 3. Apply to single file
npx ts-node scripts/i18n/refactor-to-json-keys.ts --file components/ui/spinner.tsx

# 4. Test the app
npm run dev

# 5. Repeat for each file in priority order
```

### Option 2: Bulk Migration

Migrate all files at once (higher risk):

```bash
# 1. Create backups first
git add . && git commit -m "Before i18n migration"

# 2. Preview changes
npx ts-node scripts/i18n/refactor-to-json-keys.ts --dry-run

# 3. Apply all changes
npx ts-node scripts/i18n/refactor-to-json-keys.ts

# 4. Test thoroughly
npm run dev

# 5. Fix any issues
# ...

# 6. If successful, remove backups
find . -name "*.json-backup" -delete
```

## 📝 Migration Checklist

### Before Migration

- [ ] Commit all changes to git
- [ ] Run full test suite
- [ ] Document any custom translation patterns
- [ ] Review `scan-comprehensive.json` for coverage

### During Migration

- [ ] Start with low-risk files (utilities, small components)
- [ ] Test after each batch
- [ ] Keep backup files until verified
- [ ] Update any custom i18n code

### After Migration

- [ ] Verify all pages load without errors
- [ ] Test language switching
- [ ] Check for missing translations
- [ ] Update documentation
- [ ] Remove backup files

## 🔧 Common Issues & Solutions

### Issue: "language is not defined"

**Solution:** Clear build cache
```bash
rm -rf .next
npm run dev
```

### Issue: Nested pick() calls

**Solution:** Restore from backup
```bash
# Find the backup
find . -name "*.i18n-backup"

# Restore specific file
mv path/to/file.tsx.i18n-backup path/to/file.tsx
```

### Issue: Missing translation key

**Solution:** Add to JSON files
```bash
# 1. Add to lib/i18n/translations/ko.json
{
  "category": {
    "newKey": "새 번역"
  }
}

# 2. Add to lib/i18n/translations/en.json
{
  "category": {
    "newKey": "New translation"
  }
}

# 3. Use in code
const { t } = useTranslation();
<div>{t('category.newKey')}</div>
```

## 📊 Coverage by Directory

| Directory | Files | Strings | Priority |
|-----------|-------|---------|----------|
| `app/(dashboard)/campaigns/` | 10 | 250 | HIGH |
| `components/features/create/` | 6 | 280 | HIGH |
| `app/(dashboard)/insights/` | 1 | 90 | HIGH |
| `app/(dashboard)/pipeline/` | 2 | 106 | HIGH |
| `components/features/` | 14 | 300 | MEDIUM |
| `components/shared/` | 5 | 58 | MEDIUM |
| `components/layout/` | 5 | 60 | LOW |
| `app/(dashboard)/create/` | 3 | 40 | LOW |

## 📚 Usage Examples

### Before (Current - Inline)

```tsx
import { useI18n } from "@/lib/i18n";

function Component() {
  const { language } = useI18n();

  return (
    <div>
      {language === "ko" ? "저장" : "Save"}
    </div>
  );
}
```

### After (Target - JSON-based)

```tsx
import { useTranslation } from "@/lib/i18n/index.json";

function Component() {
  const { t } = useTranslation();

  return (
    <div>
      {t('common.save')}
    </div>
  );
}
```

### With Parameters

```tsx
// Translation: "Found {count} items"
const { t } = useTranslation();

<p>{t('search.results', { count: items.length })}</p>
```

## 🎯 Next Steps

1. **Clear Build Cache** - Done ✅
2. **Test Current App** - Verify no errors
3. **Choose Migration Strategy** - Gradual or Bulk
4. **Start Migration** - Follow checklist above
5. **Test Each Batch** - Ensure quality
6. **Complete Coverage** - Reach 100%

## 📖 Documentation

- **Full Guide:** `scripts/i18n/README-JSON.md`
- **Original System:** `scripts/i18n/README.md`
- **Translation Files:** `lib/i18n/translations/`
- **Scan Results:** `scan-comprehensive.json`

## 🆘 Support

If you encounter issues:

1. Check this document
2. Review `scripts/i18n/README-JSON.md`
3. Restore from `.i18n-backup` files
4. Clear cache: `rm -rf .next`
5. Check git history for working state

---

**Status:** Ready for migration
**Recommended:** Start with gradual migration (Option 1)
**Timeline:** ~2-3 days for full coverage with testing
