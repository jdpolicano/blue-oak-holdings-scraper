export interface ScrapingError {
  /** Site that experienced the error */
  site: string;
  /** URL that was being scraped when error occurred */
  url: string;
  /** Best guess at the cause of the error */
  errorType: ScrapingErrorType;
  /** Human-readable error description */
  description: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Raw error object for logging purposes */
  rawError: Error;
}

export const enum ScrapingErrorType {
  /** Site structure has changed (selectors not found, DOM changes) */
  SiteStructureChanged = 'SITE_STRUCTURE_CHANGED',
  /** Authentication failure (blocked, login required) */
  AuthenticationFailure = 'AUTHENTICATION_FAILURE',
  /** Site is completely down or unreachable */
  SiteDown = 'SITE_DOWN',
  /** Anti-bot detection that cannot be bypassed */
  AntiBotDetected = 'ANTI_BOT_DETECTED',
  /** API endpoint changed or removed */
  ApiEndpointChanged = 'API_ENDPOINT_CHANGED',
  /** Configuration error (invalid credentials, wrong domain) */
  ConfigurationError = 'CONFIGURATION_ERROR',
  /** Network/timeout issues (may be temporary) */
  NetworkError = 'NETWORK_ERROR',
  /** Rate limiting (may be temporary) */
  RateLimitError = 'RATE_LIMIT_ERROR',
  /** SSL/TLS certificate issues (may be temporary) */
  SSLError = 'SSL_ERROR',
  /** Unknown or miscellaneous error */
  Unknown = 'UNKNOWN',
}

/**
 * Analyzes errors to determine their likely cause and creates structured error reports
 */
export class ErrorClassifier {
  /**
   * Determines the most likely cause of an error
   */
  static classifyError(error: Error, site: string, url: string): ScrapingErrorType {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    // Site structure changes
    if (/selector.*not found|element.*not found|no element matching|timeout.*waiting for selector/i.test(errorMessage) ||
        (error.name === 'TypeError' && errorMessage.includes('cannot read property')) ||
        (error.name === 'ReferenceError' && errorMessage.includes('is not defined'))) {
      return ScrapingErrorType.SiteStructureChanged;
    }

    // Authentication failures
    if (/401|unauthorized|forbidden|access denied|blocked|banned|captcha|challenge.*required|verification.*required/i.test(errorMessage)) {
      return ScrapingErrorType.AuthenticationFailure;
    }

    // Site down
    if (/connection refused|econnrefused|host.*not found|name resolution failed|503|502|service unavailable|bad gateway/i.test(errorMessage)) {
      return ScrapingErrorType.SiteDown;
    }

    // Anti-bot detection
    if (/cloudflare.*challenge|cloudflare.*block|cf-ray|access.*denied.*bot|bot.*detected|automated.*access/i.test(errorMessage)) {
      return ScrapingErrorType.AntiBotDetected;
    }

    // API issues
    if (/404|not found.*api|endpoint.*not found|api.*changed|invalid.*response.*format|response.*format.*changed/i.test(errorMessage)) {
      return ScrapingErrorType.ApiEndpointChanged;
    }

    // Configuration issues
    if (/invalid.*credentials|authentication.*failed|login.*failed|domain.*not.*allowed|origin.*not.*allowed/i.test(errorMessage)) {
      return ScrapingErrorType.ConfigurationError;
    }

    // Rate limiting (may be temporary)
    if (/rate limit|too many requests|429/i.test(errorMessage)) {
      return ScrapingErrorType.RateLimitError;
    }

    // Network timeouts (may be temporary)
    if (errorMessage.includes('timeout') && !errorMessage.includes('selector')) {
      return ScrapingErrorType.NetworkError;
    }

    // SSL/TLS issues (may be temporary)
    if (/ssl|certificate|tls/i.test(errorMessage)) {
      return ScrapingErrorType.SSLError;
    }

    // Fallback to unknown
    return ScrapingErrorType.Unknown;
  }

  /**
   * Creates a ScrapingError object from raw error data
   * Always creates an error - no filtering at this level
   */
  static createScrapingError(
    error: Error, 
    site: string, 
    url: string
  ): ScrapingError {
    return {
      site,
      url,
      errorType: this.classifyError(error, site, url),
      description: this.createErrorDescription(error),
      timestamp: new Date().toISOString(),
      rawError: error,
    };
  }

  /**
   * Creates a human-readable description for the error
   */
  private static createErrorDescription(error: Error): string {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('selector') || errorMessage.includes('element')) {
      return `Site structure has changed - expected elements not found`;
    }
    
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return `Authentication failed - access denied`;
    }
    
    if (errorMessage.includes('cloudflare') || errorMessage.includes('challenge')) {
      return `Anti-bot protection triggered - manual intervention may be required`;
    }
    
    if (errorMessage.includes('connection refused') || errorMessage.includes('host')) {
      return `Site is down or unreachable`;
    }
    
    if (errorMessage.includes('api') || errorMessage.includes('endpoint')) {
      return `API endpoint has changed or been removed`;
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return `Rate limit exceeded - may resolve automatically`;
    }
    
    if (errorMessage.includes('timeout')) {
      return `Network timeout - may be temporary`;
    }
    
    if (errorMessage.includes('ssl') || errorMessage.includes('certificate')) {
      return `SSL/TLS certificate issue - may be temporary`;
    }
    
    return `Error occurred: ${error.message}`;
  }
}