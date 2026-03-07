import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { authFetch } from "../../utils/apiClient";
import { getApiBaseUrl } from "../../utils/apiBaseUrl";
import { isDevAuthBypassEnabled } from "../../utils/devAuthBypass";

const API_BASE = getApiBaseUrl();

export function useAdminApi() {
  const { getToken } = useAuth();
  const devBypass = isDevAuthBypassEnabled();

  const requestJson = useCallback(
    async (path, options = {}) => {
      const token = await getToken().catch(() => null);
      if (!token && !devBypass) {
        throw new Error("Authentication required.");
      }
      const resp = await authFetch(`${API_BASE}${path}`, token, options);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(text || `Request failed: ${resp.status}`);
      }
      return resp.json();
    },
    [devBypass, getToken],
  );

  return { requestJson, apiBase: API_BASE };
}
