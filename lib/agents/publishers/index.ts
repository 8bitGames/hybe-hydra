/**
 * Publisher Agents Export
 * =======================
 * Agents for content publishing and copywriting
 *
 * All Publisher agents use GPT-5.1 for superior natural language copywriting
 * and user-facing content quality
 */

// Publish Optimizer - Platform-specific publishing optimization
export {
  PublishOptimizerAgent,
  createPublishOptimizerAgent,
  PublishOptimizerConfig,
  PublishOptimizerInputSchema,
  PublishOptimizerOutputSchema,
  type PublishOptimizerInput,
  type PublishOptimizerOutput,
} from './publish-optimizer';

// Copywriter - SEO-optimized caption writing
export {
  CopywriterAgent,
  createCopywriterAgent,
  CopywriterConfig,
  CopywriterInputSchema,
  CopywriterOutputSchema,
  type CopywriterInput,
  type CopywriterOutput,
} from './copywriter';

// GEO/AEO Optimizer - AI search engine optimized content
export {
  GeoAeoOptimizerAgent,
  createGeoAeoOptimizerAgent,
  GeoAeoOptimizerConfig,
  GeoAeoInputSchema,
  GeoAeoOutputSchema,
  GeoOptimizedContentSchema,
  AeoOptimizedContentSchema,
  OptimizedHashtagsSchema,
  type GeoAeoInput,
  type GeoAeoOutput,
} from './geo-aeo-optimizer';
