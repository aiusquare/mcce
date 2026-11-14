const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v1/inline.js";

type PaystackResponse = {
  reference: string;
  trans?: string;
  status?: string;
  message?: string;
};

type PaystackOptions = {
  email: string;
  amount: number;
  reference: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

type PaystackPopInstance = {
  openIframe: () => void;
};

type PaystackPopGlobal = {
  setup: (options: {
    key: string;
    email: string;
    amount: number;
    currency: string;
    ref: string;
    label?: string;
    metadata?: Record<string, unknown>;
    callback: (response: PaystackResponse) => void;
    onClose: () => void;
  }) => PaystackPopInstance;
};

declare global {
  interface Window {
    PaystackPop?: PaystackPopGlobal;
  }
}

let paystackScriptPromise: Promise<void> | null = null;

function loadPaystackScript() {
  if (window.PaystackPop) {
    return Promise.resolve();
  }

  if (paystackScriptPromise) {
    return paystackScriptPromise;
  }

  paystackScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYSTACK_SCRIPT_URL}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Paystack")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PAYSTACK_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Paystack"));
    document.body.appendChild(script);
  });

  return paystackScriptPromise;
}

export async function initializePaystackPayment({
  email,
  amount,
  reference,
  label,
  metadata,
}: PaystackOptions) {
  const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (!key) {
    throw new Error("Paystack public key is not configured");
  }
  if (!email) {
    throw new Error("Email is required for Paystack payment");
  }

  await loadPaystackScript();

  if (!window.PaystackPop) {
    throw new Error("Paystack is not available");
  }

  return new Promise<PaystackResponse>((resolve, reject) => {
    const paystack = window.PaystackPop!.setup({
      key,
      email,
      amount: Math.round(amount * 100),
      currency: "NGN",
      ref: reference,
      label,
      metadata,
      callback: (response) => resolve(response),
      onClose: () => reject(new Error("Payment was cancelled")),
    });

    paystack.openIframe();
  });
}

export function buildPaymentReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}
