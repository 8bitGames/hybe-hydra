'use client';

/**
 * Prompt Refiner Chat Component
 * =============================
 * Interactive chat interface for iteratively improving AI agent prompts
 * through conversation with an LLM prompt engineering expert.
 *
 * Features:
 * - Multi-turn conversation with AI prompt engineer
 * - Session persistence (save/load chat history)
 * - Apply improvements directly to prompts
 * - Test prompts with sample inputs
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Send,
  Sparkles,
  TestTube,
  Zap,
  Copy,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileCode,
  MessageSquare,
  X,
  ArrowRight,
  Save,
  FolderOpen,
  Star,
  StarOff,
  History,
  Trash2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  improvedPrompts?: {
    systemPrompt?: string;
    templates?: Record<string, string>;
  } | null;
}

interface Session {
  id: string;
  agentId: string;
  title: string | null;
  messageCount: number;
  improvementsCount: number;
  isFavorite: boolean;
  tags: string[];
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetail extends Session {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
  initialPrompt: {
    systemPrompt: string;
    templates: Record<string, string>;
    name: string;
    description?: string;
  };
  appliedImprovements?: Array<{
    systemPrompt?: string;
    templates?: Record<string, string>;
    appliedAt: string;
  }>;
}

interface PromptRefinerChatProps {
  agentId: string;
  currentPrompt: {
    systemPrompt: string;
    templates: Record<string, string>;
    name: string;
    description?: string;
  };
  onApplyImprovement?: (improvement: {
    systemPrompt?: string;
    templates?: Record<string, string>;
  }) => void;
}

// Sample test inputs for different agent types
const SAMPLE_TEST_INPUTS: Record<string, object> = {
  'vision-analyzer': {
    imageDescription: "A short-form video showing a person doing a dance challenge",
    platform: "tiktok",
  },
  'keyword-insights': {
    keywords: ["viral", "trending", "dance"],
    platform: "tiktok",
    language: "ko",
  },
  'script-writer': {
    topic: "신제품 립스틱 홍보",
    duration: 30,
    style: "casual",
  },
  'default': {
    input: "샘플 입력 데이터",
    context: "테스트 컨텍스트",
  },
};

export function PromptRefinerChat({
  agentId,
  currentPrompt,
  onApplyImprovement,
}: PromptRefinerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedCodeBlock, setSelectedCodeBlock] = useState<string>('');

  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSessionsDropdown, setShowSessionsDropdown] = useState(false);
  const [appliedImprovements, setAppliedImprovements] = useState<Array<{
    systemPrompt?: string;
    templates?: Record<string, string>;
    appliedAt: string;
  }>>([]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Initialize test input with sample data
  useEffect(() => {
    const sampleKey = Object.keys(SAMPLE_TEST_INPUTS).find(key =>
      agentId.toLowerCase().includes(key.replace('-', ''))
    ) || 'default';
    setTestInput(JSON.stringify(SAMPLE_TEST_INPUTS[sampleKey], null, 2));
  }, [agentId]);

  // Load sessions for this agent
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`/api/v1/admin/prompts/sessions?agentId=${agentId}&limit=10`);
      const data = await response.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Save current session
  const saveSession = async () => {
    if (messages.length === 0) return;

    setIsSaving(true);
    try {
      const sessionMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));

      if (currentSessionId) {
        // Update existing session
        await fetch(`/api/v1/admin/prompts/sessions/${currentSessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: sessionMessages,
            appliedImprovements,
          }),
        });
      } else {
        // Create new session
        const response = await fetch('/api/v1/admin/prompts/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            messages: sessionMessages,
            initialPrompt: currentPrompt,
          }),
        });
        const data = await response.json();
        setCurrentSessionId(data.id);
      }

      // Reload sessions list
      loadSessions();
    } catch (error) {
      console.error('Failed to save session:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Load a session
  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/v1/admin/prompts/sessions/${sessionId}`);
      const data: SessionDetail = await response.json();

      if (data.messages) {
        const loadedMessages: ChatMessage[] = data.messages.map((m, index) => ({
          id: `loaded-${index}-${Date.now()}`,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        setMessages(loadedMessages);
        setCurrentSessionId(sessionId);
        setAppliedImprovements(data.appliedImprovements || []);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (sessionId: string, currentFavorite: boolean) => {
    try {
      await fetch(`/api/v1/admin/prompts/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentFavorite }),
      });
      loadSessions();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Delete session
  const deleteSession = async (sessionId: string) => {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/v1/admin/prompts/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const sendMessage = useCallback(async (
    action: 'chat' | 'analyze' | 'improve' | 'test',
    customMessage?: string,
    testInputData?: Record<string, unknown>
  ) => {
    const messageContent = customMessage || input;
    if (!messageContent.trim() && action === 'chat') return;

    setIsLoading(true);
    setInput('');

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: action === 'analyze' ? '프롬프트를 분석해줘' :
               action === 'improve' ? '개선된 버전을 만들어줘' :
               action === 'test' ? `테스트 입력으로 확인해줘:\n${JSON.stringify(testInputData, null, 2)}` :
               messageContent,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`/api/v1/admin/prompts/${agentId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          message: messageContent,
          history,
          currentPrompt,
          testInput: testInputData,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        improvedPrompts: data.improvedPrompts,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, currentPrompt, input, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage('chat');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setCurrentSessionId(null);
    setAppliedImprovements([]);
  };

  const handleTestSubmit = () => {
    try {
      const parsed = JSON.parse(testInput);
      sendMessage('test', undefined, parsed);
      setShowTestModal(false);
    } catch {
      alert('올바른 JSON 형식이 아닙니다.');
    }
  };

  const handleApplyCodeBlock = (code: string) => {
    setSelectedCodeBlock(code);
    setShowApplyModal(true);
  };

  const confirmApplyImprovement = () => {
    if (onApplyImprovement && selectedCodeBlock) {
      onApplyImprovement({ systemPrompt: selectedCodeBlock });
      setAppliedImprovements(prev => [...prev, {
        systemPrompt: selectedCodeBlock,
        appliedAt: new Date().toISOString(),
      }]);
      setShowApplyModal(false);
      setSelectedCodeBlock('');
    }
  };

  const renderMarkdown = (content: string, messageId: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
        if (match) {
          const [, lang, code] = match;
          const isLikelyPrompt = code.length > 100 && (
            code.includes('You are') ||
            code.includes('당신은') ||
            code.includes('##') ||
            code.includes('역할') ||
            code.includes('role') ||
            code.includes('instruction')
          );

          return (
            <div key={index} className="my-2 relative group">
              <div className="flex items-center justify-between bg-gray-900 px-3 py-1 rounded-t border border-gray-700 border-b-0">
                <span className="text-xs text-gray-400">{lang || 'code'}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-gray-400 hover:text-white"
                    onClick={() => copyToClipboard(code.trim(), `code-${messageId}-${index}`)}
                  >
                    {copiedId === `code-${messageId}-${index}` ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                  {isLikelyPrompt && onApplyImprovement && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-green-400 hover:text-green-300 hover:bg-green-900/30"
                      onClick={() => handleApplyCodeBlock(code.trim())}
                    >
                      <ArrowRight className="w-3 h-3 mr-1" />
                      적용
                    </Button>
                  )}
                </div>
              </div>
              <pre className="bg-gray-900 p-3 rounded-b border border-gray-700 border-t-0 overflow-x-auto max-h-[300px]">
                <code className="text-sm text-gray-300 whitespace-pre-wrap">{code.trim()}</code>
              </pre>
            </div>
          );
        }
      }

      return (
        <span
          key={index}
          className="whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: part
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
              .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-1">$1</h3>')
              .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
              .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
              .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
              .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
          }}
        />
      );
    });
  };

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-white">Prompt Refinement Chat</span>
            <Badge variant="outline" className="text-xs border-purple-500 text-purple-400">
              AI Assistant
            </Badge>
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                {messages.length} messages
              </Badge>
            )}
            {currentSessionId && (
              <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                저장됨
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400 ml-2" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
            )}
          </button>

          {/* Session Actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu open={showSessionsDropdown} onOpenChange={setShowSessionsDropdown}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                >
                  <History className="w-4 h-4 mr-1" />
                  세션
                  {sessions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs bg-gray-600">
                      {sessions.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-gray-900 border-gray-700">
                {isLoadingSessions ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    로딩 중...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    저장된 세션이 없습니다
                  </div>
                ) : (
                  sessions.map((session) => (
                    <DropdownMenuItem
                      key={session.id}
                      className="flex items-start gap-2 p-2 cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
                      onClick={() => loadSession(session.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white truncate text-sm">
                            {session.title || '제목 없음'}
                          </span>
                          {session.isFavorite && (
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          <span>{session.messageCount} messages</span>
                          {session.improvementsCount > 0 && (
                            <Badge variant="outline" className="text-xs border-green-600 text-green-400 px-1 py-0">
                              {session.improvementsCount} applied
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(session.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-yellow-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(session.id, session.isFavorite);
                          }}
                        >
                          {session.isFavorite ? (
                            <Star className="w-3 h-3 fill-current" />
                          ) : (
                            <StarOff className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem
                  className="text-purple-400 cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
                  onClick={() => loadSessions()}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  새로고침
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={saveSession}
              disabled={messages.length === 0 || isSaving}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              저장
            </Button>
          </div>
        </div>

        {isExpanded && (
          <>
            {/* Quick Actions */}
            <div className="px-4 py-3 flex gap-2 flex-wrap border-b border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendMessage('analyze')}
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <Sparkles className="w-4 h-4 mr-1" />
                분석하기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendMessage('improve')}
                disabled={isLoading}
                className="bg-purple-600 border-purple-500 text-white hover:bg-purple-700"
              >
                <Zap className="w-4 h-4 mr-1" />
                개선하기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestModal(true)}
                disabled={isLoading}
                className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
              >
                <TestTube className="w-4 h-4 mr-1" />
                테스트
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetChat}
                  className="text-gray-400 hover:text-white ml-auto"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  초기화
                </Button>
              )}
            </div>

            {/* Chat Messages */}
            <ScrollArea ref={scrollAreaRef} className="h-[400px]">
              <div className="p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                    <p className="font-medium text-white">프롬프트에 대해 대화를 시작하세요.</p>
                    <p className="text-sm mt-1 text-gray-300">
                      위의 버튼을 클릭하거나 직접 질문을 입력하세요.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-900/50 border-purple-500 text-purple-300"
                        onClick={() => setInput('이 프롬프트의 강점과 약점을 분석해줘')}
                      >
                        강점/약점 분석
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-900/50 border-purple-500 text-purple-300"
                        onClick={() => setInput('출력 형식을 더 구조화해줘')}
                      >
                        출력 구조화
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-900/50 border-purple-500 text-purple-300"
                        onClick={() => setInput('한국어 응답 품질을 개선해줘')}
                      >
                        한국어 품질 개선
                      </Badge>
                    </div>

                    {/* Quick Load Recent Session */}
                    {sessions.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-2">최근 세션 불러오기</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {sessions.slice(0, 3).map((session) => (
                            <Badge
                              key={session.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-gray-800 border-gray-600 text-gray-300"
                              onClick={() => loadSession(session.id)}
                            >
                              <FolderOpen className="w-3 h-3 mr-1" />
                              {session.title?.substring(0, 20) || '제목 없음'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-200'
                      }`}
                    >
                      <div className="text-sm">
                        {message.role === 'assistant' ? (
                          renderMarkdown(message.content, message.id)
                        ) : (
                          <span className="whitespace-pre-wrap">{message.content}</span>
                        )}
                      </div>

                      {/* Apply Improvement Button - Auto-detected */}
                      {message.improvedPrompts && onApplyImprovement && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <Button
                            size="sm"
                            onClick={() => onApplyImprovement(message.improvedPrompts!)}
                            className="bg-green-600 hover:bg-green-700 text-white w-full"
                          >
                            <FileCode className="w-4 h-4 mr-1" />
                            개선안 적용하기
                          </Button>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="프롬프트에 대해 질문하거나 개선 요청을 입력하세요..."
                  className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none min-h-[44px] max-h-[120px]"
                  rows={1}
                />
                <Button
                  onClick={() => sendMessage('chat')}
                  disabled={isLoading || !input.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enter로 전송, Shift+Enter로 줄바꿈
              </p>
            </div>
          </>
        )}
      </div>

      {/* Test Input Modal */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5 text-purple-400" />
              프롬프트 테스트
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              테스트할 입력 데이터를 JSON 형식으로 입력하세요.
              AI가 현재 프롬프트로 이 입력을 처리하면 어떤 결과가 나올지 분석합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Sample Data Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400">샘플:</span>
              {Object.entries(SAMPLE_TEST_INPUTS).map(([key, value]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-800 border-gray-600"
                  onClick={() => setTestInput(JSON.stringify(value, null, 2))}
                >
                  {key}
                </Badge>
              ))}
            </div>

            <Textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder='{"input": "테스트 입력"}'
              className="bg-gray-800 border-gray-700 text-white font-mono text-sm min-h-[200px]"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestModal(false)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
            <Button
              onClick={handleTestSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <TestTube className="w-4 h-4 mr-1" />
              테스트 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Code Block Confirmation Modal */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-green-400" />
              개선안 적용 확인
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              이 코드 블록을 시스템 프롬프트로 적용하시겠습니까?
              적용 후 &quot;Save&quot; 버튼을 클릭해야 실제로 저장됩니다.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <pre className="bg-gray-800 p-4 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
              {selectedCodeBlock}
            </pre>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApplyModal(false)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
            <Button
              onClick={confirmApplyImprovement}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-4 h-4 mr-1" />
              적용하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
