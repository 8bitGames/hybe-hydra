/**
 * Evolution Service
 * =================
 * Main orchestrator for the automated agent evolution pipeline
 *
 * Features:
 * - Coordinates feedback analysis, prompt improvement, and A/B testing
 * - Manages evolution cycles and candidates
 * - Handles approval/rejection workflows
 * - Integrates with prompt management system
 */

import { getServiceClient } from '@/lib/supabase/service';
import { loadPromptFromDatabase, updatePromptWithHistory, DatabasePrompt } from '../prompt-loader';
import { FeedbackAnalyzer, createFeedbackAnalyzer } from './feedback-analyzer';
import { PromptImprover, createPromptImprover } from './prompt-improver';
import { ABTestRunner, createABTestRunner } from './ab-test-runner';
import {
  configRowToConfig,
  cycleRowToCycle,
  candidateRowToCandidate,
  DEFAULT_QUALITY_GATES,
} from './types';
import type {
  EvolutionConfig,
  EvolutionCycle,
  EvolutionCycleResult,
  EvolutionSummary,
  EvolutionStatus,
  PromptCandidate,
  EvolutionConfigRow,
  EvolutionCycleRow,
  EvolutionCandidateRow,
  QualityGates,
} from './types';

export class EvolutionService {
  private feedbackAnalyzer: FeedbackAnalyzer;
  private promptImprover: PromptImprover;
  private abTestRunner: ABTestRunner;

  constructor() {
    this.feedbackAnalyzer = createFeedbackAnalyzer();
    this.promptImprover = createPromptImprover();
    this.abTestRunner = createABTestRunner();
  }

