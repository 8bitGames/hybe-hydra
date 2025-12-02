# JSON-Based i18n System (RECOMMENDED) ⭐

Complete i18n system using structured JSON translation files (`ko.json` + `en.json`).

## Overview

This is the **recommended** approach for managing translations in the codebase. It provides:

✅ **Centralized translations** in JSON files
✅ **Type-safe translation keys** with autocomplete
✅ **AI-powered generation** from scan results
✅ **Systematic approach** to full i18n coverage
✅ **Better organization** with nested keys

## Quick Start

```bash
# 1. Scan codebase for hardcoded strings
npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json

# 2. Generate JSON translation files with AI
GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json

# 3. Refactor code to use translation keys (dry-run first)
npx ts-node scripts/i18n/refactor-to-json-keys.ts --dry-run

# 4. Apply refactoring
npx ts-node scripts/i18n/refactor-to-json-keys.ts
```

## Architecture

### Files Structure

```
lib/i18n/
├── translations/
│   ├── ko.json              # Korean translations
│   └── en.json              # English translations
├── translations.json.ts     # Translation utilities
└── index.json.ts           # Hooks (useTranslation)

scripts/i18n/
├── generate-json-translations.ts    # Generate JSON from scan
├── refactor-to-json-keys.ts        # Replace inline strings with keys
└── output/
    └── translations-flat.json       # Flat format for reference
```

### JSON Structure

**lib/i18n/translations/ko.json:**
```json
{
  "campaigns": {
    "create": {
      "title": "캠페인 만들기",
      "description": "새 캠페인을 시작하세요"
    },
    "list": {
      "empty": "캠페인이 없습니다"
    }
  },
  "common": {
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제"
  }
}
```

**lib/i18n/translations/en.json:**
```json
{
  "campaigns": {
    "create": {
      "title": "Create Campaign",
      "description": "Start a new campaign"
    },
    "list": {
      "empty": "No campaigns"
    }
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  }
}
```

## Usage in Code

### Basic Translation

```tsx
import { useTranslation } from "@/lib/i18n/index.json";

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('campaigns.create.title')}</h1>
      <p>{t('campaigns.create.description')}</p>

      <Button>{t('common.save')}</Button>
      <Button>{t('common.cancel')}</Button>
    </div>
  );
}
```

### With Parameters

```tsx
const { t } = useTranslation();

// Translation: "Found {count} campaigns"
<p>{t('campaigns.list.count', { count: 5 })}</p>

// Translation: "Welcome, {name}!"
<h1>{t('common.welcome', { name: user.name })}</h1>
```

### Get Both Languages

```tsx
const { both } = useTranslation();

const texts = both('campaigns.create.title');
// { ko: "캠페인 만들기", en: "Create Campaign" }

<BilingualLabel ko={texts.ko} en={texts.en} />
```

### Language Switching

```tsx
const { language, setLanguage, toggleLanguage } = useTranslation();

<Button onClick={() => setLanguage('ko')}>한국어</Button>
<Button onClick={() => setLanguage('en')}>English</Button>
<Button onClick={toggleLanguage}>Toggle</Button>
```

## Scripts

### 1. generate-json-translations.ts

Generates structured JSON translation files from scan results using AI.

**Features:**
- Collects unique strings from scan results
- Generates semantic nested keys (e.g., `campaigns.create.title`)
- AI-translates missing strings using Gemini
- Creates both nested JSON and flat JSON

**Usage:**
```bash
# Preview what will be generated
GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json --dry-run

# Generate JSON files
GEMINI_API_KEY=xxx npx ts-node scripts/i18n/generate-json-translations.ts scan-report.json
```

**Output:**
- `lib/i18n/translations/ko.json` - Korean translations (nested)
- `lib/i18n/translations/en.json` - English translations (nested)
- `scripts/i18n/output/translations-flat.json` - Flat format for reverse lookup

### 2. refactor-to-json-keys.ts

Replaces inline strings and `pick()` calls with `t('translation.key')` calls.

**Features:**
- Finds translation keys by text content
- Replaces multiple patterns:
  - `pick("한글", "English")` → `t('key')`
  - `{language === "ko" ? "한글" : "English"}` → `{t('key')}`
  - Standalone Korean strings → `{t('key')}`
- Updates imports and hooks automatically
- Creates `.json-backup` files

**Usage:**
```bash
# Preview changes
npx ts-node scripts/i18n/refactor-to-json-keys.ts --dry-run

# Apply to all files
npx ts-node scripts/i18n/refactor-to-json-keys.ts

# Apply to specific file
npx ts-node scripts/i18n/refactor-to-json-keys.ts --file app/(dashboard)/campaigns/page.tsx
```

