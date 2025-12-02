# i18n Migration Toolkit

Complete toolkit for migrating hardcoded strings to the i18n system with **AI-powered automation**.

## Overview

This toolkit automates the process of finding, translating, and refactoring hardcoded Korean/English strings in your React codebase using Google Gemini AI.

## 🚀 Quick Start (Fully Automated with AI)

```bash
# 1. Scan for hardcoded strings
npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json

# 2. AI-powered refactoring (RECOMMENDED - does everything!)
GEMINI_API_KEY=your_key npx ts-node scripts/i18n/ai-refactor.ts scan-report.json --dry-run  # Preview
GEMINI_API_KEY=your_key npx ts-node scripts/i18n/ai-refactor.ts scan-report.json             # Apply

# 3. Check coverage
npx ts-node scripts/i18n/coverage-report.ts
```

That's it! The AI script automatically:
- ✅ Detects Korean/English strings
- ✅ Generates missing translations with AI
- ✅ Replaces with `pick()` calls
- ✅ Adds imports and hooks

## 📊 Three Refactoring Approaches

| Approach | Coverage | Speed | Requires | Best For |
|----------|----------|-------|----------|----------|
| **1. ai-refactor.ts** ⭐ | ~90% | Medium | Gemini API | **Fully automated** - handles everything |
| **2. advanced-refactor.ts** | ~70% | Fast | Translation file | Pre-translated strings |
| **3. auto-refactor.ts** | ~12% | Fast | None | Only ternary patterns |

### Approach 1: AI-Powered (RECOMMENDED) ⭐

**Fully automated** - Uses Gemini AI to translate and refactor everything.

```bash
GEMINI_API_KEY=xxx npx ts-node scripts/i18n/ai-refactor.ts scan-report.json --dry-run
```

**Pros:**
- ✅ Handles raw Korean/English text
- ✅ Auto-generates missing translations
- ✅ Highest coverage (~90%)
- ✅ Single command

**Cons:**
- ⏱️ Slower (API calls)
- 💰 Requires API key

### Approach 2: Advanced (Pre-translated)

Uses existing translation file to match and replace strings.

```bash
npx ts-node scripts/i18n/advanced-refactor.ts scan-report.json translations-translated.json --dry-run
```

**Pros:**
- ✅ Fast (no API calls)
- ✅ Good coverage (~70%)
- ✅ Uses verified translations

**Cons:**
- ⚠️ Requires pre-generated translations

### Approach 3: Basic (Ternary only)

Only converts existing ternary patterns like `{language === "ko" ? ... : ...}`.

```bash
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --dry-run
```

**Pros:**
- ✅ Very fast
- ✅ No dependencies

**Cons:**
- ⚠️ Low coverage (~12%)
- ⚠️ Only handles ternary patterns

---

## Scripts

### 1. scan-hardcoded-strings.ts

Scans the codebase for hardcoded Korean and English strings.

**Usage:**
```bash
npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json
```

**Output:**
- `scan-report.json` - Full scan results with file locations

**What it finds:**
- Korean characters (한글)
- JSX text content
- HTML attributes (placeholder, title, aria-label)
- Template strings

### 2. generate-translation-keys.ts

Generates translation keys from scan results.

**Usage:**
```bash
npx ts-node scripts/i18n/generate-translation-keys.ts scan-report.json
```

**Output:**
- `scripts/i18n/output/translations-generated.ts` - TypeScript format
- `scripts/i18n/output/translations-generated.json` - JSON format
- `scripts/i18n/output/translations-generated.csv` - CSV for spreadsheet editing

**Features:**
- Auto-categorizes keys (campaigns, common, settings, etc.)
- Generates semantic key names
- Deduplicates identical strings

### 3. batch-translate.ts

AI-powered batch translation using Google Gemini.

**Usage:**
```bash
# Preview what will be translated
npx ts-node scripts/i18n/batch-translate.ts translations.json --dry-run

# Translate
GEMINI_API_KEY=your_key npx ts-node scripts/i18n/batch-translate.ts translations.json
```

**Output:**
- `translations-translated.json` - Fully translated JSON

**Features:**
- Batches requests for efficiency (20 per batch)
- Bidirectional translation (EN→KO and KO→EN)
- Rate limiting to avoid API throttling
- Preserves placeholders like `{count}`, `{name}`

### 4. auto-refactor.ts ⭐ NEW

Automatically refactors code to use the i18n system.

**Usage:**
```bash
# Preview changes (recommended first)
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --dry-run

# Refactor all files
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json

# Refactor specific file
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --file app/(dashboard)/campaigns/page.tsx
```

**What it does:**
1. Adds `import { useT } from "@/lib/i18n/components"`
2. Replaces `useI18n()` with `useT()`
3. Converts patterns:
   - `{language === "ko" ? "한국어" : "English"}` → `{pick("한국어", "English")}`
   - `{isKorean ? "한국어" : "English"}` → `{pick("한국어", "English")}`
4. Creates `.i18n-backup` files for safety

