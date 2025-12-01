import re

# Read the file
with open('app/(dashboard)/bridge/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The code to insert after handleNavigateToGenerate
new_code = '''
  // Navigate to compose page with saved prompt data
  const handleNavigateToCompose = useCallback(() => {
    if (!selectedCampaignId || !transformedPrompt) return;

    // Save prompt data to session storage
    saveBridgePrompt({
      campaignId: selectedCampaignId,
      originalPrompt: userInput,
      transformedPrompt: transformedPrompt,
      selectedTrends: selectedTrends,
      timestamp: Date.now(),
    });

    toast.success(t.bridge.promptTransferred, "Compose 페이지로 이동합니다");

    // Navigate to compose page
    router.push(`/campaigns/${selectedCampaignId}/compose`);
  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);

'''

# Find the pattern and insert after
pattern = r'(router\.push\(`/campaigns/\$\{selectedCampaignId\}/generate`\);\s*\}, \[selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t\]\);)'

if 'handleNavigateToCompose' not in content:
    content = re.sub(pattern, r'\1' + new_code, content)

    # Write the file
    with open('app/(dashboard)/bridge/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully added handleNavigateToCompose")
else:
    print("handleNavigateToCompose already exists")
