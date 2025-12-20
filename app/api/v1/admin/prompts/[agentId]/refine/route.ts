/**
 * Prompt Refinement Chat API
 * ==========================
 * Multi-turn conversation for interactive prompt improvement
 *
 * POST /api/v1/admin/prompts/[agentId]/refine
 * - Chat with LLM to analyze and improve prompts
 * - Test prompts with sample inputs
 * - Get improvement suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_FLASH } from '@/lib/agents/constants';

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RefineRequest {
  action: 'chat' | 'analyze' | 'improve' | 'test';
  message?: string;
  history?: ChatMessage[];
  currentPrompt: {
    systemPrompt: string;
    templates: Record<string, string>;
    name: string;
    description?: string;
  };
  testInput?: Record<string, unknown>;
}

const REFINER_SYSTEM_PROMPT = `You are an expert AI Prompt Engineer specializing in optimizing system prompts for AI agents.

Your role is to help users iteratively improve their prompts through conversation.

## Your Capabilities:
1. **Analyze** - Identify issues, ambiguities, and improvement opportunities in prompts
2. **Suggest** - Provide specific, actionable improvements
3. **Rewrite** - Generate improved versions of prompts
4. **Test** - Help validate prompts with sample inputs
5. **Explain** - Clarify why certain changes would be beneficial

## Guidelines:
- Be conversational and helpful
- Provide specific, actionable feedback
- When suggesting changes, explain the reasoning
- Use markdown formatting for clarity
- When showing code or prompt changes, use code blocks
- Focus on: clarity, specificity, consistency, edge cases, output format

## 🚨 CRITICAL: JSON Field Name Preservation Rule 🚨
When improving prompts that output JSON, you MUST:
- **NEVER change existing JSON field names** (e.g., do NOT rename "visual_style" to "visual_aesthetic")
- **NEVER rename keys in the JSON schema** (they are bound to code validation like Zod schemas)
- **Only improve field descriptions/instructions**, NOT the field names themselves
- **Preserve the exact JSON structure** including all nested key names
- If you see issues with field naming, suggest it as a comment but DO NOT change the actual field name
- Changing field names will break code validation and cause runtime errors

Example of WRONG approach:
\`\`\`
"visual_style": "..." -> "visual_aesthetic": "..."  ❌ FORBIDDEN
\`\`\`

Example of CORRECT approach:
\`\`\`
"visual_style": "describe briefly" -> "visual_style": "Describe the overall visual aesthetic in detail with 2-3 sentences..."  ✅ ALLOWED
\`\`\`

## 📋 Prompt Structure Rule: system_prompt vs templates
Agent prompts have TWO separate parts that must remain distinct:

1. **system_prompt** (Role Definition):
   - Short description of the agent's role and personality (3-5 lines)
   - General instructions about response format (e.g., "Always respond in JSON")
   - Should NOT contain specific task templates or JSON schemas

2. **templates** (Task-Specific Templates):
   - Contains detailed task instructions with placeholders like {{description}}, {{hashtags}}
   - Contains the full JSON output schema with field descriptions
   - Each template is for a specific task (e.g., "analyzeVideo", "analyzeImage")

When improving prompts:
- Keep system_prompt SHORT and role-focused
- Put detailed JSON schemas and task instructions in the appropriate template
- Do NOT merge templates into system_prompt
- When showing improvements, clearly label which part (system_prompt or template) you're modifying

## Response Format:
- For general chat: Respond naturally in markdown
- For analysis: Use structured sections (Strengths, Issues, Suggestions)
- For improvements: Show before/after with explanations
- For rewrites: Provide the full improved prompt in a code block

Always respond in the same language as the user's message.`;

const ANALYSIS_PROMPT = `Analyze the following prompt and provide detailed feedback:

## Agent Name: {{name}}
## Description: {{description}}

## System Prompt:
\`\`\`
{{systemPrompt}}
\`\`\`

## Templates:
{{templates}}

Please analyze this prompt and provide:
1. **Strengths** - What works well
2. **Issues** - Problems, ambiguities, or gaps
3. **Suggestions** - Specific improvements with examples
4. **Priority** - Which improvements would have the most impact

⚠️ **Important Note**: If the prompt contains JSON output schema, the field names are bound to code validation (Zod schemas). When suggesting improvements, ONLY suggest changes to field descriptions/instructions, NOT to field names themselves.

Be specific and actionable in your feedback.`;

const IMPROVE_PROMPT = `Based on our conversation, generate an improved version of this prompt:

## Current Prompt:
\`\`\`
{{systemPrompt}}
\`\`\`

## Templates:
{{templates}}

## Improvement Focus:
{{focus}}

## ⚠️ CRITICAL CONSTRAINTS:

### 1. JSON Field Name Preservation
If the prompt contains JSON output schema, you MUST preserve ALL existing JSON field names exactly as they are.
- Do NOT rename any JSON keys (they are bound to Zod validation schemas in code)
- Only improve the descriptions/instructions within each field's value
- Example: Keep "visual_style" as "visual_style", only improve its description text

### 2. system_prompt vs templates Separation
- **system_prompt**: Keep it SHORT (3-5 lines). Only role description and general instructions.
- **templates**: Put all detailed task instructions, JSON schemas, and placeholders here.
- Do NOT merge template content into system_prompt.

Please provide:
1. The improved **system_prompt** (in a code block marked "System Prompt") - SHORT, role-focused only
2. Improved **templates** (in code blocks marked with template name like "Template: analyzeVideo") - with full JSON schemas
3. A summary of what changed and why

Note: Field name changes are forbidden. Structure separation must be maintained.`;

const TEST_PROMPT = `Test the following prompt with the provided input and show what the expected output behavior would be:

## System Prompt:
\`\`\`
{{systemPrompt}}
\`\`\`

## Test Input:
\`\`\`json
{{testInput}}
\`\`\`

Analyze:
1. How the prompt would process this input
2. Potential issues or edge cases
3. Expected output format and quality
4. Suggestions for handling this input better`;

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { agentId } = await params;
    const body: RefineRequest = await request.json();
    const { action, message, history = [], currentPrompt, testInput } = body;

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build conversation history for multi-turn
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add context about the current prompt at the start
    const contextMessage = `I'm working on improving the prompt for the "${currentPrompt.name}" agent.

Current System Prompt:
\`\`\`
${currentPrompt.systemPrompt}
\`\`\`

${Object.keys(currentPrompt.templates).length > 0 ? `
Templates:
${Object.entries(currentPrompt.templates)
  .map(([key, value]) => `### ${key}:\n\`\`\`\n${value}\n\`\`\``)
  .join('\n\n')}
` : ''}`;

    // Add history
    if (history.length === 0) {
      // First message - add context
      contents.push({
        role: 'user',
        parts: [{ text: contextMessage }],
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I\'m ready to help you improve this prompt. What would you like to do? I can:\n\n1. **Analyze** the current prompt for issues and improvements\n2. **Suggest** specific changes\n3. **Rewrite** sections or the entire prompt\n4. **Test** the prompt with sample inputs\n\nHow would you like to proceed?' }],
      });
    } else {
      // Add existing history
      for (const msg of history) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Build the user message based on action
    let userMessage = message || '';

    if (action === 'analyze' && !message) {
      userMessage = ANALYSIS_PROMPT
        .replace('{{name}}', currentPrompt.name)
        .replace('{{description}}', currentPrompt.description || 'No description')
        .replace('{{systemPrompt}}', currentPrompt.systemPrompt)
        .replace('{{templates}}', Object.entries(currentPrompt.templates)
          .map(([key, value]) => `### ${key}:\n\`\`\`\n${value}\n\`\`\``)
          .join('\n\n') || 'No templates');
    } else if (action === 'improve' && !message) {
      userMessage = IMPROVE_PROMPT
        .replace('{{systemPrompt}}', currentPrompt.systemPrompt)
        .replace('{{templates}}', Object.entries(currentPrompt.templates)
          .map(([key, value]) => `### ${key}:\n\`\`\`\n${value}\n\`\`\``)
          .join('\n\n') || 'No templates')
        .replace('{{focus}}', 'Based on our discussion');
    } else if (action === 'test') {
      userMessage = TEST_PROMPT
        .replace('{{systemPrompt}}', currentPrompt.systemPrompt)
        .replace('{{testInput}}', JSON.stringify(testInput || {}, null, 2));
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Generate response
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH,
      config: {
        systemInstruction: REFINER_SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
      contents,
    });

    const responseText = response.text || '';

    // Extract any improved prompts from the response
    const improvedPrompts = extractImprovedPrompts(responseText);

    return NextResponse.json({
      agentId,
      response: responseText,
      improvedPrompts,
      tokenUsage: {
        input: response.usageMetadata?.promptTokenCount || 0,
        output: response.usageMetadata?.candidatesTokenCount || 0,
        total: response.usageMetadata?.totalTokenCount || 0,
      },
    });
  } catch (error) {
    console.error('[Prompt Refine API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract improved prompts from the response
 * Looks for code blocks that might contain improved prompts
 * Supports multiple label formats for flexibility
 */
