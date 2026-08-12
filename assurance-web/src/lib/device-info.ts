const DEVICE_ID_KEY = "assurance-device-id";
let fallbackDeviceId: string | null = null;

export function deviceRequestHeaders(): Record<string, string> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }

  return {
    "X-Device-Id": getOrCreateDeviceId(),
    "X-Device-Name": deviceName(navigator.userAgent),
    "X-Client-Type": deviceType(navigator.userAgent),
  };
}

function getOrCreateDeviceId() {
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const id = newDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    fallbackDeviceId ??= newDeviceId();
    return fallbackDeviceId;
  }
}

function newDeviceId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function deviceName(userAgent: string) {
  const browser = browserName(userAgent);
  const operatingSystem = operatingSystemName(userAgent);
  return operatingSystem ? `${browser} sur ${operatingSystem}` : browser;
}

function browserName(userAgent: string) {
  if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//i.test(userAgent)) return "Opera";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/CriOS\//i.test(userAgent)) return "Chrome";
  if (/Chrome\//i.test(userAgent)) return "Chrome";
  if (/Safari\//i.test(userAgent)) return "Safari";
  return "Navigateur web";
}

function operatingSystemName(userAgent: string) {
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "";
}

function deviceType(userAgent: string) {
  if (/iPad|Tablet/i.test(userAgent)) return "TABLET";
  if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) return "MOBILE";
  return "DESKTOP";
}
