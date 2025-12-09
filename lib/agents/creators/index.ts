/**
 * Creator Agents Export
 * ======================
 * Agents for creative content generation
 *
 * - Creative Director: Gemini 3 Pro (strategic thinking)
 * - Script Writer: Gemini 2.5 Flash (structured output)
 */

// Creative Director - Strategic content ideation
export {
  CreativeDirectorAgent,
  createCreativeDirectorAgent,
  CreativeDirectorConfig,
  CreativeDirectorInputSchema,
  CreativeDirectorOutputSchema,
  type CreativeDirectorInput,
  type CreativeDirectorOutput,
} from './creative-director';

// Script Writer - Video script generation
export {
  ScriptWriterAgent,
  createScriptWriterAgent,
  ScriptWriterConfig,
  ScriptWriterInputSchema,
  ScriptWriterOutputSchema,
  type ScriptWriterInput,
  type ScriptWriterOutput,
} from './script-writer';

// Fast Cut Idea - Slideshow content ideation
export {
  FastCutIdeaAgent,
  createFastCutIdeaAgent,
  FastCutIdeaConfig,
  FastCutIdeaInputSchema,
  FastCutIdeaOutputSchema,
  type FastCutIdeaInput,
  type FastCutIdeaOutput,
} from './fast-cut-idea-agent';
