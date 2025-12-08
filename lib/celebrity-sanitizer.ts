/**
 * Celebrity Name Sanitizer
 *
 * Detects and replaces celebrity/artist names in prompts to comply with
 * Google Veo's Responsible AI policy that prohibits generating videos
 * with real people's names or likenesses.
 */

export interface CelebritySanitizeResult {
  sanitizedText: string;
  detectedNames: string[];
  replacements: Array<{
    original: string;
    replacement: string;
  }>;
  hasCelebrityNames: boolean;
}

export interface ArtistInfo {
  name: string;
  stageName?: string;
  groupName?: string;
}

// Generic replacement templates based on context
const REPLACEMENT_TEMPLATES = {
  male_solo: "a male artist",
  female_solo: "a female artist",
  male_group_member: "a male group member",
  female_group_member: "a female group member",
  group: "the music group",
  couple: "the couple",
  person: "the performer",
  artist: "the artist",
};

// Known artists and groups for detection
// This list includes country music artists and can be expanded as needed
const KNOWN_CELEBRITIES: Array<{
  names: string[];
  type: "male_solo" | "female_solo" | "male_group" | "female_group" | "mixed_group";
  description: string;
}> = [
  // Korean Artists
  { names: ["RM", "Kim Namjoon", "Namjoon", "남준"], type: "male_solo", description: "a male artist" },
  { names: ["Jin", "Kim Seokjin", "Seokjin", "석진"], type: "male_solo", description: "a male artist" },
  { names: ["Suga", "Min Yoongi", "Yoongi", "윤기", "Agust D"], type: "male_solo", description: "a male artist" },
  { names: ["J-Hope", "Jung Hoseok", "Hoseok", "호석"], type: "male_solo", description: "a male artist" },
  { names: ["Jimin", "Park Jimin", "박지민"], type: "male_solo", description: "a male artist" },
  { names: ["V", "Kim Taehyung", "Taehyung", "태형"], type: "male_solo", description: "a male artist" },
  { names: ["Jungkook", "Jeon Jungkook", "정국"], type: "male_solo", description: "a male artist" },
  { names: ["BTS", "방탄소년단", "Bangtan"], type: "male_group", description: "a male group" },

  // Other Korean Artists
  { names: ["SEVENTEEN", "세븐틴", "SVT"], type: "male_group", description: "a male group" },
  { names: ["TXT", "TOMORROW X TOGETHER", "투모로우바이투게더"], type: "male_group", description: "a male group" },
  { names: ["ENHYPEN", "엔하이픈"], type: "male_group", description: "a male group" },
  { names: ["LE SSERAFIM", "르세라핌"], type: "female_group", description: "a female group" },
  { names: ["NewJeans", "뉴진스"], type: "female_group", description: "a female group" },
  { names: ["ILLIT", "아일릿"], type: "female_group", description: "a female group" },
  { names: ["fromis_9", "프로미스나인"], type: "female_group", description: "a female group" },

  // Country Artists (based on the user's campaigns)
  { names: ["Thomas Rhett"], type: "male_solo", description: "a male country artist" },
  { names: ["Lauren Akins"], type: "female_solo", description: "a female personality" },
  { names: ["Carly Pearce"], type: "female_solo", description: "a female country artist" },
  { names: ["Morgan Wallen"], type: "male_solo", description: "a male country artist" },
  { names: ["Luke Combs"], type: "male_solo", description: "a male country artist" },
  { names: ["Chris Stapleton"], type: "male_solo", description: "a male country artist" },
  { names: ["Zach Bryan"], type: "male_solo", description: "a male country artist" },
  { names: ["Kane Brown"], type: "male_solo", description: "a male country artist" },
  { names: ["Luke Bryan"], type: "male_solo", description: "a male country artist" },
  { names: ["Carrie Underwood"], type: "female_solo", description: "a female country artist" },
  { names: ["Miranda Lambert"], type: "female_solo", description: "a female country artist" },
  { names: ["Kelsea Ballerini"], type: "female_solo", description: "a female country artist" },
  { names: ["Maren Morris"], type: "female_solo", description: "a female country artist" },

  // Global Pop Artists
  { names: ["Taylor Swift"], type: "female_solo", description: "a female pop artist" },
  { names: ["Beyoncé", "Beyonce"], type: "female_solo", description: "a female pop artist" },
  { names: ["Drake"], type: "male_solo", description: "a male hip-hop artist" },
  { names: ["The Weeknd"], type: "male_solo", description: "a male R&B artist" },
  { names: ["Ariana Grande"], type: "female_solo", description: "a female pop artist" },
  { names: ["Ed Sheeran"], type: "male_solo", description: "a male pop artist" },
  { names: ["Justin Bieber"], type: "male_solo", description: "a male pop artist" },
  { names: ["Billie Eilish"], type: "female_solo", description: "a female pop artist" },
  { names: ["Dua Lipa"], type: "female_solo", description: "a female pop artist" },
  { names: ["Post Malone"], type: "male_solo", description: "a male pop artist" },
];

