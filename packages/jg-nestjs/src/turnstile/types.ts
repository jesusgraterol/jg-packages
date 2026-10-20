// what TurnstileGuard takes, through TURNSTILE_GUARD_OPTIONS
export type ITurnstileGuardOptions = {
  // the widget's secret key, from Cloudflare's dashboard
  secretKey: string;

  // the hostnames the challenge may be solved on, such as `'app.example.com'`. A verification from
  // any other, or without one, is refused
  allowedHostnames: readonly string[];
};

// the fields of siteverify's answer the guard reads
export type ISiteverifyResponse = {
  // whether the token is valid
  success: boolean;

  // why it isn't, such as `'timeout-or-duplicate'`
  errorCodes: string[];

  // the hostname the challenge was solved on
  hostname: string | undefined;

  // the action the widget was rendered with
  action: string | undefined;
};
