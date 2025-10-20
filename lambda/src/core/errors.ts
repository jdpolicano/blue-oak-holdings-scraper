export const enum PageErrorCode {
  PageContainerMissing = "ERR_PAGE_CONTAINER",
  PageTitleError = "ERR_NO_TITLE",
  PageHrefError = "ERR_NOHREF",
  PageRepeatEntry = "ERR_REPEAT",
}

/**
 * Custom Error for page operations
 */
export class PageError extends Error {
  code: PageErrorCode;
  constructor(message: string, code: PageErrorCode, opts?: ErrorOptions) {
    super(message, opts);
    this.name = "PageError";
    this.code = code;
  }
}
