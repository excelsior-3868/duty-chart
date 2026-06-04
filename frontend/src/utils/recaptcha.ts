/**
 * Google reCAPTCHA v3 utility.
 *
 * Dynamically loads the reCAPTCHA script on first use (reads the site key from
 * VITE_RECAPTCHA_SITE_KEY). Returns null when the key is not configured so that
 * local development works without a reCAPTCHA setup.
 *
 * Usage:
 *   import { executeRecaptcha } from "@/utils/recaptcha";
 *   const token = await executeRecaptcha("login");
 *   // pass token as recaptcha_token in the POST body
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

let _scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!SITE_KEY) return Promise.resolve();
  if (_scriptLoading) return _scriptLoading;

  _scriptLoading = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src*="recaptcha"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
    document.head.appendChild(script);
  });

  return _scriptLoading;
}

/**
 * Execute reCAPTCHA v3 and return the token to include as `recaptcha_token`
 * in the request body. Returns null if reCAPTCHA is not configured (dev mode).
 *
 * @param action  Short string describing the action: "login" | "otp_request" | "signup"
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;

  try {
    await loadScript();
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(SITE_KEY, { action }).then(resolve).catch(reject);
      });
    });
  } catch {
    return null;
  }
}