  /**
   * Run evolution cycle for a specific agent
   */
  async runEvolutionCycle(agentId: string, forceRun: boolean = false): Promise<EvolutionCycleResult> {
    const supabase = getServiceClient();
    let cycleId = '';

    try {
      // 1. Get or create evolution config
      const config = await this.getOrCreateConfig(agentId);

      if (!config.enabled && !forceRun) {
        return {
          cycleId: '',
          agentId,
          status: 'failed',
          candidates: [],
          requiresApproval: false,
          error: 'Evolution disabled for this agent',
        };
      }

      // 2. Check eligibility
      const hasEnoughFeedback = await this.feedbackAnalyzer.hasEnoughFeedback(
        agentId,
        config.minFeedbackCount
      );

      if (!hasEnoughFeedback && !forceRun) {
        return {
          cycleId: '',
          agentId,
          status: 'failed',
          candidates: [],
          requiresApproval: false,
          error: `Insufficient feedback (need at least ${config.minFeedbackCount})`,
        };
      }

      // 3. Create cycle record
      const { data: cycleData, error: cycleError } = await supabase
        .from('agent_evolution_cycles')
        .insert({
          agent_id: agentId,
          status: 'analyzing',
        })
        .select('id')
        .single();

      if (cycleError || !cycleData) {
        throw new Error(`Failed to create cycle: ${cycleError?.message}`);
      }

      cycleId = cycleData.id;

      // 4. Analyze feedback
      await this.updateCycleStatus(cycleId, 'analyzing');
      const feedbackAnalysis = await this.feedbackAnalyzer.analyzeAgentFeedback(agentId);

      // Store feedback summary
      await supabase
        .from('agent_evolution_cycles')
        .update({ feedback_summary: feedbackAnalysis.summary })
        .eq('id', cycleId);

      // 5. Get current prompt
      const currentPrompt = await loadPromptFromDatabase(agentId);
      if (!currentPrompt) {
        throw new Error(`No prompt found for agent: ${agentId}`);
      }

      // 6. Generate candidates
      await this.updateCycleStatus(cycleId, 'generating');
      const generationResult = await this.promptImprover.generateCandidates(
        currentPrompt,
        feedbackAnalysis,
        config.maxCandidatesPerCycle
      );

      if (generationResult.candidates.length === 0) {
        throw new Error('Failed to generate any valid candidates');
      }

      // 7. Save candidates to DB
      const savedCandidates: PromptCandidate[] = [];
      for (const candidate of generationResult.candidates) {
        const { data: savedCandidate, error: saveError } = await supabase
          .from('agent_evolution_candidates')
          .insert({
            cycle_id: cycleId,
            agent_id: agentId,
            candidate_version: candidate.candidateVersion,
            system_prompt: candidate.systemPrompt,
            templates: candidate.templates,
            model_options: candidate.modelOptions,
            generation_rationale: candidate.generationRationale,
            status: 'pending',
          })
          .select('*')
          .single();

        if (saveError) {
          console.error('[EvolutionService] Failed to save candidate:', saveError);
          continue;
        }

        savedCandidates.push(candidateRowToCandidate(savedCandidate));
      }

      // 8. Run A/B tests for each candidate
      await this.updateCycleStatus(cycleId, 'testing');
      const testedCandidates: PromptCandidate[] = [];

      for (const candidate of savedCandidates) {
        // Update candidate status
        await supabase
          .from('agent_evolution_candidates')
          .update({ status: 'testing' })
          .eq('id', candidate.id);

        // Run test
        const testResult = await this.abTestRunner.runComparison(
          agentId,
          currentPrompt,
          candidate
        );

        // Evaluate against quality gates
        const evaluation = this.abTestRunner.evaluateResults(testResult, {
          minFeedbackCount: config.minFeedbackCount,
          minImprovementThreshold: config.minImprovementThreshold,
          maxRegressionAllowed: 0.05,
          minTestPassRate: 0.8,
          requireHumanApproval: config.requireHumanApproval,
        });

        // Update candidate with results
        const newStatus = evaluation.passed ? 'passed' : 'failed';
        await supabase
          .from('agent_evolution_candidates')
          .update({
            status: newStatus,
            test_results: testResult,
            baseline_score: testResult.baselineResults.avgOverallScore,
            candidate_score: testResult.candidateResults.avgOverallScore,
            improvement_delta: testResult.comparison.overallImprovement,
          })
          .eq('id', candidate.id);

        testedCandidates.push({
          ...candidate,
          status: newStatus,
          testResults: testResult,
          baselineScore: testResult.baselineResults.avgOverallScore,
          candidateScore: testResult.candidateResults.avgOverallScore,
          improvementDelta: testResult.comparison.overallImprovement,
        });
      }

      // 9. Determine best candidate and final status
      const passedCandidates = testedCandidates.filter(c => c.status === 'passed');
      let bestCandidate: PromptCandidate | undefined;
      let requiresApproval = config.requireHumanApproval;

      if (passedCandidates.length > 0) {
        // Sort by improvement delta
        passedCandidates.sort((a, b) =>
          (b.improvementDelta || 0) - (a.improvementDelta || 0)
        );
        bestCandidate = passedCandidates[0];

        // Check for auto-promotion
        if (
          !config.requireHumanApproval &&
          bestCandidate.improvementDelta &&
          bestCandidate.improvementDelta >= config.autoPromoteThreshold
        ) {
          // Auto-promote
          await this.promoteCandidate(bestCandidate.id, 'system', currentPrompt);
          requiresApproval = false;
        } else {
          // Set to reviewing
          await this.updateCycleStatus(cycleId, 'reviewing');
        }
      }

      // 10. Complete cycle
      const finalStatus = passedCandidates.length > 0
        ? (requiresApproval ? 'reviewing' : 'completed')
        : 'completed';

      await supabase
        .from('agent_evolution_cycles')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', cycleId);

      return {
        cycleId,
        agentId,
        status: finalStatus,
        candidates: testedCandidates,
        bestCandidate,
        improvementDelta: bestCandidate?.improvementDelta,
        requiresApproval,
      };

    } catch (error) {
      console.error('[EvolutionService] Evolution cycle failed:', error);

      // Update cycle status to failed
      if (cycleId) {
        await supabase
          .from('agent_evolution_cycles')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', cycleId);
      }

      return {
        cycleId: cycleId || '',
        agentId,
        status: 'failed',
        candidates: [],
        requiresApproval: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run evolution for all eligible agents
   */
  async runAllEligibleAgents(): Promise<EvolutionSummary> {
    const supabase = getServiceClient();

    // Get all enabled configs
    const { data: configs, error } = await supabase
      .from('agent_evolution_config')
      .select('*')
      .eq('enabled', true);

    if (error || !configs) {
      return {
        totalAgentsProcessed: 0,
        successfulEvolutions: 0,
        failedEvolutions: 0,
        candidatesGenerated: 0,
        candidatesPromoted: 0,
        candidatesPendingReview: 0,
        cycles: [],
      };
    }

    const cycles: EvolutionCycleResult[] = [];
    let successful = 0;
    let failed = 0;
    let generated = 0;
    let promoted = 0;
    let pending = 0;

    for (const configRow of configs) {
      const config = configRowToConfig(configRow as EvolutionConfigRow);

      // Check if agent has enough feedback
      const hasEnough = await this.feedbackAnalyzer.hasEnoughFeedback(
        config.agentId,
        config.minFeedbackCount
      );

      if (!hasEnough) {
        continue;
      }

      // Run evolution
      const result = await this.runEvolutionCycle(config.agentId);
      cycles.push(result);

      if (result.status === 'failed') {
        failed++;
      } else {
        successful++;
      }

      generated += result.candidates.length;

      if (result.bestCandidate?.status === 'promoted') {
        promoted++;
      }

      if (result.requiresApproval) {
        pending += result.candidates.filter(c => c.status === 'passed').length;
      }
    }

    return {
      totalAgentsProcessed: cycles.length,
      successfulEvolutions: successful,
      failedEvolutions: failed,
      candidatesGenerated: generated,
      candidatesPromoted: promoted,
      candidatesPendingReview: pending,
      cycles,
    };
  }

  /**
   * Get evolution status for an agent
   */
  async getEvolutionStatus(agentId: string): Promise<EvolutionStatus> {
    const supabase = getServiceClient();

    // Get config
    const config = await this.getOrCreateConfig(agentId);

    // Get latest cycle
    const { data: cycleData } = await supabase
      .from('agent_evolution_cycles')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get pending candidates
    const { data: candidateData } = await supabase
      .from('agent_evolution_candidates')
      .select('*')
      .eq('agent_id', agentId)
      .in('status', ['pending', 'passed'])
      .order('created_at', { ascending: false });

    // Check eligibility
    const hasEnoughFeedback = await this.feedbackAnalyzer.hasEnoughFeedback(
      agentId,
      config.minFeedbackCount
    );

    let reasonIfNotEligible: string | undefined;
    if (!config.enabled) {
      reasonIfNotEligible = 'Evolution is disabled for this agent';
    } else if (!hasEnoughFeedback) {
      reasonIfNotEligible = `Insufficient feedback (need at least ${config.minFeedbackCount})`;
    }

    return {
      agentId,
      lastCycle: cycleData ? cycleRowToCycle(cycleData as EvolutionCycleRow) : undefined,
      pendingCandidates: (candidateData || []).map(row =>
        candidateRowToCandidate(row as EvolutionCandidateRow)
      ),
      config,
      eligibleForEvolution: config.enabled && hasEnoughFeedback,
      reasonIfNotEligible,
    };
  }

  /**
   * Approve a candidate for promotion
   */
  async approveCandidate(
    candidateId: string,
    userId: string,
    notes?: string
  ): Promise<boolean> {
    const supabase = getServiceClient();

    // Get candidate
    const { data: candidate, error } = await supabase
      .from('agent_evolution_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (error || !candidate) {
      console.error('[EvolutionService] Candidate not found:', candidateId);
      return false;
    }

    // Get current prompt
    const currentPrompt = await loadPromptFromDatabase(candidate.agent_id);
    if (!currentPrompt) {
      console.error('[EvolutionService] Current prompt not found for agent:', candidate.agent_id);
      return false;
    }

    // Promote
    return this.promoteCandidate(candidateId, userId, currentPrompt, notes);
  }

  /**
   * Reject a candidate
   */
  async rejectCandidate(
    candidateId: string,
    userId: string,
    reason: string
  ): Promise<boolean> {
    const supabase = getServiceClient();

    const { error } = await supabase
      .from('agent_evolution_candidates')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reason,
      })
      .eq('id', candidateId);

    if (error) {
      console.error('[EvolutionService] Failed to reject candidate:', error);
      return false;
    }

    console.log(`[EvolutionService] Candidate ${candidateId} rejected by ${userId}`);
    return true;
  }

  /**
   * Update evolution config for an agent
   */
  async updateConfig(
    agentId: string,
    updates: Partial<Omit<EvolutionConfig, 'id' | 'agentId' | 'createdAt' | 'updatedAt'>>
  ): Promise<EvolutionConfig | null> {
    const supabase = getServiceClient();

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.minFeedbackCount !== undefined) dbUpdates.min_feedback_count = updates.minFeedbackCount;
    if (updates.minImprovementThreshold !== undefined) dbUpdates.min_improvement_threshold = updates.minImprovementThreshold;
    if (updates.autoPromoteThreshold !== undefined) dbUpdates.auto_promote_threshold = updates.autoPromoteThreshold;
    if (updates.requireHumanApproval !== undefined) dbUpdates.require_human_approval = updates.requireHumanApproval;
    if (updates.maxCandidatesPerCycle !== undefined) dbUpdates.max_candidates_per_cycle = updates.maxCandidatesPerCycle;

    const { data, error } = await supabase
      .from('agent_evolution_config')
      .update(dbUpdates)
      .eq('agent_id', agentId)
      .select('*')
      .single();

    if (error) {
      console.error('[EvolutionService] Failed to update config:', error);
      return null;
    }

    return configRowToConfig(data as EvolutionConfigRow);
  }

