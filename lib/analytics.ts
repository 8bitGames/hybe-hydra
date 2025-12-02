/**
 * HYDRA Analytics Event Tracking
 *
 * This module provides UX event tracking for measuring:
 * - Navigation patterns
 * - Quick Create flow effectiveness
 * - User journey completion rates
 * - Feature discovery and usage
 */

// Event types for UX metrics
export type UXEventType =
  // Navigation events
  | 'nav.dropdown.open'
  | 'nav.dropdown.select'
  | 'nav.direct.click'
  | 'nav.breadcrumb.click'
  // Home page events
  | 'home.quickstart.click'
  | 'home.explore.click'
  | 'home.continue.click'
  | 'home.stats.click'
  // Quick Create flow events
  | 'quickcreate.start'
  | 'quickcreate.prompt.enter'
  | 'quickcreate.style.select'
  | 'quickcreate.generate.click'
  | 'quickcreate.success'
  | 'quickcreate.modal.shown'
  | 'quickcreate.save.campaign'
  | 'quickcreate.view.videos'
  | 'quickcreate.create.another'
  | 'quickcreate.abandon'
  // Campaign flow events
  | 'campaign.create'
  | 'campaign.select'
  | 'campaign.generate.start'
  | 'campaign.generate.complete'
  // Trend exploration events
  | 'trends.explore.click'
  | 'trends.search.submit'
  | 'trends.video.view'
  | 'trends.to.create'
  // General flow events
  | 'flow.start'
  | 'flow.complete'
  | 'flow.abandon'
  // Error events
  | 'error.api'
  | 'error.validation'
  | 'error.network';

// Event properties interface
export interface UXEventProperties {
  // Navigation
  menu?: string;
  item?: string;
  // Quick Create
  card?: string;
  campaign?: string;
  action?: string;
  prompt_length?: number;
  style?: string;
  generation_id?: string;
  mode?: 'new' | 'existing';
  // Flow metrics
  flow?: string;
  duration?: number;
  clicks?: number;
  step?: string;
  // Error
  error_type?: string;
  error_message?: string;
  // Generic
  [key: string]: string | number | boolean | undefined;
}

// Session tracking
let sessionStartTime: number | null = null;
let clickCount = 0;
let currentFlow: string | null = null;
let flowStartTime: number | null = null;

// Initialize session
export function initAnalyticsSession() {
  sessionStartTime = Date.now();
  clickCount = 0;
  currentFlow = null;
  flowStartTime = null;

  // Track page visibility changes
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && currentFlow) {
        trackEvent('flow.abandon', {
          flow: currentFlow,
          step: 'visibility_hidden',
          duration: flowStartTime ? Date.now() - flowStartTime : 0,
        });
      }
    });
  }
}

// Track click count globally
export function incrementClickCount() {
  clickCount++;
}

// Get current click count
export function getClickCount() {
  return clickCount;
}

// Reset click count (for new flow)
export function resetClickCount() {
  const previous = clickCount;
  clickCount = 0;
  return previous;
}

// Start tracking a flow
export function startFlow(flowName: string) {
  currentFlow = flowName;
  flowStartTime = Date.now();
  resetClickCount();

  trackEvent('flow.start', {
    flow: flowName,
  });
}

// Complete a flow
export function completeFlow(additionalProps?: UXEventProperties) {
  if (currentFlow && flowStartTime) {
    trackEvent('flow.complete', {
      flow: currentFlow,
      duration: Date.now() - flowStartTime,
      clicks: clickCount,
      ...additionalProps,
    });
  }

  currentFlow = null;
  flowStartTime = null;
  resetClickCount();
}

// Abandon a flow
export function abandonFlow(step: string, additionalProps?: UXEventProperties) {
  if (currentFlow && flowStartTime) {
    trackEvent('flow.abandon', {
      flow: currentFlow,
      step,
      duration: Date.now() - flowStartTime,
      clicks: clickCount,
      ...additionalProps,
    });
  }

  currentFlow = null;
  flowStartTime = null;
  resetClickCount();
}

/**
 * Track a UX event
 *
 * In production, this would send to:
 * - Google Analytics 4
 * - Mixpanel
 * - Custom analytics backend
 *
 * For now, it logs to console and stores locally for debugging
 */
export function trackEvent(event: UXEventType, properties?: UXEventProperties) {
  const timestamp = new Date().toISOString();
  const sessionDuration = sessionStartTime ? Date.now() - sessionStartTime : 0;

  const eventData = {
    event,
    properties: {
      ...properties,
      session_duration: sessionDuration,
      click_count: clickCount,
      current_flow: currentFlow,
    },
    timestamp,
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, properties);
  }

  // Store in localStorage for debugging
  if (typeof localStorage !== 'undefined') {
    try {
      const events = JSON.parse(localStorage.getItem('hydra_analytics') || '[]');
      events.push(eventData);
      // Keep only last 100 events
      if (events.length > 100) {
        events.shift();
      }
      localStorage.setItem('hydra_analytics', JSON.stringify(events));
    } catch (e) {
      // Ignore storage errors
    }
  }

  // In production, send to analytics service
  // sendToAnalyticsService(eventData);

  return eventData;
}