## Migration Guide

### From Inline pick() to JSON Keys

**Before:**
```tsx
import { useT } from "@/lib/i18n/components";

function Component() {
  const { pick } = useT();

  return (
    <div>
      <h1>{pick("캠페인 만들기", "Create Campaign")}</h1>
      <Button>{pick("저장", "Save")}</Button>
    </div>
  );
}
```

**After:**
```tsx
import { useTranslation } from "@/lib/i18n/index.json";

function Component() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('campaigns.create.title')}</h1>
      <Button>{t('common.save')}</Button>
    </div>
  );
}
```

### From useI18n() to useTranslation()

**Before:**
```tsx
import { useI18n } from "@/lib/i18n";

function Component() {
  const { language } = useI18n();

  return (
    <div>
      {language === "ko" ? "안녕하세요" : "Hello"}
    </div>
  );
}
```

**After:**
```tsx
import { useTranslation } from "@/lib/i18n/index.json";

function Component() {
  const { t } = useTranslation();

  return (
    <div>
      {t('common.hello')}
    </div>
  );
}
```

## Comparison

| Feature | Inline pick() | JSON-based (NEW) ⭐ |
|---------|--------------|---------------------|
| **Centralized** | ❌ Scattered | ✅ Single source |
| **Type-safe** | ⚠️ Manual | ✅ Auto-complete |
| **Maintenance** | ⚠️ Hard to find | ✅ Easy to update |
| **Reusability** | ❌ Duplicate strings | ✅ Shared keys |
| **Translation workflow** | ❌ In code | ✅ Separate files |
| **Scalability** | ⚠️ OK for small | ✅ Great for large |
| **Coverage tracking** | ⚠️ Difficult | ✅ Easy with keys |

## Best Practices

1. **Use semantic keys**
   ```tsx
   // Good
   t('campaigns.create.title')
   t('common.actions.save')

   // Avoid
   t('campaigns.page.string-123')
   ```

2. **Group related translations**
   ```json
   {
     "campaigns": {
       "create": { ... },
       "edit": { ... },
       "delete": { ... }
     }
   }
   ```

3. **Use parameters for dynamic content**
   ```tsx
   // Translation: "Found {count} results"
   t('search.results', { count: results.length })
   ```

4. **Keep translations short and contextual**
   ```json
   {
     "common": {
       "save": "Save",
       "saveAndContinue": "Save & Continue"
     }
   }
   ```

5. **Test with both languages**
   ```tsx
   // Ensure UI works in both languages
   <Button>{t('common.save')}</Button> // "저장" or "Save"
   ```

## Advantages of JSON-Based System

### 1. Centralized Management
All translations in one place - easy to update, review, and manage.

### 2. Type Safety
TypeScript autocomplete for translation keys - catch errors at compile time.

### 3. Easy Translation Workflow
Translators can work directly with JSON files without touching code.

### 4. Better Organization
Nested keys provide clear structure (e.g., `campaigns.create.title`).

### 5. Reusability
Common translations like "Save", "Cancel" used across components.

### 6. Version Control
Track translation changes in git with clear diffs.

### 7. AI-Powered Generation
Automatically generate translations from existing codebase.

## Troubleshooting

### Missing translation key

If you see `[i18n] Missing translation: some.key (ko)` in console:

1. Check if key exists in `ko.json`
2. Ensure proper nesting structure
3. Re-run `generate-json-translations.ts` if needed

### Type errors with translation keys

```bash
# Regenerate types after adding new translations
npm run dev  # TypeScript will pick up changes
```

### Refactor script missed some strings

Use `--file` flag to refactor specific files:
```bash
npx ts-node scripts/i18n/refactor-to-json-keys.ts --file path/to/file.tsx
```

## Statistics

Current coverage (after JSON generation):
- ✅ **424 unique translation entries**
- ✅ **419 Korean translations**
- ✅ **419 English translations**
- ✅ **Nested structure** for better organization
- ✅ **Type-safe keys** with autocomplete

## Next Steps

1. ✅ Generate JSON files
2. ✅ Update i18n hooks
3. ⏳ Refactor components to use `t()`
4. ⏳ Test in both languages
5. ⏳ Remove backup files after verification

## Support

For issues or questions:
1. Check this README
2. Review JSON structure in `lib/i18n/translations/`
3. Test with `--dry-run` flag
4. Check backup files if something breaks
