import { toast } from "sonner";

/** Surface an API/network error as a toast instead of dropping it silently. */
export function reportError(err, fallbackMessage = "Something went wrong. Please try again.") {
  const message = err?.response?.data?.detail || err?.message || fallbackMessage;
  toast.error(message);
}