  /**
   * Get list of all evolution cycles
   */
  async listCycles(
    agentId?: string,
    limit: number = 20
  ): Promise<EvolutionCycle[]> {
    const supabase = getServiceClient();

    let query = supabase
      .from('agent_evolution_cycles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[EvolutionService] Failed to list cycles:', error);
      return [];
    }

    return (data || []).map(row => cycleRowToCycle(row as EvolutionCycleRow));
  }

  /**
   * Get pending candidates for review
   */
  async getPendingCandidates(): Promise<PromptCandidate[]> {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('agent_evolution_candidates')
      .select('*')
      .eq('status', 'passed')
      .order('improvement_delta', { ascending: false });

    if (error) {
      console.error('[EvolutionService] Failed to get pending candidates:', error);
      return [];
    }

    return (data || []).map(row => candidateRowToCandidate(row as EvolutionCandidateRow));
  }

  // ================================
  // Private Helper Methods
  // ================================

  /**
   * Get or create evolution config for an agent
   */
  private async getOrCreateConfig(agentId: string): Promise<EvolutionConfig> {
    const supabase = getServiceClient();

    // Try to get existing config
    const { data: existing } = await supabase
      .from('agent_evolution_config')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (existing) {
      return configRowToConfig(existing as EvolutionConfigRow);
    }

    // Create default config
    const { data: created, error } = await supabase
      .from('agent_evolution_config')
      .insert({
        agent_id: agentId,
        enabled: true,
        min_feedback_count: 10,
        min_improvement_threshold: 0.1,
        auto_promote_threshold: 0.2,
        require_human_approval: true,
        max_candidates_per_cycle: 3,
      })
      .select('*')
      .single();

    if (error || !created) {
      // Return default config if creation fails
      return {
        id: '',
        agentId,
        enabled: true,
        minFeedbackCount: 10,
        minImprovementThreshold: 0.1,
        autoPromoteThreshold: 0.2,
        requireHumanApproval: true,
        maxCandidatesPerCycle: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return configRowToConfig(created as EvolutionConfigRow);
  }

  /**
   * Update cycle status
   */
  private async updateCycleStatus(
    cycleId: string,
    status: EvolutionCycle['status']
  ): Promise<void> {
    const supabase = getServiceClient();

    await supabase
      .from('agent_evolution_cycles')
      .update({ status })
      .eq('id', cycleId);
  }

  /**
   * Promote a candidate to production
   */
  private async promoteCandidate(
    candidateId: string,
    userId: string,
    currentPrompt: DatabasePrompt,
    notes?: string
  ): Promise<boolean> {
    const supabase = getServiceClient();

    // Get candidate
    const { data: candidate, error: fetchError } = await supabase
      .from('agent_evolution_candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      console.error('[EvolutionService] Candidate not found:', candidateId);
      return false;
    }

    // Update prompt with history tracking
    const success = await updatePromptWithHistory(
      currentPrompt.id,
      {
        system_prompt: candidate.system_prompt,
        templates: candidate.templates,
        model_options: candidate.model_options,
      },
      {
        changedBy: userId,
        changeNotes: notes || `Auto-evolved from candidate ${candidateId}. Improvement: ${((candidate.improvement_delta || 0) * 100).toFixed(1)}%`,
      }
    );

    if (!success) {
      console.error('[EvolutionService] Failed to update prompt');
      return false;
    }

    // Update candidate status
    await supabase
      .from('agent_evolution_candidates')
      .update({
        status: 'promoted',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || 'Promoted to production',
      })
      .eq('id', candidateId);

    // Update cycle status if this was the last pending candidate
    const { data: cycleCandidates } = await supabase
      .from('agent_evolution_candidates')
      .select('status')
      .eq('cycle_id', candidate.cycle_id);

    const allResolved = (cycleCandidates || []).every(
      c => ['promoted', 'rejected', 'failed'].includes(c.status)
    );

    if (allResolved) {
      await supabase
        .from('agent_evolution_cycles')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', candidate.cycle_id);
    }

    console.log(`[EvolutionService] Candidate ${candidateId} promoted by ${userId}`);
    return true;
  }
}

// Factory function
export function createEvolutionService(): EvolutionService {
  return new EvolutionService();
}
