// Playwright prepends locator.evaluate to errors thrown inside the page.
// Keep the actionable code, not the wrapper or a private stack trace.
export function errorCode(error) {
  const message=String(error?.message || error || 'UNKNOWN_ERROR');
  return message.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/)?.[0] || message.split(':')[0].slice(0,100);
}