function extractImprovedPrompts(text: string): {
  systemPrompt?: string;
  templates?: Record<string, string>;
} | null {
  const result: { systemPrompt?: string; templates?: Record<string, string> } = {};

  // Look for system prompt in code blocks
  // Patterns: "System Prompt:", "improved system prompt", etc.
  const systemPromptPatterns = [
    /(?:^|\n)(?:\*\*)?System\s+Prompt(?:\*\*)?[:\s]*\n*```(?:\w+)?\n([\s\S]*?)```/i,
    /(?:improved|updated|new|revised)\s+(?:\*\*)?system\s*prompt(?:\*\*)?[:\s]*\n*```(?:\w+)?\n([\s\S]*?)```/i,
  ];

  for (const pattern of systemPromptPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.systemPrompt = match[1].trim();
      break;
    }
  }

  // Look for templates with various label formats
  // Patterns: "Template: analyzeVideo", "### analyzeVideo", "template analyzeVideo"
  const templatePatterns = [
    /(?:^|\n)(?:\*\*)?Template[:\s]+[`"]?(\w+)[`"]?(?:\*\*)?[:\s]*\n*```(?:\w+)?\n([\s\S]*?)```/gi,
    /(?:^|\n)###\s+[`"]?(\w+)[`"]?[:\s]*\n*```(?:\w+)?\n([\s\S]*?)```/gi,
    /(?:improved|updated)\s+(?:\*\*)?template[:\s]+[`"]?(\w+)[`"]?(?:\*\*)?[:\s]*\n*```(?:\w+)?\n([\s\S]*?)```/gi,
  ];

  for (const pattern of templatePatterns) {
    const templateMatches = text.matchAll(pattern);
    for (const match of templateMatches) {
      if (!result.templates) result.templates = {};
      result.templates[match[1]] = match[2].trim();
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
