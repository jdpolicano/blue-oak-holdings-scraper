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
  /** S3 key for an error screenshot, when captured */
  screenshotKey?: string;
  /** Presigned URL for an error screenshot, when captured */
  screenshotUrl?: string;
  /** Timestamp when the screenshot was captured */
  screenshotCapturedAt?: string;
}

export const enum ScrapingErrorType {
  /** Site structure has changed (selectors not found, DOM changes) */
  SiteStructureChanged = "SITE_STRUCTURE_CHANGED",
  /** Playwright could not find or interact with an expected DOM element */
  SelectorError = "SELECTOR_ERROR",
  /** Playwright navigation failed or timed out */
  NavigationError = "NAVIGATION_ERROR",
  /** Playwright waited for a response/API call that never arrived */
  ResponseWaitError = "RESPONSE_WAIT_ERROR",
  /** Browser, page, or context lifecycle failure */
  BrowserError = "BROWSER_ERROR",
  /** Authentication failure (blocked, login required) */
  AuthenticationFailure = "AUTHENTICATION_FAILURE",
  /** Site is completely down or unreachable */
  SiteDown = "SITE_DOWN",
  /** Anti-bot detection that cannot be bypassed */
  AntiBotDetected = "ANTI_BOT_DETECTED",
  /** API endpoint changed or removed */
  ApiEndpointChanged = "API_ENDPOINT_CHANGED",
  /** Configuration error (invalid credentials, wrong domain) */
  ConfigurationError = "CONFIGURATION_ERROR",
  /** Network/timeout issues (may be temporary) */
  NetworkError = "NETWORK_ERROR",
  /** Rate limiting (may be temporary) */
  RateLimitError = "RATE_LIMIT_ERROR",
  /** SSL/TLS certificate issues (may be temporary) */
  SSLError = "SSL_ERROR",
  /** Unknown or miscellaneous error */
  Unknown = "UNKNOWN",
}

interface ErrorClassification {
  type: ScrapingErrorType;
  description: string;
}

interface ErrorRule extends ErrorClassification {
  patterns: RegExp[];
}

const ERROR_RULES: ErrorRule[] = [
  {
    type: ScrapingErrorType.AntiBotDetected,
    description: "Anti-bot protection triggered - manual intervention may be required",
    patterns: [
      /cloudflare.*challenge/,
      /cloudflare.*block/,
      /cf-ray/,
      /access.*denied.*bot/,
      /bot.*detected/,
      /automated.*access/,
    ],
  },
  {
    type: ScrapingErrorType.AuthenticationFailure,
    description: "Authentication failed or access was denied",
    patterns: [
      /401/,
      /unauthorized/,
      /forbidden/,
      /access denied/,
      /blocked/,
      /banned/,
      /captcha/,
      /challenge.*required/,
      /verification.*required/,
    ],
  },
  {
    type: ScrapingErrorType.RateLimitError,
    description: "Rate limit exceeded - may resolve automatically",
    patterns: [/rate limit/, /too many requests/, /429/],
  },
  {
    type: ScrapingErrorType.SSLError,
    description: "SSL/TLS certificate issue - may be temporary",
    patterns: [/ssl/, /certificate/, /tls/, /net::err_cert/],
  },
  {
    type: ScrapingErrorType.BrowserError,
    description: "Browser/page lifecycle error - check browser stability and resource limits",
    patterns: [
      /target page.*closed/,
      /target context.*closed/,
      /target browser.*closed/,
      /browser has been closed/,
      /page is closed/,
      /context was destroyed/,
    ],
  },
  {
    type: ScrapingErrorType.SelectorError,
    description: "Expected page element was missing or not actionable - check selectors",
    patterns: [
      /locator\.[a-z]+: timeout \d+ms exceeded/,
      /waiting for locator/,
      /selector.*not found/,
      /element.*not found/,
      /no element matching/,
      /timeout.*waiting for selector/,
      /strict mode violation/,
      /element is not attached/,
      /element is not visible/,
      /element is outside of the viewport/,
      /intercepts pointer events/,
      /waiting for.*to be visible/,
      /waiting for.*to be attached/,
    ],
  },
  {
    type: ScrapingErrorType.ResponseWaitError,
    description: "Expected network response was not observed - check endpoint or request trigger",
    patterns: [
      /page\.waitforresponse: timeout \d+ms exceeded/,
      /waitforresponse.*timeout/,
      /waiting for response/,
      /response.*format.*changed/,
      /invalid.*response.*format/,
    ],
  },
  {
    type: ScrapingErrorType.NavigationError,
    description: "Page navigation failed or timed out - check site availability",
    patterns: [
      /page\.goto: timeout \d+ms exceeded/,
      /page\.waitforloadstate: timeout \d+ms exceeded/,
      /waitforloadstate.*timeout/,
      /navigation timeout/,
      /waiting until .*domcontentloaded/,
      /waiting until .*networkidle/,
      /net::err_aborted/,
      /net::err_failed/,
    ],
  },
  {
    type: ScrapingErrorType.SiteDown,
    description: "Site is down or unreachable",
    patterns: [
      /connection refused/,
      /econnrefused/,
      /host.*not found/,
      /name resolution failed/,
      /net::err_name_not_resolved/,
      /net::err_connection/,
      /503/,
      /502/,
      /service unavailable/,
      /bad gateway/,
    ],
  },
  {
    type: ScrapingErrorType.ApiEndpointChanged,
    description: "API endpoint has changed or been removed",
    patterns: [/404/, /not found.*api/, /endpoint.*not found/, /api.*changed/],
  },
  {
    type: ScrapingErrorType.ConfigurationError,
    description: "Configuration error - verify credentials, domain, or launch settings",
    patterns: [
      /invalid.*credentials/,
      /authentication.*failed/,
      /login.*failed/,
      /domain.*not.*allowed/,
      /origin.*not.*allowed/,
      /executable doesn't exist/,
      /browser executable/,
    ],
  },
  {
    type: ScrapingErrorType.SiteStructureChanged,
    description: "Site structure has changed - expected data could not be parsed",
    patterns: [
      /id not found/,
      /id format not recognized/,
      /title is required/,
      /cannot read propert/,
      /is not defined/,
    ],
  },
  {
    type: ScrapingErrorType.NetworkError,
    description: "Network timeout or transient connection issue",
    patterns: [/timeout/, /socket hang up/, /econnreset/, /fetch failed/],
  },
];

/**
 * Analyzes errors to determine their likely cause and creates structured error reports
 */
export class ErrorClassifier {
  /**
   * Determines the most likely cause of an error
   */
  static classifyError(
    error: Error,
    site: string,
    url: string,
  ): ScrapingErrorType {
    return this.classify(error).type;
  }

  /**
   * Creates a ScrapingError object from raw error data
   * Always creates an error - no filtering at this level
   */
  static createScrapingError(
    error: Error,
    site: string,
    url: string,
  ): ScrapingError {
    const classification = this.classify(error);

    return {
      site,
      url,
      errorType: classification.type,
      description: classification.description,
      timestamp: new Date().toISOString(),
      rawError: error,
    };
  }

  private static classify(error: Error): ErrorClassification {
    const searchableText = [
      error.name,
      error.message,
      error.stack ?? "",
    ].join("\n").toLowerCase();

    const rule = ERROR_RULES.find((candidate) =>
      candidate.patterns.some((pattern) => pattern.test(searchableText)),
    );

    return (
      rule ?? {
        type: ScrapingErrorType.Unknown,
        description: `Error occurred: ${error.message}`,
      }
    );
  }
}