/**
 * Detect celebrity names in text
 */
export function detectCelebrityNames(text: string): string[] {
  const detected: string[] = [];
  const lowerText = text.toLowerCase();

  for (const celebrity of KNOWN_CELEBRITIES) {
    for (const name of celebrity.names) {
      // Check for whole word match (case insensitive)
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
      if (regex.test(text)) {
        if (!detected.includes(name)) {
          detected.push(name);
        }
      }
    }
  }

  return detected;
}

/**
 * Get replacement description for a celebrity name
 */
function getReplacementForName(name: string): string {
  for (const celebrity of KNOWN_CELEBRITIES) {
    if (celebrity.names.some(n => n.toLowerCase() === name.toLowerCase())) {
      return celebrity.description;
    }
  }
  return "the performer";
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitize text by replacing celebrity names with generic descriptions
 */
export function sanitizeCelebrityNames(text: string): CelebritySanitizeResult {
  const detectedNames = detectCelebrityNames(text);
  let sanitizedText = text;
  const replacements: Array<{ original: string; replacement: string }> = [];

  if (detectedNames.length === 0) {
    return {
      sanitizedText: text,
      detectedNames: [],
      replacements: [],
      hasCelebrityNames: false,
    };
  }

  // Sort by length (longest first) to avoid partial replacements
  const sortedNames = [...detectedNames].sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    const replacement = getReplacementForName(name);
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");

    if (regex.test(sanitizedText)) {
      sanitizedText = sanitizedText.replace(regex, replacement);
      replacements.push({ original: name, replacement });
    }
  }

  return {
    sanitizedText,
    detectedNames,
    replacements,
    hasCelebrityNames: true,
  };
}

/**
 * Sanitize celebrity names with custom artist info
 * Uses the artist profile to create more contextual replacements
 */
export function sanitizeWithArtistContext(
  text: string,
  artistInfo?: ArtistInfo
): CelebritySanitizeResult {
  const result = sanitizeCelebrityNames(text);

  // If artist info is provided and matches detected names,
  // use more specific descriptions
  if (artistInfo && result.hasCelebrityNames) {
    // Create contextual replacement based on artist info
    const artistNames = [
      artistInfo.name,
      artistInfo.stageName,
      artistInfo.groupName,
    ].filter(Boolean) as string[];

    // Check if detected names match the campaign artist
    const matchesArtist = result.detectedNames.some(detected =>
      artistNames.some(artistName =>
        detected.toLowerCase() === artistName?.toLowerCase()
      )
    );

    if (matchesArtist) {
      // Artist name is expected - use more specific replacement
      // based on the context without revealing identity
      result.sanitizedText = result.sanitizedText.replace(
        /the performer|a male artist|a female artist|a male country artist|a female country artist/gi,
        "the featured artist"
      );
    }
  }

  return result;
}

/**
 * Create a warning message for detected celebrity names
 */
export function createCelebrityWarning(detectedNames: string[]): string {
  if (detectedNames.length === 0) return "";

  const nameList = detectedNames.join(", ");
  return `⚠️ Celebrity names detected: ${nameList}. These will be automatically replaced with generic descriptions to comply with Google Veo's content policy. Real people's names and likenesses cannot be generated.`;
}

/**
 * Add a celebrity to the detection list (runtime only)
 * This allows dynamic addition based on campaign artists
 */
export function addCelebrityForDetection(
  names: string[],
  type: "male_solo" | "female_solo" | "male_group" | "female_group" | "mixed_group",
  description: string
): void {
  // Check if already exists
  const exists = KNOWN_CELEBRITIES.some(c =>
    c.names.some(n => names.includes(n))
  );

  if (!exists) {
    KNOWN_CELEBRITIES.push({ names, type, description });
  }
}
