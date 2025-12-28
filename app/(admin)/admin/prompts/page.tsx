'use client';

/**
 * Agent Prompts Admin Page
 * ========================
 * Hidden admin page for managing AI agent prompts
 * Access via: /admin/prompts
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Save,
  History,
  RotateCcw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Play,
  Star,
  Clock,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  RefreshCw,
  GitCompare,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
} from 'lucide-react';
import { PromptRefinerChat } from '@/components/admin/prompt-refiner-chat';

interface AgentPrompt {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  category: string;
  system_prompt: string;
  templates: Record<string, string>;
  model_provider: string;
  model_name: string;
  model_options: Record<string, unknown>;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PromptHistory {
  id: string;
  version: number;
  system_prompt: string;
  templates: Record<string, string>;
  changed_by: string | null;
  changed_at: string;
  change_notes: string | null;
}

interface AgentMetrics {
  total_executions: number;
  success_rate: number;
  avg_latency_ms: number;
  avg_overall_score: number;
  feedback_count: number;
}

interface AgentExecution {
  id: string;
  status: 'running' | 'success' | 'error';
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
  agent_feedback?: Array<{
    overall_score: number;
    feedback_type: string;
    relevance_score?: number;
    quality_score?: number;
    creativity_score?: number;
    feedback_text?: string;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
  }>;
}

interface DetailedEvaluation {
  overall_score: number;
  relevance_score: number;
  quality_score: number;
  creativity_score: number;
  feedback_text: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  evaluated_at?: string;
}

interface SyncResult {
  agentId: string;
  name: string;
  status: 'unchanged' | 'updated' | 'created' | 'error';
  changes?: {
    system_prompt: boolean;
    templates: boolean;
    model_options: boolean;
  };
  oldVersion?: number;
  newVersion?: number;
  error?: string;
}

interface SyncResponse {
  mode: 'scan' | 'sync';
  success?: boolean;
  summary: {
    total: number;
    unchanged: number;
    changed?: number;
    updated?: number;
    created?: number;
    new?: number;
    errors?: number;
  };
  results: SyncResult[];
}

const CATEGORIES = [
  { value: 'analyzer', label: 'Analyzer', color: 'bg-blue-500' },
  { value: 'creator', label: 'Creator', color: 'bg-purple-500' },
  { value: 'transformer', label: 'Transformer', color: 'bg-orange-500' },
  { value: 'publisher', label: 'Publisher', color: 'bg-green-500' },
];

const MODEL_PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI GPT' },
];

const MODEL_NAMES = {
  gemini: [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  openai: [
    { value: 'gpt-5.2-2025-12-11', label: 'GPT-5.2 (2025-12-11)' },
    { value: 'gpt-5.1', label: 'GPT-5.1' },
    { value: 'gpt-5.1-mini', label: 'GPT-5.1 Mini' },
  ],
};

export default function PromptsAdminPage() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<AgentPrompt | null>(null);
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Sync state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResponse | null>(null);

  // Deep Evaluation state
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<AgentExecution | null>(null);
  const [detailedEvaluation, setDetailedEvaluation] = useState<DetailedEvaluation | null>(null);
  const [deepEvaluating, setDeepEvaluating] = useState(false);

  // Tab control for smooth evaluation-to-refine flow
  const [activeTab, setActiveTab] = useState('prompt');
  const [refinerInitialMessage, setRefinerInitialMessage] = useState<string | undefined>(undefined);

  // Fetch prompts
  const fetchPrompts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') {
        params.set('category', filterCategory);
      }
      params.set('active', 'false'); // Show all including inactive

      const res = await fetch(`/api/v1/admin/prompts?${params}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      setMessage({ type: 'error', text: 'Failed to load prompts' });
    } finally {
      setLoading(false);
    }
  }, [filterCategory]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Fetch history for selected prompt
  const fetchHistory = async (agentId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/prompts/${agentId}/history`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setHistory(data.history || []);
      setHistoryOpen(true);
    } catch (error) {
      console.error('Error fetching history:', error);
      setMessage({ type: 'error', text: 'Failed to load history' });
    }
  };

  // Fetch metrics for selected agent
  const fetchMetrics = async (agentId: string) => {
    setLoadingMetrics(true);
    try {
      const res = await fetch(`/api/v1/agents/metrics?agent_id=${agentId}&days=7`);
      const data = await res.json();
      if (data.summary) {
        setMetrics(data.summary);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Fetch executions for selected agent
  const fetchExecutions = async (agentId: string) => {
    try {
      const res = await fetch(`/api/v1/agents/executions?agent_id=${agentId}&limit=10`);
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
    }
  };

  // Scan for code changes (dry-run)
  const scanCodeChanges = async () => {
    setSyncLoading(true);
    setSyncResults(null);
    try {
      const res = await fetch('/api/v1/admin/prompts/sync');
      const data = await res.json();
      setSyncResults(data);
      setSyncDialogOpen(true);
    } catch (error) {
      console.error('Error scanning changes:', error);
      setMessage({ type: 'error', text: 'Failed to scan for changes' });
    } finally {
      setSyncLoading(false);
    }
  };

  // Apply sync from code to DB
  const applySyncFromCode = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch('/api/v1/admin/prompts/sync', {
        method: 'POST',
      });
      const data = await res.json();
      setSyncResults(data);
      if (data.success) {
        setMessage({ type: 'success', text: `Sync complete: ${data.summary.updated || 0} updated, ${data.summary.created || 0} created` });
        fetchPrompts(); // Refresh prompt list
      } else {
        setMessage({ type: 'error', text: `Sync had ${data.summary.errors} errors` });
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setMessage({ type: 'error', text: 'Failed to sync prompts' });
    } finally {
      setSyncLoading(false);
    }
  };

  // Trigger Deep Evaluation (LLM-as-Judge)
  const triggerDeepEvaluation = async (execution: AgentExecution) => {
    setSelectedExecution(execution);
    setDetailedEvaluation(null);
    setEvaluationDialogOpen(true);

    // First check if we already have an LLM evaluation
    try {
      const existingRes = await fetch(`/api/v1/agents/executions/${execution.id}/evaluate`);
      const existingData = await existingRes.json();

      if (existingData.hasEvaluation && existingData.evaluation) {
        setDetailedEvaluation(existingData.evaluation);
        return;
      }
    } catch (error) {
      console.error('Error checking existing evaluation:', error);
    }

    // No existing evaluation, trigger new one
    setDeepEvaluating(true);
    try {
      const res = await fetch(`/api/v1/agents/executions/${execution.id}/evaluate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success && data.evaluation) {
        setDetailedEvaluation(data.evaluation);
        setMessage({ type: 'success', text: 'Deep evaluation completed!' });
        // Refresh executions to update the list
        if (selectedPrompt) {
          fetchExecutions(selectedPrompt.agent_id);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to evaluate execution' });
      }
    } catch (error) {
      console.error('Error triggering deep evaluation:', error);
      setMessage({ type: 'error', text: 'Failed to trigger deep evaluation' });
    } finally {
      setDeepEvaluating(false);
    }
  };

  // Load metrics when prompt is selected
  useEffect(() => {
    if (selectedPrompt) {
      fetchMetrics(selectedPrompt.agent_id);
      fetchExecutions(selectedPrompt.agent_id);
    } else {
      setMetrics(null);
      setExecutions([]);
    }
  }, [selectedPrompt?.agent_id]);

  // Save prompt
  const savePrompt = async () => {
    if (!selectedPrompt) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/admin/prompts/${selectedPrompt.agent_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedPrompt,
          change_notes: 'Updated via admin panel',
        }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSelectedPrompt(data.prompt);
      setMessage({ type: 'success', text: 'Prompt saved successfully!' });
      fetchPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      setMessage({ type: 'error', text: 'Failed to save prompt' });
    } finally {
      setSaving(false);
    }
  };

  // Restore version
  const restoreVersion = async (version: number) => {
    if (!selectedPrompt) return;

    try {
      const res = await fetch(`/api/v1/admin/prompts/${selectedPrompt.agent_id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSelectedPrompt(data.prompt);
      setHistoryOpen(false);
      setMessage({ type: 'success', text: `Restored to version ${version}` });
      fetchPrompts();
    } catch (error) {
      console.error('Error restoring version:', error);
      setMessage({ type: 'error', text: 'Failed to restore version' });
    }
  };

  // Toggle template expansion
  const toggleTemplate = (key: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedTemplates(newExpanded);
  };

  // Update template
  const updateTemplate = (key: string, value: string) => {
    if (!selectedPrompt) return;
    setSelectedPrompt({
      ...selectedPrompt,
      templates: {
        ...selectedPrompt.templates,
        [key]: value,
      },
    });
  };

  // Add new template
  const addTemplate = () => {
    if (!selectedPrompt) return;
    const newKey = `template_${Object.keys(selectedPrompt.templates).length + 1}`;
    setSelectedPrompt({
      ...selectedPrompt,
      templates: {
        ...selectedPrompt.templates,
        [newKey]: '',
      },
    });
    setExpandedTemplates(new Set([...expandedTemplates, newKey]));
  };

  // Delete template
  const deleteTemplate = (key: string) => {
    if (!selectedPrompt) return;
    const newTemplates = { ...selectedPrompt.templates };
    delete newTemplates[key];
    setSelectedPrompt({
      ...selectedPrompt,
      templates: newTemplates,
    });
  };

  // Rename template key
  const renameTemplate = (oldKey: string, newKey: string) => {
    if (!selectedPrompt || oldKey === newKey) return;
    const newTemplates: Record<string, string> = {};
    Object.entries(selectedPrompt.templates).forEach(([k, v]) => {
      newTemplates[k === oldKey ? newKey : k] = v;
    });
    setSelectedPrompt({
      ...selectedPrompt,
      templates: newTemplates,
    });
    const newExpanded = new Set(expandedTemplates);
    newExpanded.delete(oldKey);
    newExpanded.add(newKey);
    setExpandedTemplates(newExpanded);
  };

  const getCategoryColor = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.color || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Agent Prompts Manager</h1>
            <p className="text-gray-400">Manage AI agent system prompts and templates</p>
          </div>
          <Button
            onClick={scanCodeChanges}
            disabled={syncLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {syncLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <GitCompare className="w-4 h-4 mr-2" />
            )}
            Sync from Code
          </Button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Prompt List */}
          <div className="col-span-4">
            <Card className="bg-gray-900 border-gray-800 text-white">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">Agents</CardTitle>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all" className="text-white hover:bg-gray-700">All</SelectItem>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-gray-700">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {prompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => setSelectedPrompt(prompt)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPrompt?.id === prompt.id
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${getCategoryColor(prompt.category)} text-white text-xs`}>
                        {prompt.category}
                      </Badge>
                      {!prompt.is_active && (
                        <Badge variant="outline" className="text-gray-500 border-gray-600 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="font-medium text-white">{prompt.name}</div>
                    <div className="text-xs text-gray-400">{prompt.agent_id}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      v{prompt.version} • {prompt.model_name}
                    </div>
                  </button>
                ))}

                {prompts.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No prompts found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Editor */}
          <div className="col-span-8">
            {selectedPrompt ? (
              <Card className="bg-gray-900 border-gray-800 text-white">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">{selectedPrompt.name}</CardTitle>
                      <p className="text-sm text-gray-400 mt-1">
                        {selectedPrompt.agent_id} • Version {selectedPrompt.version}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchHistory(selectedPrompt.agent_id)}
                        className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                      >
                        <History className="w-4 h-4 mr-2" />
                        History
                      </Button>
                      <Button
                        size="sm"
                        onClick={savePrompt}
                        disabled={saving}
                        className="bg-white text-black hover:bg-gray-200"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-gray-800 border border-gray-700 mb-4">
                      <TabsTrigger value="prompt" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">System Prompt</TabsTrigger>
                      <TabsTrigger value="templates" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">Templates</TabsTrigger>
                      <TabsTrigger value="config" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">Model Config</TabsTrigger>
                      <TabsTrigger value="refine" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Refine
                      </TabsTrigger>
                      <TabsTrigger value="evaluation" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white text-gray-400">
                        <BarChart3 className="w-4 h-4 mr-1" />
                        Evaluation
                      </TabsTrigger>
                    </TabsList>

                    {/* System Prompt Tab */}
                    <TabsContent value="prompt" className="space-y-4">
                      <div>
                        <Label className="text-gray-300">Description</Label>
                        <Input
                          value={selectedPrompt.description || ''}
                          onChange={e =>
                            setSelectedPrompt({
                              ...selectedPrompt,
                              description: e.target.value,
                            })
                          }
                          className="bg-gray-800 border-gray-700 mt-1 text-white placeholder:text-gray-500"
                          placeholder="Brief description of this agent"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">System Prompt</Label>
                        <Textarea
                          value={selectedPrompt.system_prompt}
                          onChange={e =>
                            setSelectedPrompt({
                              ...selectedPrompt,
                              system_prompt: e.target.value,
                            })
                          }
                          className="bg-gray-800 border-gray-700 mt-1 min-h-[400px] font-mono text-sm text-white placeholder:text-gray-500"
                          placeholder="Enter system prompt..."
                        />
                        <p className="text-xs text-gray-400 mt-1">
                          {selectedPrompt.system_prompt.length} characters
                        </p>
                      </div>
                    </TabsContent>

                    {/* Templates Tab */}
                    <TabsContent value="templates" className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-gray-300">
                          Prompt Templates ({Object.keys(selectedPrompt.templates).length})
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addTemplate}
                          className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Template
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {Object.entries(selectedPrompt.templates).map(([key, value]) => (
                          <div
                            key={key}
                            className="bg-gray-800 rounded-lg border border-gray-700"
                          >
                            <button
                              onClick={() => toggleTemplate(key)}
                              className="w-full flex items-center justify-between p-3 hover:bg-gray-700/50 transition-colors text-white"
                            >
                              <div className="flex items-center gap-2">
                                {expandedTemplates.has(key) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <span className="font-mono text-sm">{key}</span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {value.length} chars
                              </span>
                            </button>

                            {expandedTemplates.has(key) && (
                              <div className="p-3 pt-0 space-y-3">
                                <div className="flex gap-2">
                                  <Input
                                    value={key}
                                    onChange={e => renameTemplate(key, e.target.value)}
                                    className="bg-gray-900 border-gray-600 font-mono text-sm text-white"
                                    placeholder="Template name"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteTemplate(key)}
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                                <Textarea
                                  value={value}
                                  onChange={e => updateTemplate(key, e.target.value)}
                                  className="bg-gray-900 border-gray-600 min-h-[200px] font-mono text-sm text-white placeholder:text-gray-500"
                                  placeholder="Template content..."
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Config Tab */}
                    <TabsContent value="config" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-300">Model Provider</Label>
                          <Select
                            value={selectedPrompt.model_provider}
                            onValueChange={value =>
                              setSelectedPrompt({
                                ...selectedPrompt,
                                model_provider: value,
                                model_name: MODEL_NAMES[value as keyof typeof MODEL_NAMES][0].value,
                              })
                            }
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {MODEL_PROVIDERS.map(p => (
                                <SelectItem key={p.value} value={p.value} className="text-white hover:bg-gray-700">
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-300">Model Name</Label>
                          <Select
                            value={selectedPrompt.model_name}
                            onValueChange={value =>
                              setSelectedPrompt({
                                ...selectedPrompt,
                                model_name: value,
                              })
                            }
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700 mt-1 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {MODEL_NAMES[
                                selectedPrompt.model_provider as keyof typeof MODEL_NAMES
                              ]?.map(m => (
                                <SelectItem key={m.value} value={m.value} className="text-white hover:bg-gray-700">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-gray-300">Model Options (JSON)</Label>
                        <Textarea
                          value={JSON.stringify(selectedPrompt.model_options, null, 2)}
                          onChange={e => {
                            try {
                              const options = JSON.parse(e.target.value);
                              setSelectedPrompt({
                                ...selectedPrompt,
                                model_options: options,
                              });
                            } catch {
                              // Invalid JSON, ignore
                            }
                          }}
                          className="bg-gray-800 border-gray-700 mt-1 font-mono text-sm min-h-[150px] text-white"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <Label className="text-gray-300">Active</Label>
                        <Button
                          variant={selectedPrompt.is_active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() =>
                            setSelectedPrompt({
                              ...selectedPrompt,
                              is_active: !selectedPrompt.is_active,
                            })
                          }
                          className={
                            selectedPrompt.is_active
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'border-gray-700 text-white'
                          }
                        >
                          {selectedPrompt.is_active ? 'Active' : 'Inactive'}
                        </Button>
                      </div>
                    </TabsContent>

                    {/* Refine Tab - AI-assisted prompt improvement */}
                    <TabsContent value="refine" className="space-y-4">
                      <PromptRefinerChat
                        agentId={selectedPrompt.agent_id}
                        currentPrompt={{
                          systemPrompt: selectedPrompt.system_prompt,
                          templates: selectedPrompt.templates,
                          name: selectedPrompt.name,
                          description: selectedPrompt.description || undefined,
                        }}
                        onApplyImprovement={(improvement) => {
                          setSelectedPrompt(prev => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              ...(improvement.systemPrompt && { system_prompt: improvement.systemPrompt }),
                              ...(improvement.templates && {
                                templates: { ...prev.templates, ...improvement.templates }
                              }),
                            };
                          });
                          setMessage({ type: 'success', text: 'Improvement applied! Review and save when ready.' });
                        }}
                        initialMessage={refinerInitialMessage}
                        onInitialMessageProcessed={() => setRefinerInitialMessage(undefined)}
                      />
                    </TabsContent>

                    {/* Evaluation Tab */}
                    <TabsContent value="evaluation" className="space-y-6">
                      {/* Metrics Overview */}
                      <div>
                        <h3 className="text-lg font-medium text-white mb-4">Performance Metrics (Last 7 Days)</h3>
                        {loadingMetrics ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                          </div>
                        ) : metrics ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                <Play className="w-4 h-4" />
                                Executions
                              </div>
                              <div className="text-2xl font-bold text-white">
                                {metrics.total_executions}
                              </div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                {metrics.success_rate >= 80 ? (
                                  <TrendingUp className="w-4 h-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-500" />
                                )}
                                Success Rate
                              </div>
                              <div className={`text-2xl font-bold ${
                                metrics.success_rate >= 80 ? 'text-green-400' :
                                metrics.success_rate >= 50 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {metrics.success_rate.toFixed(1)}%
                              </div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                <Clock className="w-4 h-4" />
                                Avg Latency
                              </div>
                              <div className="text-2xl font-bold text-white">
                                {metrics.avg_latency_ms > 0
                                  ? `${(metrics.avg_latency_ms / 1000).toFixed(2)}s`
                                  : 'N/A'
                                }
                              </div>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                <Star className="w-4 h-4" />
                                Avg Score
                              </div>
                              <div className={`text-2xl font-bold ${
                                metrics.avg_overall_score >= 4 ? 'text-green-400' :
                                metrics.avg_overall_score >= 3 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {metrics.avg_overall_score > 0
                                  ? `${metrics.avg_overall_score.toFixed(1)}/5`
                                  : 'N/A'
                                }
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {metrics.feedback_count} reviews
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-gray-400 py-8">
                            No metrics available yet
                          </div>
                        )}
                      </div>

                      {/* Recent Executions */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-white">Recent Executions</h3>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              fetchMetrics(selectedPrompt.agent_id);
                              fetchExecutions(selectedPrompt.agent_id);
                            }}
                            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Refresh
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {executions.length === 0 ? (
                            <div className="text-center text-gray-400 py-8">
                              No executions recorded yet
                            </div>
                          ) : (
                            executions.map((exec) => {
                              const hasLlmEvaluation = exec.agent_feedback?.some(
                                f => f.feedback_type === 'llm_judge'
                              );
                              return (
                                <div
                                  key={exec.id}
                                  className="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                      exec.status === 'success' ? 'bg-green-500' :
                                      exec.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`} />
                                    <div>
                                      <div className="text-sm text-white">
                                        {exec.status === 'success' ? 'Success' :
                                         exec.status === 'error' ? 'Error' : 'Running'}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {new Date(exec.created_at).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    {exec.latency_ms && (
                                      <span className="text-gray-400">
                                        {(exec.latency_ms / 1000).toFixed(2)}s
                                      </span>
                                    )}
                                    {exec.input_tokens && exec.output_tokens && (
                                      <span className="text-gray-400">
                                        {exec.input_tokens + exec.output_tokens} tokens
                                      </span>
                                    )}
                                    {exec.agent_feedback && exec.agent_feedback.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3 text-yellow-500" />
                                        <span className="text-yellow-400">
                                          {exec.agent_feedback[0].overall_score}
                                        </span>
                                      </div>
                                    )}
                                    {exec.error_message && (
                                      <span className="text-red-400 text-xs max-w-[200px] truncate">
                                        {exec.error_message}
                                      </span>
                                    )}
                                    {exec.status === 'success' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => triggerDeepEvaluation(exec)}
                                        className={`border-gray-600 text-xs h-7 px-2 ${
                                          hasLlmEvaluation
                                            ? 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/30'
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                      >
                                        <Zap className="w-3 h-3 mr-1" />
                                        {hasLlmEvaluation ? 'View' : 'Deep Evaluate'}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-4 border-t border-gray-700">
                        <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Actions</h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                            onClick={() => {
                              window.open(`/api/v1/agents/metrics?agent_id=${selectedPrompt.agent_id}&days=30`, '_blank');
                            }}
                          >
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Export Metrics
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-900 border-gray-800 text-white">
                <CardContent className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <AlertCircle className="w-12 h-12 mb-4" />
                  <p>Select an agent from the list to edit its prompts</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[80vh] overflow-y-auto text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Version History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {history.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No history available</p>
            ) : (
              history.map(h => (
                <div
                  key={h.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-white">Version {h.version}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        {new Date(h.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreVersion(h.version)}
                      className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                  {h.change_notes && (
                    <p className="text-sm text-gray-300">{h.change_notes}</p>
                  )}
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                      View prompt preview
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-900 p-2 rounded overflow-x-auto text-gray-300">
                      {h.system_prompt.slice(0, 500)}
                      {h.system_prompt.length > 500 ? '...' : ''}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl max-h-[80vh] overflow-y-auto text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <GitCompare className="w-5 h-5" />
              {syncResults?.mode === 'sync' ? 'Sync Results' : 'Code Changes Detected'}
            </DialogTitle>
          </DialogHeader>

          {syncResults && (
            <div className="space-y-6 mt-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                  <div className="text-2xl font-bold text-white">{syncResults.summary.total}</div>
                  <div className="text-xs text-gray-400">Total</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                  <div className="text-2xl font-bold text-gray-400">{syncResults.summary.unchanged}</div>
                  <div className="text-xs text-gray-400">Unchanged</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-yellow-600/30 text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {syncResults.summary.changed ?? syncResults.summary.updated ?? 0}
                  </div>
                  <div className="text-xs text-gray-400">Updated</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-green-600/30 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {syncResults.summary.new ?? syncResults.summary.created ?? 0}
                  </div>
                  <div className="text-xs text-gray-400">New</div>
                </div>
              </div>

              {/* Changed Items */}
              {syncResults.results.filter(r => r.status !== 'unchanged').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Changes</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {syncResults.results
                      .filter(r => r.status !== 'unchanged')
                      .map(result => (
                        <div
                          key={result.agentId}
                          className={`bg-gray-800 rounded-lg p-3 border ${
                            result.status === 'error'
                              ? 'border-red-600/50'
                              : result.status === 'created'
                              ? 'border-green-600/50'
                              : 'border-yellow-600/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`text-xs ${
                                  result.status === 'error'
                                    ? 'bg-red-600'
                                    : result.status === 'created'
                                    ? 'bg-green-600'
                                    : 'bg-yellow-600'
                                }`}
                              >
                                {result.status}
                              </Badge>
                              <span className="font-medium text-white">{result.name}</span>
                              <span className="text-sm text-gray-400">({result.agentId})</span>
                            </div>
                            {result.newVersion && (
                              <span className="text-xs text-gray-400">
                                v{result.oldVersion ?? 0} → v{result.newVersion}
                              </span>
                            )}
                          </div>

                          {result.changes && (
                            <div className="flex gap-2 mt-2">
                              {result.changes.system_prompt && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                                  system_prompt
                                </Badge>
                              )}
                              {result.changes.templates && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                                  templates
                                </Badge>
                              )}
                              {result.changes.model_options && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                                  model_options
                                </Badge>
                              )}
                            </div>
                          )}

                          {result.error && (
                            <p className="text-sm text-red-400 mt-2">{result.error}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* No Changes Message */}
              {syncResults.results.filter(r => r.status !== 'unchanged').length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>All prompts are in sync with code!</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setSyncDialogOpen(false)}
                  className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  Close
                </Button>
                {syncResults.mode === 'scan' && syncResults.results.some(r => r.status !== 'unchanged') && (
                  <Button
                    onClick={applySyncFromCode}
                    disabled={syncLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {syncLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Apply Changes
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deep Evaluation Dialog */}
      <Dialog open={evaluationDialogOpen} onOpenChange={setEvaluationDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[80vh] overflow-y-auto text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Deep Evaluation (LLM-as-Judge)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Execution Info */}
            {selectedExecution && (
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="text-sm text-gray-400">Execution ID</div>
                <div className="text-white font-mono text-sm">{selectedExecution.id}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(selectedExecution.created_at).toLocaleString()}
                </div>
              </div>
            )}

            {/* Loading State */}
            {deepEvaluating && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400 mb-4" />
                <p className="text-gray-400">Running LLM-as-Judge evaluation...</p>
                <p className="text-xs text-gray-500 mt-1">This may take 10-30 seconds</p>
              </div>
            )}

            {/* Evaluation Results */}
            {detailedEvaluation && !deepEvaluating && (
              <div className="space-y-6">
                {/* Score Summary */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {detailedEvaluation.overall_score}/5
                    </div>
                    <div className="text-xs text-gray-400">Overall</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                    <div className={`text-xl font-bold ${
                      detailedEvaluation.quality_score >= 4 ? 'text-green-400' :
                      detailedEvaluation.quality_score >= 3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {detailedEvaluation.quality_score}/5
                    </div>
                    <div className="text-xs text-gray-400">Quality</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                    <div className={`text-xl font-bold ${
                      detailedEvaluation.relevance_score >= 4 ? 'text-green-400' :
                      detailedEvaluation.relevance_score >= 3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {detailedEvaluation.relevance_score}/5
                    </div>
                    <div className="text-xs text-gray-400">Relevance</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                    <div className={`text-xl font-bold ${
                      detailedEvaluation.creativity_score >= 4 ? 'text-green-400' :
                      detailedEvaluation.creativity_score >= 3 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {detailedEvaluation.creativity_score}/5
                    </div>
                    <div className="text-xs text-gray-400">Creativity</div>
                  </div>
                </div>

                {/* Feedback Text */}
                {detailedEvaluation.feedback_text && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                    <p className="text-white text-sm">{detailedEvaluation.feedback_text}</p>
                  </div>
                )}

                {/* Strengths */}
                {detailedEvaluation.strengths && detailedEvaluation.strengths.length > 0 && (
                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4" />
                      Strengths ({detailedEvaluation.strengths.length})
                    </h4>
                    <ul className="space-y-2">
                      {detailedEvaluation.strengths.map((strength, idx) => (
                        <li key={idx} className="text-sm text-green-200 flex gap-2">
                          <span className="text-green-500">✓</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Weaknesses */}
                {detailedEvaluation.weaknesses && detailedEvaluation.weaknesses.length > 0 && (
                  <div className="bg-red-900/20 rounded-lg p-4 border border-red-700/50">
                    <h4 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4" />
                      Weaknesses ({detailedEvaluation.weaknesses.length})
                    </h4>
                    <ul className="space-y-2">
                      {detailedEvaluation.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="text-sm text-red-200 flex gap-2">
                          <span className="text-red-500">✗</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {detailedEvaluation.suggestions && detailedEvaluation.suggestions.length > 0 && (
                  <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700/50">
                    <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Suggestions ({detailedEvaluation.suggestions.length})
                    </h4>
                    <ul className="space-y-2">
                      {detailedEvaluation.suggestions.map((suggestion, idx) => (
                        <li key={idx} className="text-sm text-yellow-200 flex gap-2">
                          <span className="text-yellow-500">→</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evaluated At */}
                {detailedEvaluation.evaluated_at && (
                  <div className="text-xs text-gray-500 text-right">
                    Evaluated: {new Date(detailedEvaluation.evaluated_at).toLocaleString()}
                  </div>
                )}

                {/* Improve from Evaluation Button */}
                {(detailedEvaluation.weaknesses?.length > 0 || detailedEvaluation.suggestions?.length > 0) && (
                  <div className="pt-4 border-t border-gray-700">
                    <Button
                      onClick={() => {
                        // Build improvement message from weaknesses and suggestions
                        const weaknessText = detailedEvaluation.weaknesses?.length > 0
                          ? `## 개선이 필요한 약점:\n${detailedEvaluation.weaknesses.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\n`
                          : '';
                        const suggestionText = detailedEvaluation.suggestions?.length > 0
                          ? `## 개선 제안:\n${detailedEvaluation.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`
                          : '';
                        const improvementMessage = `LLM-as-Judge 평가 결과를 바탕으로 프롬프트를 개선해주세요.\n\n${weaknessText}${suggestionText}위 피드백을 반영하여 개선된 프롬프트를 제안해주세요.`;

                        // Set initial message for refiner
                        setRefinerInitialMessage(improvementMessage);
                        // Switch to refine tab
                        setActiveTab('refine');
                        // Close dialog
                        setEvaluationDialogOpen(false);
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      이 평가로 개선하기
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Refine 탭에서 AI가 자동으로 개선안을 제안합니다
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* No Evaluation Yet */}
            {!detailedEvaluation && !deepEvaluating && (
              <div className="text-center py-8 text-gray-400">
                <Zap className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p>No evaluation available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
