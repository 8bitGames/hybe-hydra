import re

# Read the file
with open('app/(dashboard)/bridge/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The malformed code pattern
malformed = """  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);
// Navigate to compose page with saved prompt data  const handleNavigateToCompose = useCallback(() => {    if (!selectedCampaignId || !transformedPrompt) return;    // Save prompt data to session storage    saveBridgePrompt({      campaignId: selectedCampaignId,      originalPrompt: userInput,      transformedPrompt: transformedPrompt,      selectedTrends: selectedTrends,      timestamp: Date.now(),    });    toast.success(t.bridge.promptTransferred, "Compose 페이지로 이동합니다");    // Navigate to compose page    router.push();  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);

  return ("""

# The correct code
correct = """  }, [selectedCampaignId, transformedPrompt, userInput, selectedTrends, router, toast, t]);

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

  return ("""

if malformed in content:
    content = content.replace(malformed, correct)
    with open('app/(dashboard)/bridge/page.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully fixed handleNavigateToCompose formatting")
else:
    print("Pattern not found - may already be fixed or different format")
