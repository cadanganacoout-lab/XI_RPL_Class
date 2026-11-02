import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest, clearPrivateCache, setAuthResetHandler } from "../lib/api.js";

const AuthContext = createContext(null);

function authUserFromPayload(payload) {
  if (!payload?.user) return null;
  return {
    ...payload.user,
    mustChangePassword: Boolean(
      payload.mustChangePassword ?? payload.user.mustChangePassword,
    ),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setUser(null);
    setError("");
    setLoading(false);
    clearPrivateCache();
  }, []);

  useEffect(() => {
    let active = true;
    const unregister = setAuthResetHandler(() => {
      if (active) reset();
    });

    apiRequest("/api/auth/me")
      .then(payload => {
        if (active) {
          setUser(authUserFromPayload(payload));
          setError("");
        }
      })
      .catch(requestError => {
        if (active) {
          setUser(null);
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unregister();
    };
  }, [reset]);

  const refresh = useCallback(async () => {
    try {
      const payload = await apiRequest("/api/auth/me");
      const nextUser = authUserFromPayload(payload);
      setUser(nextUser);
      setError("");
      return nextUser;
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }, []);

  const login = useCallback(async credentials => {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      body: credentials,
    });
    const nextUser = authUserFromPayload(payload);
    setUser(nextUser);
    setLoading(false);
    setError("");
    return nextUser;
  }, []);

  const register = useCallback(async details => {
    const payload = await apiRequest("/api/auth/register", {
      method: "POST",
      body: details,
    });
    const nextUser = authUserFromPayload(payload);
    setUser(nextUser);
    setLoading(false);
    setError("");
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("/api/auth/logout", { method: "POST", body: {} });
    reset();
  }, [reset]);

  const changePassword = useCallback(async passwords => {
    const payload = await apiRequest("/api/auth/change-password", {
      method: "POST",
      body: passwords,
    });
    const nextUser = authUserFromPayload(payload);
    setUser(nextUser);
    setError("");
    return nextUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login,
      register,
      logout,
      refresh,
      changePassword,
    }),
    [user, loading, error, login, register, logout, refresh, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider.");
  return auth;
}
