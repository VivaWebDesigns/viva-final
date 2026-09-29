import { useState } from "react";

// Returns a key that changes each time `open` becomes true. Keying a dialog's
// content with it gives every opening fresh state without a reset effect.
export function useOpenSessionKey(open: boolean) {
  const [session, setSession] = useState({ open, key: 0 });
  if (session.open !== open) {
    setSession({ open, key: open ? session.key + 1 : session.key });
  }
  return session.key;
}