/**
 * Get stored analytics events (for debugging)
 */
export function getStoredEvents(): unknown[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('hydra_analytics') || '[]');
  } catch {
    return [];
  }
}

/**
 * Clear stored analytics events
 */
export function clearStoredEvents() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('hydra_analytics');
  }
}

/**
 * Track navigation event with automatic dropdown detection
 */
export function trackNavigation(
  type: 'dropdown.open' | 'dropdown.select' | 'direct.click',
  menu?: string,
  item?: string
) {
  incrementClickCount();
  trackEvent(`nav.${type}` as UXEventType, { menu, item });
}

/**
 * Track Quick Create flow events
 */
export const trackQuickCreate = {
  start: () => {
    startFlow('quick_create');
    trackEvent('quickcreate.start');
  },

  promptEnter: (length: number) => {
    trackEvent('quickcreate.prompt.enter', { prompt_length: length });
  },

  styleSelect: (style: string) => {
    trackEvent('quickcreate.style.select', { style });
  },

  generateClick: () => {
    incrementClickCount();
    trackEvent('quickcreate.generate.click');
  },

  success: (generationId: string) => {
    trackEvent('quickcreate.success', { generation_id: generationId });
    trackEvent('quickcreate.modal.shown');
  },

  saveToCampaign: (mode: 'new' | 'existing', campaignId?: string) => {
    trackEvent('quickcreate.save.campaign', { mode, campaign: campaignId });
    completeFlow({ action: 'save_to_campaign' });
  },

  viewVideos: () => {
    trackEvent('quickcreate.view.videos');
    completeFlow({ action: 'view_videos' });
  },

  createAnother: () => {
    trackEvent('quickcreate.create.another');
    // Don't complete flow, user is continuing
  },

  abandon: (step: string) => {
    trackEvent('quickcreate.abandon', { step });
    abandonFlow(step);
  },
};

/**
 * Track Home page interactions
 */
export const trackHome = {
  quickStartClick: (card: string) => {
    incrementClickCount();
    trackEvent('home.quickstart.click', { card });
  },

  exploreClick: (card: string) => {
    incrementClickCount();
    trackEvent('home.explore.click', { card });
  },

  continueClick: (campaign: string, action: string) => {
    incrementClickCount();
    trackEvent('home.continue.click', { campaign, action });
  },

  statsClick: () => {
    incrementClickCount();
    trackEvent('home.stats.click');
  },
};

/**
 * Track Trend exploration
 */
export const trackTrends = {
  explore: () => {
    startFlow('trend_exploration');
    trackEvent('trends.explore.click');
  },

  search: (query: string) => {
    trackEvent('trends.search.submit', { query });
  },

  viewVideo: (videoId: string) => {
    trackEvent('trends.video.view', { video_id: videoId });
  },

  toCreate: (fromTrend: string) => {
    trackEvent('trends.to.create', { from_trend: fromTrend });
    completeFlow({ action: 'to_create' });
  },
};

/**
 * Analytics dashboard data aggregation
 */
export function getAnalyticsSummary() {
  const events = getStoredEvents() as Array<{
    event: string;
    properties?: UXEventProperties;
    timestamp: string;
  }>;

  const summary = {
    total_events: events.length,
    quick_create: {
      starts: 0,
      completions: 0,
      abandons: 0,
      avg_clicks: 0,
      avg_duration: 0,
    },
    navigation: {
      dropdown_opens: 0,
      dropdown_selects: 0,
      direct_clicks: 0,
    },
    flows: {
      started: 0,
      completed: 0,
      abandoned: 0,
    },
  };

  const flowDurations: number[] = [];
  const flowClicks: number[] = [];

  events.forEach(event => {
    // Quick Create
    if (event.event === 'quickcreate.start') summary.quick_create.starts++;
    if (event.event === 'quickcreate.success') summary.quick_create.completions++;
    if (event.event === 'quickcreate.abandon') summary.quick_create.abandons++;

    // Navigation
    if (event.event === 'nav.dropdown.open') summary.navigation.dropdown_opens++;
    if (event.event === 'nav.dropdown.select') summary.navigation.dropdown_selects++;
    if (event.event === 'nav.direct.click') summary.navigation.direct_clicks++;

    // Flows
    if (event.event === 'flow.start') summary.flows.started++;
    if (event.event === 'flow.complete') {
      summary.flows.completed++;
      if (event.properties?.duration) flowDurations.push(event.properties.duration);
      if (event.properties?.clicks) flowClicks.push(event.properties.clicks);
    }
    if (event.event === 'flow.abandon') summary.flows.abandoned++;
  });

  // Calculate averages
  if (flowDurations.length > 0) {
    summary.quick_create.avg_duration =
      flowDurations.reduce((a, b) => a + b, 0) / flowDurations.length;
  }
  if (flowClicks.length > 0) {
    summary.quick_create.avg_clicks =
      flowClicks.reduce((a, b) => a + b, 0) / flowClicks.length;
  }

  return summary;
}

// Auto-initialize on import
if (typeof window !== 'undefined') {
  initAnalyticsSession();
}