**Output:**
- `scripts/i18n/output/refactor-results.json` - Detailed results

### 5. coverage-report.ts

Analyzes i18n coverage across the codebase.

**Usage:**
```bash
npx ts-node scripts/i18n/coverage-report.ts

# JSON output
npx ts-node scripts/i18n/coverage-report.ts --json
```

**Output:**
- Terminal: Visual coverage report with progress bars
- `scripts/i18n/output/coverage-report.json` - Full analysis

**Metrics:**
- Overall coverage percentage
- Coverage by directory
- Files needing attention
- Recommendations

## Complete Workflow

### Phase 1: Discovery

```bash
# Scan codebase
npx ts-node scripts/i18n/scan-hardcoded-strings.ts --output scan-report.json

# Review findings
cat scan-report.json | jq '.summary'
```

### Phase 2: Translation Preparation

```bash
# Generate keys
npx ts-node scripts/i18n/generate-translation-keys.ts scan-report.json

# Review generated translations
cat scripts/i18n/output/translations-generated.json
```

### Phase 3: AI Translation

```bash
# Set API key
export GEMINI_API_KEY=your_api_key

# Translate
npx ts-node scripts/i18n/batch-translate.ts scripts/i18n/output/translations-generated.json

# Review translations
cat scripts/i18n/output/translations-generated-translated.json
```

### Phase 4: Code Refactoring

```bash
# Preview changes
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --dry-run

# Apply refactoring
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json

# Test application
npm run dev

# If everything works, remove backups
find . -name "*.i18n-backup" -delete
```

### Phase 5: Verification

```bash
# Check coverage
npx ts-node scripts/i18n/coverage-report.ts

# Target: 80%+ coverage
```

## Manual Refactoring Patterns

For files that need manual attention:

### Pattern 1: Simple Text

**Before:**
```tsx
{language === "ko" ? "안녕하세요" : "Hello"}
```

**After:**
```tsx
{pick("안녕하세요", "Hello")}
```

### Pattern 2: With Parameters

**Before:**
```tsx
{language === "ko" ? `${count}개 항목` : `${count} items`}
```

**After:**
```tsx
{pick("{count}개 항목", "{count} items", { count })}
```

### Pattern 3: Component Props

**Before:**
```tsx
<Button>
  {language === "ko" ? "저장" : "Save"}
</Button>
```

**After:**
```tsx
<Button>
  {pick("저장", "Save")}
</Button>
```

### Pattern 4: Attributes

**Before:**
```tsx
<Input placeholder={language === "ko" ? "검색..." : "Search..."} />
```

**After:**
```tsx
<Input placeholder={pick("검색...", "Search...")} />
```

## BilingualLabel Component

For simple key-value pairs, use `<BilingualLabel>`:

```tsx
import { BilingualLabel } from "@/components/shared/BilingualLabel";

<BilingualLabel ko="안녕하세요" en="Hello" />
<BilingualLabel ko="제목" en="Title" as="h2" className="text-xl" />
<BilingualLabel ko="{count}개" en="{count} items" params={{ count: 5 }} />
<BilingualLabel ko="설명" en="Description" showBoth /> // 설명 (Description)
```

## Troubleshooting

### "Module type not specified" warning

Add to `package.json`:
```json
{
  "type": "module"
}
```

Or ignore - it's just a performance warning.

### Translation API errors

- Check API key is valid
- Verify rate limits haven't been exceeded
- Use `--dry-run` to test without API calls

### Auto-refactor missed some patterns

Use `--file` flag to refactor specific files:
```bash
npx ts-node scripts/i18n/auto-refactor.ts scan-report.json --file path/to/component.tsx
```

Then manually fix edge cases.

### Backup files cluttering directory

After verifying refactored code works:
```bash
find . -name "*.i18n-backup" -delete
```

## File Structure

```
scripts/i18n/
├── README.md                          # This file
├── scan-hardcoded-strings.ts         # Scanner
├── generate-translation-keys.ts      # Key generator
├── batch-translate.ts                # AI translator
├── auto-refactor.ts                  # Auto refactoring ⭐
├── coverage-report.ts                # Coverage analyzer
└── output/                           # Generated files
    ├── translations-generated.ts
    ├── translations-generated.json
    ├── translations-generated-translated.json
    ├── coverage-report.json
    └── refactor-results.json
```

## Best Practices

1. **Always use --dry-run first** when using auto-refactor
2. **Commit before refactoring** so you can easily revert
3. **Review AI translations** before adding to production
4. **Test thoroughly** after refactoring
5. **Target 80%+ coverage** for good i18n support
6. **Keep backups** until testing is complete

## Statistics

Current coverage (as of last scan):
- Total files: 95
- Files with hardcoded strings: 51
- Total hardcoded strings: 1,202
- Current coverage: ~3%
- Target coverage: 80%

## Support

For issues or questions:
1. Check this README
2. Review scan reports and logs
3. Test with `--dry-run` flag
4. Check backup files if something breaks
