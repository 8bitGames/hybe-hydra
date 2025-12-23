import { PrismaClient, UserRole, TrendPlatform, MerchandiseType } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seed...");

  // Create labels (Country Music Labels)
  const labels = await Promise.all([
    prisma.label.upsert({
      where: { code: "BIGMACHINE" },
      update: {},
      create: {
        name: "Big Machine Records",
        code: "BIGMACHINE",
      },
    }),
    prisma.label.upsert({
      where: { code: "VALORY" },
      update: {},
      create: {
        name: "Valory Music Co.",
        code: "VALORY",
      },
    }),
    prisma.label.upsert({
      where: { code: "REPUBLIC" },
      update: {},
      create: {
        name: "Republic Nashville",
        code: "REPUBLIC",
      },
    }),
    prisma.label.upsert({
      where: { code: "BIGLOUD" },
      update: {},
      create: {
        name: "Big Loud Records",
        code: "BIGLOUD",
      },
    }),
    prisma.label.upsert({
      where: { code: "CACTUSJACK" },
      update: {},
      create: {
        name: "Cactus Jack Records",
        code: "CACTUSJACK",
      },
    }),
  ]);

  console.log(`✅ Created ${labels.length} labels`);

  // Create artists (Country Music Artists)
  const artists = await Promise.all([
    prisma.artist.upsert({
      where: { id: "centellian24" },
      update: {},
      create: {
        id: "centellian24",
        name: "Centellian24",
        stageName: "Centellian24",
        labelId: labels[0].id, // Big Machine Records
        profileDescription: "Premium skincare brand featuring advanced Centella Asiatica formula. Known for K-beauty innovation and clinical-grade products.",
        brandGuidelines: "Clean beauty aesthetic. Professional, clinical imagery. Brand tone: Premium, Trustworthy, Innovative.",
        profileImageUrl: "https://centellian24.com/images/logo.jpg",
      },
    }),
    prisma.artist.upsert({
      where: { id: "carly-pearce" },
      update: {},
      create: {
        id: "carly-pearce",
        name: "Carly Pearce",
        stageName: "Carly Pearce",
        labelId: labels[0].id, // Big Machine Records
        profileDescription: "Award-winning country music artist known for emotional ballads and authentic storytelling. CMA Female Vocalist of the Year.",
        brandGuidelines: "Country music authenticity. No excessive filters. No voice alteration. Brand tone: Elegant, Emotional, Empowering.",
        profileImageUrl: "https://www.carlypearce.com/images/carly-profile.jpg",
      },
    }),
    prisma.artist.upsert({
      where: { id: "thomas-rhett" },
      update: {},
      create: {
        id: "thomas-rhett",
        name: "Thomas Rhett",
        stageName: "Thomas Rhett",
        labelId: labels[1].id, // Valory Music Co.
        profileDescription: "Multi-platinum country artist blending traditional country with pop and R&B influences. Known for family-focused content.",
        brandGuidelines: "Family-friendly content. Modern country aesthetic. Brand tone: Warm, Relatable, Fun.",
        profileImageUrl: "https://www.thomasrhett.com/images/tr-profile.jpg",
      },
    }),
    prisma.artist.upsert({
      where: { id: "the-band-perry" },
      update: {},
      create: {
        id: "the-band-perry",
        name: "The Band Perry",
        stageName: "The Band Perry",
        groupName: "The Band Perry",
        labelId: labels[2].id, // Republic Nashville
        profileDescription: "Grammy-winning sibling trio known for genre-blending sound and powerful harmonies. Kimberly, Reid, and Neil Perry.",
        brandGuidelines: "Sibling harmony showcase. Genre-fluid aesthetic. Brand tone: Bold, Harmonious, Adventurous.",
        profileImageUrl: "https://www.thebandperry.co/images/tbp-profile.jpg",
      },
    }),
    prisma.artist.upsert({
      where: { id: "morgan-wallen" },
      update: {},
      create: {
        id: "morgan-wallen",
        name: "Morgan Cole Wallen",
        stageName: "Morgan Wallen",
        labelId: labels[3].id, // Big Loud Records
        profileDescription: "Multi-platinum country music superstar. 2024 CMA Entertainer of the Year. Known for hits like 'Last Night', 'Whiskey Glasses', and albums 'Dangerous' and 'One Thing at a Time'. Blends traditional country with modern production.",
        brandGuidelines: "Authentic country vibes. Raw and emotional storytelling. No over-polished content. Brand tone: Rugged, Authentic, Party-ready.",
        profileImageUrl: "https://bigloud.com/artists/morgan-wallen/profile.jpg",
      },
    }),
    prisma.artist.upsert({
      where: { id: "travis-scott" },
      update: {},
      create: {
        id: "travis-scott",
        name: "Jacques Berman Webster II",
        stageName: "Travis Scott",
        labelId: labels[4].id, // Cactus Jack Records
        profileDescription: "Grammy-nominated rapper, singer, and record producer. Founder of Cactus Jack Records. Known for hits like 'SICKO MODE', 'goosebumps', and albums 'Astroworld' and 'Utopia'. Pioneer in combining music, fashion, and visual art.",
        brandGuidelines: "Psychedelic visuals. Dark, atmospheric aesthetics. High-energy concert vibes. Brand tone: Bold, Futuristic, Experimental.",
        profileImageUrl: "https://cactusjack.com/artists/travis-scott/profile.jpg",
      },
    }),
  ]);

  console.log(`✅ Created ${artists.length} artists`);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const allLabelIds = labels.map((l) => l.id);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hydra.com" },
    update: {
      labelIds: allLabelIds, // Update labelIds to include new labels
    },
    create: {
      email: "admin@hydra.com",
      name: "HYDRA Admin",
      hashedPassword,
      role: UserRole.ADMIN,
      labelIds: labels.map((l) => l.id),
      isActive: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create producer user
  const producerPassword = await bcrypt.hash("producer123", 10);
  const producerUser = await prisma.user.upsert({
    where: { email: "producer@hydra.com" },
    update: {},
    create: {
      email: "producer@hydra.com",
      name: "Content Producer",
      hashedPassword: producerPassword,
      role: UserRole.PRODUCER,
      labelIds: [labels[0].id, labels[1].id], // Big Machine and Valory
      isActive: true,
    },
  });

  console.log(`✅ Created producer user: ${producerUser.email}`);

  // Create sample campaigns (Country Music)
  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { id: "campaign-carly-hummingbird-tour" },
      update: {},
      create: {
        id: "campaign-carly-hummingbird-tour",
        name: "Hummingbird World Tour Diaries",
        description: "Behind-the-scenes tour content featuring rehearsals, backstage moments, and emotional storytelling. Brand tone: Elegant, Emotional, Empowering.",
        artistId: artists[0].id, // Carly Pearce
        status: "ACTIVE",
        targetCountries: ["US", "CA", "GB", "AU", "DE"],
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-06-30"),
        createdBy: adminUser.id,
      },
    }),
    prisma.campaign.upsert({
      where: { id: "campaign-thomas-rhett-about-a-woman" },
      update: {},
      create: {
        id: "campaign-thomas-rhett-about-a-woman",
        name: "About A Woman Album Promo",
        description: "Family-focused content promoting the new album with behind-the-scenes studio sessions and music video teasers.",
        artistId: artists[1].id, // Thomas Rhett
        status: "ACTIVE",
        targetCountries: ["US", "CA", "AU"],
        startDate: new Date("2025-02-01"),
        endDate: new Date("2025-05-31"),
        createdBy: adminUser.id,
      },
    }),
    prisma.campaign.upsert({
      where: { id: "campaign-band-perry-reunion" },
      update: {},
      create: {
        id: "campaign-band-perry-reunion",
        name: "The Band Perry Reunion Tour",
        description: "Sibling harmony showcase celebrating the reunion with nostalgic content and new music teasers.",
        artistId: artists[2].id, // The Band Perry
        status: "DRAFT",
        targetCountries: ["US", "CA", "GB"],
        createdBy: producerUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${campaigns.length} sample campaigns`);

  // Create style presets for parallel generation
  const stylePresets = await Promise.all([
    // Contrast category
    prisma.stylePreset.upsert({
      where: { id: "preset-high-contrast" },
      update: {},
      create: {
        id: "preset-high-contrast",
        name: "High Contrast",
        nameKo: "강렬함",
        category: "contrast",
        description: "Bold, dramatic visuals with strong light/dark contrast",
        parameters: {
          contrast: 1.4,
          saturation: 1.2,
          colorGrading: "dramatic",
          shadows: -20,
          highlights: 20,
          promptModifier: "Shot with high contrast dramatic lighting, deep black shadows and bright highlights creating strong visual tension. Hard directional light from 45 degrees above, reminiscent of film noir cinematography. Rich blacks crushed to pure shadow, highlights pushed to near-white. Bold chiaroscuro effect with minimal midtones. Shot on Zeiss Master Prime lens with high contrast look.",
        },
        sortOrder: 1,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-soft-pastel" },
      update: {},
      create: {
        id: "preset-soft-pastel",
        name: "Soft Pastel",
        nameKo: "감성 파스텔",
        category: "mood",
        description: "Gentle, dreamy aesthetics with soft colors",
        parameters: {
          contrast: 0.9,
          saturation: 0.85,
          colorGrading: "pastel",
          warmth: 10,
          softness: 30,
          promptModifier: "Soft diffused lighting through sheer curtains, creating gentle wraparound illumination. Color palette restricted to muted pastels - baby pink (#FFB6C1), powder blue (#B0E0E6), lavender (#E6E6FA), mint green (#98FF98). Low contrast with lifted shadows and compressed highlights. Subtle gaussian glow bloom effect around light sources. Film emulation Kodak Portra 400 with reduced saturation. Dreamy ethereal atmosphere with soft focus edges.",
        },
        sortOrder: 2,
      },
    }),
    // Motion category
    prisma.stylePreset.upsert({
      where: { id: "preset-dynamic-motion" },
      update: {},
      create: {
        id: "preset-dynamic-motion",
        name: "Dynamic Motion",
        nameKo: "역동적",
        category: "motion",
        description: "Energetic visuals with dynamic camera movement",
        parameters: {
          motionIntensity: 1.5,
          cameraMovement: "dynamic",
          transitionSpeed: "fast",
          fps: 60,
          promptModifier: "Dynamic handheld camera tracking shot with intentional motion energy. Fast dolly movements and whip pans creating kinetic visual rhythm. High shutter speed freezing peak action moments. Energetic camera shake adding raw authenticity. Shot on gimbal with aggressive acceleration curves. Quick push-ins emphasizing dramatic beats. Action cinematography style with impact frames.",
        },
        sortOrder: 3,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-smooth-flow" },
      update: {},
      create: {
        id: "preset-smooth-flow",
        name: "Smooth Flow",
        nameKo: "부드러운 흐름",
        category: "motion",
        description: "Graceful, fluid motion with gentle transitions",
        parameters: {
          motionIntensity: 0.7,
          cameraMovement: "smooth",
          transitionSpeed: "slow",
          fps: 30,
          promptModifier: "Ultra-smooth slow dolly movement on professional slider or crane. Fluid camera glide with no perceptible start or stop. Graceful arc movements with gentle easing curves. Shot on Steadicam or DJI Ronin with perfect stabilization. Slow motion 60fps rendered at 24fps for buttery smooth playback. Elegant floating camera perspective. Ballet-like camera choreography with seamless transitions.",
        },
        sortOrder: 4,
      },
    }),
    // Cinematic category
    prisma.stylePreset.upsert({
      where: { id: "preset-cinematic-film" },
      update: {},
      create: {
        id: "preset-cinematic-film",
        name: "Cinematic Film",
        nameKo: "시네마틱",
        category: "cinematic",
        description: "Hollywood movie-style visuals with film grain",
        parameters: {
          aspectRatio: "2.39:1",
          filmGrain: 0.3,
          colorGrading: "cinematic",
          letterbox: true,
          promptModifier: "Shot on Arri Alexa with Cooke Anamorphic 2x squeeze lenses creating oval bokeh and horizontal lens flares. Cinematic 2.39:1 widescreen aspect ratio with subtle letterboxing. Fine organic film grain overlay matching Kodak Vision3 500T stock. Color graded with teal shadows and warm orange skin tones. Shallow depth of field at T2.0. Professional cinema lighting with motivated practical sources. Hollywood blockbuster production value.",
        },
        sortOrder: 5,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-teal-orange" },
      update: {},
      create: {
        id: "preset-teal-orange",
        name: "Teal & Orange",
        nameKo: "틸 앤 오렌지",
        category: "cinematic",
        description: "Classic Hollywood color grading",
        parameters: {
          colorGrading: "teal-orange",
          tealStrength: 0.6,
          orangeStrength: 0.5,
          contrast: 1.1,
          promptModifier: "Classic Hollywood teal and orange complementary color grading. Shadows pushed toward cyan-teal (#008080), midtones and skin tones shifted to warm orange-amber (#FF8C00). Strong color separation between cool backgrounds and warm subjects. Michael Bay and David Fincher inspired color science. Crushed blacks with teal undertone, lifted highlights with orange warmth. High production value blockbuster aesthetic with punchy contrast.",
        },
        sortOrder: 6,
      },
    }),
    // Aesthetic category
    prisma.stylePreset.upsert({
      where: { id: "preset-neon-glow" },
      update: {},
      create: {
        id: "preset-neon-glow",
        name: "Neon Glow",
        nameKo: "네온 글로우",
        category: "aesthetic",
        description: "Vibrant neon lights with cyberpunk aesthetics",
        parameters: {
          colorGrading: "neon",
          saturation: 1.4,
          bloom: 0.5,
          neonColors: ["#ff00ff", "#00ffff", "#ff0080"],
          promptModifier: "Cyberpunk neon-lit environment with electric magenta (#FF00FF), cyan (#00FFFF), and hot pink (#FF0080) as dominant light sources. Heavy bloom and glow effects around all light sources. Reflective wet surfaces catching neon reflections. Dark shadows contrasted with intense saturated neon highlights. Blade Runner and Tokyo night aesthetic. Shot through rain-streaked glass with chromatic aberration. Futuristic noir atmosphere with volumetric light rays.",
        },
        sortOrder: 7,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-vintage-retro" },
      update: {},
      create: {
        id: "preset-vintage-retro",
        name: "Vintage Retro",
        nameKo: "빈티지 레트로",
        category: "aesthetic",
        description: "Nostalgic vintage look with warm tones",
        parameters: {
          colorGrading: "vintage",
          filmGrain: 0.5,
          vignette: 0.3,
          saturation: 0.9,
          warmth: 20,
          promptModifier: "Authentic vintage film photography aesthetic shot on expired Kodak Gold 200 or Fuji Superia. Warm amber color cast with faded blacks lifted to milky brown. Heavy natural film grain texture. Subtle light leaks and lens imperfections. Oval vignette darkening corners. Reduced saturation with nostalgic sepia undertones. 1970s-80s analog photography feel. Soft halation around highlights. Retro color science with characteristic orange-brown shadows.",
        },
        sortOrder: 8,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-y2k" },
      update: {},
      create: {
        id: "preset-y2k",
        name: "Y2K Aesthetic",
        nameKo: "Y2K 감성",
        category: "aesthetic",
        description: "2000s inspired visual style",
        parameters: {
          colorGrading: "y2k",
          saturation: 1.2,
          highlights: 30,
          chromaticAberration: 0.2,
          promptModifier: "Early 2000s Y2K aesthetic with glossy chrome reflections and metallic silver accents. Blown-out highlights creating angelic glow effect. Saturated candy colors - hot pink, electric blue, lime green. Low-res digital camera aesthetic with subtle compression artifacts. Flash photography look with harsh frontal lighting. Britney Spears and early 2000s music video aesthetic. Iridescent and holographic surface textures. Futuristic optimism of millennium era.",
        },
        sortOrder: 9,
      },
    }),
    // K-Pop specific
    prisma.stylePreset.upsert({
      where: { id: "preset-kpop-mv" },
      update: {},
      create: {
        id: "preset-kpop-mv",
        name: "K-Pop MV",
        nameKo: "K-Pop 뮤비",
        category: "kpop",
        description: "Classic K-Pop music video style",
        parameters: {
          colorGrading: "vibrant",
          saturation: 1.15,
          contrast: 1.1,
          sharpness: 1.2,
          promptModifier: "High-end K-Pop music video production quality with perfectly polished visuals. Professional three-point lighting setup with beauty dish key light for flawless skin. Vibrant saturated colors with punchy contrast. Shot on RED Komodo or Sony Venice at 6K resolution. Razor-sharp focus with detail enhancement. HYBE and SM Entertainment visual standards. Clean, modern aesthetic with precise color grading. Studio-quality lighting with motivated practical sources.",
        },
        sortOrder: 10,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-concept-photo" },
      update: {},
      create: {
        id: "preset-concept-photo",
        name: "Concept Photo",
        nameKo: "컨셉 포토",
        category: "kpop",
        description: "Album concept photo visual style",
        parameters: {
          colorGrading: "editorial",
          contrast: 1.05,
          sharpness: 1.3,
          clarity: 1.2,
          promptModifier: "High-fashion editorial photography style for album concept photos. Shot on Hasselblad medium format with 80mm lens at f/2.8. Professional studio lighting with large octabox as key and subtle fill. Magazine-quality retouching aesthetic with enhanced clarity and micro-contrast. Vogue Korea and W Magazine visual standards. Clean infinite backdrop or carefully art-directed set design. Fashion photography composition with intentional negative space. Premium print-ready quality.",
        },
        sortOrder: 11,
      },
    }),
    // Mood category
    prisma.stylePreset.upsert({
      where: { id: "preset-dark-moody" },
      update: {},
      create: {
        id: "preset-dark-moody",
        name: "Dark Moody",
        nameKo: "다크 무드",
        category: "mood",
        description: "Dark, atmospheric visuals",
        parameters: {
          brightness: -20,
          contrast: 1.3,
          colorGrading: "dark",
          shadows: -30,
          promptModifier: "Low-key dramatic lighting with single hard light source from extreme angle creating deep mysterious shadows. Overall exposure pulled down 1-2 stops. Rich blacks with subtle detail preserved in shadows. Minimal fill light allowing shadows to fall to near-black. Rembrandt or split lighting pattern on faces. Moody atmospheric haze or fog. Desaturated color palette with cool blue-gray undertones. Film noir and thriller cinematography aesthetic. Brooding tension in every frame.",
        },
        sortOrder: 12,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-bright-cheerful" },
      update: {},
      create: {
        id: "preset-bright-cheerful",
        name: "Bright & Cheerful",
        nameKo: "밝고 경쾌한",
        category: "mood",
        description: "Bright, uplifting visuals",
        parameters: {
          brightness: 15,
          saturation: 1.2,
          contrast: 0.95,
          warmth: 10,
          promptModifier: "Bright high-key lighting creating uplifting cheerful atmosphere. Overall exposure pushed up 0.5-1 stop for airy luminous feel. Large soft light sources from multiple directions minimizing shadows. Vibrant saturated colors with emphasis on warm yellows, sunny oranges, and fresh greens. Slightly reduced contrast for light, breezy aesthetic. Natural daylight simulation at golden hour warmth. Positive energy radiating from every element. Clean whites with subtle warm tint. Commercial advertising brightness and appeal.",
        },
        sortOrder: 13,
      },
    }),
    // Special effects
    prisma.stylePreset.upsert({
      where: { id: "preset-dreamy-blur" },
      update: {},
      create: {
        id: "preset-dreamy-blur",
        name: "Dreamy Blur",
        nameKo: "몽환적",
        category: "effect",
        description: "Soft focus with dreamy atmosphere",
        parameters: {
          blur: 0.2,
          bloom: 0.4,
          saturation: 0.95,
          softness: 40,
          promptModifier: "Dreamy soft focus effect achieved with vintage lens or Pro-Mist 1/4 filter. Ethereal glow bloom around highlights creating romantic atmosphere. Shot wide open at f/1.4 with subject slightly soft. Hazy atmospheric diffusion like morning mist. Gentle gaussian blur on edges while maintaining center sharpness. Halation effect around bright light sources. Slightly desaturated pastel tones. Fairy tale and music video romance aesthetic. Soft lens flares adding to dreamlike quality. Otherworldly ethereal feeling.",
        },
        sortOrder: 14,
      },
    }),
    prisma.stylePreset.upsert({
      where: { id: "preset-golden-hour" },
      update: {},
      create: {
        id: "preset-golden-hour",
        name: "Golden Hour",
        nameKo: "골든 아워",
        category: "lighting",
        description: "Warm golden sunset lighting",
        parameters: {
          colorGrading: "golden",
          warmth: 30,
          saturation: 1.1,
          highlights: 15,
          promptModifier: "Natural golden hour lighting approximately 1 hour before sunset. Warm amber-orange light at 3200K color temperature casting long soft shadows. Backlit subjects with rim light creating golden hair glow and skin luminosity. Lens flares from direct sun hitting camera. Rich warm color palette dominated by honey gold (#FFD700), amber (#FFBF00), and soft orange (#FFA500). Magic hour cinematography with romantic warmth. Sun positioned low on horizon creating dimensional lighting. Natural outdoor beauty lighting perfection.",
        },
        sortOrder: 15,
      },
    }),
  ]);

  console.log(`✅ Created ${stylePresets.length} style presets`);

  // Create merchandise items (Country Music Goods)
  const merchandiseItems = await Promise.all([
    // Carly Pearce Merchandise
    prisma.merchandiseItem.upsert({
      where: { id: "merch-carly-hummingbird-album" },
      update: {},
      create: {
        id: "merch-carly-hummingbird-album",
        name: "Hummingbird Album (Vinyl)",
        nameKo: "허밍버드 앨범 (바이닐)",
        artistId: artists[0].id,
        type: MerchandiseType.ALBUM,
        description: "Limited edition vinyl LP of Carly Pearce's Hummingbird album with exclusive artwork",
        s3Url: "https://placeholder.co/400x400/e8d5c4/333333?text=Hummingbird+Album",
        s3Key: "merchandise/carly-pearce/hummingbird-vinyl.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/e8d5c4/333333?text=Hummingbird",
        fileSize: 102400,
        releaseDate: new Date("2024-06-07"),
        metadata: { format: "vinyl", tracks: 13, color: "amber" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-carly-tour-tshirt" },
      update: {},
      create: {
        id: "merch-carly-tour-tshirt",
        name: "Hummingbird World Tour T-Shirt",
        nameKo: "허밍버드 월드 투어 티셔츠",
        artistId: artists[0].id,
        type: MerchandiseType.APPAREL,
        description: "Official tour merchandise featuring Hummingbird album artwork",
        s3Url: "https://placeholder.co/400x400/2d3436/ffffff?text=Tour+Shirt",
        s3Key: "merchandise/carly-pearce/tour-tshirt.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/2d3436/ffffff?text=Shirt",
        fileSize: 81920,
        releaseDate: new Date("2025-01-01"),
        metadata: { sizes: ["S", "M", "L", "XL"], material: "100% cotton" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-carly-photocard-set" },
      update: {},
      create: {
        id: "merch-carly-photocard-set",
        name: "Hummingbird Photocard Set",
        nameKo: "허밍버드 포토카드 세트",
        artistId: artists[0].id,
        type: MerchandiseType.PHOTOCARD,
        description: "Set of 8 exclusive photocards from Hummingbird album photoshoot",
        s3Url: "https://placeholder.co/400x400/f5e6d3/333333?text=Photocard+Set",
        s3Key: "merchandise/carly-pearce/photocard-set.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/f5e6d3/333333?text=Cards",
        fileSize: 51200,
        releaseDate: new Date("2024-06-07"),
        metadata: { count: 8, size: "55x85mm" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-carly-necklace" },
      update: {},
      create: {
        id: "merch-carly-necklace",
        name: "Hummingbird Pendant Necklace",
        nameKo: "허밍버드 펜던트 목걸이",
        artistId: artists[0].id,
        type: MerchandiseType.ACCESSORY,
        description: "Sterling silver hummingbird pendant necklace, official merchandise",
        s3Url: "https://placeholder.co/400x400/c0c0c0/333333?text=Necklace",
        s3Key: "merchandise/carly-pearce/necklace.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/c0c0c0/333333?text=Pendant",
        fileSize: 40960,
        releaseDate: new Date("2024-12-01"),
        metadata: { material: "sterling silver", chainLength: "18 inches" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    // Thomas Rhett Merchandise
    prisma.merchandiseItem.upsert({
      where: { id: "merch-thomas-album" },
      update: {},
      create: {
        id: "merch-thomas-album",
        name: "About A Woman Album (CD)",
        nameKo: "어바웃 어 우먼 앨범 (CD)",
        artistId: artists[1].id,
        type: MerchandiseType.ALBUM,
        description: "Thomas Rhett's newest album celebrating family and love",
        s3Url: "https://placeholder.co/400x400/4a69bd/ffffff?text=About+A+Woman",
        s3Key: "merchandise/thomas-rhett/about-a-woman-cd.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/4a69bd/ffffff?text=Album",
        fileSize: 92160,
        releaseDate: new Date("2025-02-01"),
        metadata: { format: "CD", tracks: 14 },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-thomas-hoodie" },
      update: {},
      create: {
        id: "merch-thomas-hoodie",
        name: "TR Family Hoodie",
        nameKo: "TR 패밀리 후디",
        artistId: artists[1].id,
        type: MerchandiseType.APPAREL,
        description: "Cozy hoodie with Thomas Rhett logo, perfect for family hangouts",
        s3Url: "https://placeholder.co/400x400/6c5ce7/ffffff?text=Family+Hoodie",
        s3Key: "merchandise/thomas-rhett/family-hoodie.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/6c5ce7/ffffff?text=Hoodie",
        fileSize: 87040,
        releaseDate: new Date("2024-11-15"),
        metadata: { sizes: ["S", "M", "L", "XL", "XXL"], material: "cotton blend" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-thomas-cap" },
      update: {},
      create: {
        id: "merch-thomas-cap",
        name: "TR Trucker Cap",
        nameKo: "TR 트러커 캡",
        artistId: artists[1].id,
        type: MerchandiseType.ACCESSORY,
        description: "Classic trucker cap with embroidered TR logo",
        s3Url: "https://placeholder.co/400x400/2d3436/ffffff?text=Trucker+Cap",
        s3Key: "merchandise/thomas-rhett/trucker-cap.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/2d3436/ffffff?text=Cap",
        fileSize: 35840,
        releaseDate: new Date("2024-10-01"),
        metadata: { style: "trucker", adjustable: true },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    // The Band Perry Merchandise
    prisma.merchandiseItem.upsert({
      where: { id: "merch-tbp-reunion-album" },
      update: {},
      create: {
        id: "merch-tbp-reunion-album",
        name: "Reunion Tour Live Album",
        nameKo: "리유니온 투어 라이브 앨범",
        artistId: artists[2].id,
        type: MerchandiseType.ALBUM,
        description: "Live recordings from The Band Perry's reunion tour",
        s3Url: "https://placeholder.co/400x400/e17055/ffffff?text=Reunion+Live",
        s3Key: "merchandise/the-band-perry/reunion-live.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/e17055/ffffff?text=Live",
        fileSize: 112640,
        releaseDate: new Date("2025-03-01"),
        metadata: { format: "digital+CD", tracks: 16, liveRecording: true },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-tbp-lightstick" },
      update: {},
      create: {
        id: "merch-tbp-lightstick",
        name: "Perry Glow Stick",
        nameKo: "페리 글로우 스틱",
        artistId: artists[2].id,
        type: MerchandiseType.LIGHTSTICK,
        description: "Official concert lightstick for The Band Perry shows",
        s3Url: "https://placeholder.co/400x400/fdcb6e/333333?text=Glow+Stick",
        s3Key: "merchandise/the-band-perry/lightstick.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/fdcb6e/333333?text=Light",
        fileSize: 61440,
        releaseDate: new Date("2025-01-15"),
        metadata: { colors: ["gold", "white", "purple"], batteryIncluded: true },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
    prisma.merchandiseItem.upsert({
      where: { id: "merch-tbp-sibling-poster" },
      update: {},
      create: {
        id: "merch-tbp-sibling-poster",
        name: "Sibling Harmony Poster",
        nameKo: "시블링 하모니 포스터",
        artistId: artists[2].id,
        type: MerchandiseType.OTHER,
        description: "Limited edition poster featuring Kimberly, Reid, and Neil Perry",
        s3Url: "https://placeholder.co/400x400/a29bfe/ffffff?text=Harmony+Poster",
        s3Key: "merchandise/the-band-perry/harmony-poster.jpg",
        thumbnailUrl: "https://placeholder.co/200x200/a29bfe/ffffff?text=Poster",
        fileSize: 71680,
        releaseDate: new Date("2024-12-15"),
        metadata: { size: "24x36 inches", paper: "matte finish" },
        isActive: true,
        createdBy: adminUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${merchandiseItems.length} merchandise items`);

  // Create trend snapshots - Country Music trending data from each platform
  const now = new Date();
  const trendSnapshots = await Promise.all([
    // TikTok Trends (Country Music)
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.TIKTOK,
          keyword: "Autumn Aesthetic",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.TIKTOK,
        keyword: "Autumn Aesthetic",
        rank: 1,
        region: "US",
        viewCount: BigInt(850000000),
        videoCount: 2500000,
        description: "Cozy fall vibes with country music soundtracks, targeting 30+ female demographic",
        hashtags: ["#autumnvibes", "#fallvibes", "#cozyseason", "#countrymusic"],
        metadata: { targetDemo: "30-45 female", engagement: "250% increase", season: "fall" },
        trendUrl: "https://www.tiktok.com/tag/autumnvibes",
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.TIKTOK,
          keyword: "Self-Love Journey",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.TIKTOK,
        keyword: "Self-Love Journey",
        rank: 2,
        region: "US",
        viewCount: BigInt(620000000),
        videoCount: 1800000,
        description: "Emotional healing content with country ballads and self-empowerment themes",
        hashtags: ["#selflove", "#healingjourney", "#empowerment", "#countryballads"],
        metadata: { mood: "emotional", theme: "empowerment" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.TIKTOK,
          keyword: "Glam Up Transition",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.TIKTOK,
        keyword: "Glam Up Transition",
        rank: 3,
        region: "US",
        viewCount: BigInt(480000000),
        videoCount: 1200000,
        description: "Outfit transformation from casual to stage-ready, synced to beat drops",
        hashtags: ["#glamup", "#transition", "#glow", "#fyp"],
        metadata: { challengeType: "transition", difficulty: "medium" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.TIKTOK,
          keyword: "Nashville Nights",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.TIKTOK,
        keyword: "Nashville Nights",
        rank: 4,
        region: "US",
        viewCount: BigInt(350000000),
        videoCount: 950000,
        description: "Nashville nightlife and honky-tonk culture content",
        hashtags: ["#nashville", "#nashvillenights", "#honkytonk", "#countrylife"],
        metadata: { location: "Nashville", category: "lifestyle" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.TIKTOK,
          keyword: "Tour Bus Diaries",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.TIKTOK,
        keyword: "Tour Bus Diaries",
        rank: 5,
        region: "US",
        viewCount: BigInt(290000000),
        videoCount: 780000,
        description: "Behind-the-scenes tour life content from country artists",
        hashtags: ["#tourlife", "#tourbus", "#behindthescenes", "#ontheroad"],
        metadata: { contentType: "bts", format: "vlog" },
        collectedAt: now,
      },
    }),
    // YouTube Trends (Country Music)
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.YOUTUBE,
          keyword: "Country Music Live Sessions",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.YOUTUBE,
        keyword: "Country Music Live Sessions",
        rank: 1,
        region: "US",
        viewCount: BigInt(45000000),
        videoCount: 85000,
        description: "Acoustic live performances and unplugged sessions",
        hashtags: ["#livesession", "#acoustic", "#unplugged", "#countrymusic"],
        metadata: { category: "Music", duration: "long-form", format: "live" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.YOUTUBE,
          keyword: "Music Video Behind The Scenes",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.YOUTUBE,
        keyword: "Music Video Behind The Scenes",
        rank: 2,
        region: "US",
        viewCount: BigInt(38000000),
        videoCount: 65000,
        description: "Making of music video content with artist commentary",
        hashtags: ["#behindthescenes", "#musicvideo", "#bts", "#making"],
        metadata: { category: "Entertainment", contentType: "BTS" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.YOUTUBE,
          keyword: "Songwriting Sessions",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.YOUTUBE,
        keyword: "Songwriting Sessions",
        rank: 3,
        region: "US",
        viewCount: BigInt(32000000),
        videoCount: 120000,
        description: "Artists sharing their songwriting process and story behind songs",
        hashtags: ["#songwriting", "#songwriter", "#behindthelyrics", "#musicprocess"],
        metadata: { category: "Music", format: "documentary" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.YOUTUBE,
          keyword: "Country Cover Songs",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.YOUTUBE,
        keyword: "Country Cover Songs",
        rank: 4,
        region: "US",
        viewCount: BigInt(28000000),
        videoCount: 45000,
        description: "Artists covering classic and contemporary country hits",
        hashtags: ["#coversong", "#countrycover", "#acoustic", "#tribute"],
        metadata: { category: "Music", subCategory: "Covers" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.YOUTUBE,
          keyword: "CMA Awards Highlights",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.YOUTUBE,
        keyword: "CMA Awards Highlights",
        rank: 5,
        region: "US",
        viewCount: BigInt(25000000),
        videoCount: 200000,
        description: "Best moments from Country Music Association awards",
        hashtags: ["#cma", "#cmaawards", "#countrymusic", "#awards"],
        metadata: { category: "Entertainment", format: "highlights" },
        collectedAt: now,
      },
    }),
    // Instagram Trends (Country Music)
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.INSTAGRAM,
          keyword: "Nashville Fashion",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.INSTAGRAM,
        keyword: "Nashville Fashion",
        rank: 1,
        region: "US",
        viewCount: BigInt(15000000),
        videoCount: 350000,
        description: "Western fashion, cowboy boots, and Nashville style inspiration",
        hashtags: ["#nashvillefashion", "#westernstyle", "#cowgirlboots", "#ootd"],
        metadata: { contentType: "fashion", format: "photo+reels" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.INSTAGRAM,
          keyword: "Album Artwork Aesthetic",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.INSTAGRAM,
        keyword: "Album Artwork Aesthetic",
        rank: 2,
        region: "US",
        viewCount: BigInt(12000000),
        videoCount: 280000,
        description: "Country album cover inspired photography and edits",
        hashtags: ["#albumart", "#countryaesthetic", "#vintagestyle", "#photoshoot"],
        metadata: { contentType: "photography", style: "editorial" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.INSTAGRAM,
          keyword: "Rustic Cozy Vibes",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.INSTAGRAM,
        keyword: "Rustic Cozy Vibes",
        rank: 3,
        region: "US",
        viewCount: BigInt(9500000),
        videoCount: 180000,
        description: "Cozy cabin, fall leaves, warm blankets aesthetic",
        hashtags: ["#rustic", "#cozy", "#cabinvibes", "#fallmood"],
        metadata: { contentType: "lifestyle", aesthetic: "rustic" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.INSTAGRAM,
          keyword: "Meet and Greet Moments",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.INSTAGRAM,
        keyword: "Meet and Greet Moments",
        rank: 4,
        region: "US",
        viewCount: BigInt(8000000),
        videoCount: 95000,
        description: "Sweet fan interactions at concerts and events",
        hashtags: ["#meetandgreet", "#concertlife", "#fanmoments", "#countryfan"],
        metadata: { contentType: "event", eventType: "meetandgreet" },
        collectedAt: now,
      },
    }),
    prisma.trendSnapshot.upsert({
      where: {
        platform_keyword_region_collectedAt: {
          platform: TrendPlatform.INSTAGRAM,
          keyword: "Golden Hour Country",
          region: "US",
          collectedAt: now,
        },
      },
      update: {},
      create: {
        platform: TrendPlatform.INSTAGRAM,
        keyword: "Golden Hour Country",
        rank: 5,
        region: "US",
        viewCount: BigInt(7000000),
        videoCount: 420000,
        description: "Sunset photography with country music vibes",
        hashtags: ["#goldenhour", "#sunsetvibes", "#countryroad", "#magichour"],
        metadata: { contentType: "photo", category: "landscape" },
        collectedAt: now,
      },
    }),
  ]);

  console.log(`✅ Created ${trendSnapshots.length} trend snapshots`);

  console.log("\n🎉 Database seeding completed!");
  console.log("\n📋 Test Accounts:");
  console.log("  Admin: admin@hydra.com / admin123");
  console.log("  Producer: producer@hydra.com / producer123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
