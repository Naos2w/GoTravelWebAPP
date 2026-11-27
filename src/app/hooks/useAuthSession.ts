import React, { useState, useEffect, useRef, MutableRefObject } from "react";
import { Trip, Language, User } from "../../types";
import { getTripById, supabase } from "../../shared/services/storageService";
import {
  parseSupabaseUser,
  signInWithGoogle,
  signOutSafely,
  consumeRedirectTripId,
  saveRedirectTripId,
  isSupabaseConfigured,
} from "../../shared/services/authService";
import { AppView, ParsedRoute } from "../../shared/services/routerService";
import { translations } from "../../shared/contexts/LocalizationContext";
import { LoginReason } from "../../shared/components/LoginModal";
import { NotificationState } from "./useTripRealtime";

export interface UseAuthSessionOptions {
  userRef: MutableRefObject<User | null>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  language: Language;
  currentTripId: string | null;
  currentTripIdRef: MutableRefObject<string | null>;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  setCurrentTripId: React.Dispatch<React.SetStateAction<string | null>>;
  navigateToLanding: () => void;
  parseCurrentRoute: () => ParsedRoute;
  replaceRouteUrl: (nextView: AppView, nextTripId?: string | null) => void;
  setTrips: React.Dispatch<React.SetStateAction<Trip[]>>;
  setNotification: React.Dispatch<React.SetStateAction<NotificationState | null>>;
}

export interface UseAuthSessionResult {
  isLoggingIn: boolean;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingTripId: string | null;
  loginReason: LoginReason;
  setLoginReason: React.Dispatch<React.SetStateAction<LoginReason>>;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
}

/**
 * Manages Supabase Auth session initialization, OAuth / email sign-in & sign-out,
 * auth state subscriptions, and deep-link trip access verification.
 */
export function useAuthSession({
  userRef,
  setUser,
  setIsLoading,
  language,
  currentTripId,
  currentTripIdRef,
  setView,
  setCurrentTripId,
  navigateToLanding,
  parseCurrentRoute,
  replaceRouteUrl,
  setTrips,
  setNotification,
}: UseAuthSessionOptions): UseAuthSessionResult {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTripId, setPendingTripId] = useState<string | null>(null);
  const [loginReason, setLoginReason] = useState<LoginReason>(null);

  const languageRef = useRef<Language>(language);
  languageRef.current = language;

  // Preserve user object reference across background token refreshes to avoid breaking subscriptions
  const setSafeUser = (newUser: User | null) => {
    setUser((prev) => {
      if (!newUser) return null;
      if (
        prev &&
        prev.id === newUser.id &&
        prev.email === newUser.email &&
        prev.name === newUser.name
      ) {
        return prev;
      }
      return newUser;
    });
  };

  const handleAuthUser = async (supabaseUser: any) => {
    const parsedUser = parseSupabaseUser(supabaseUser);
    setSafeUser(parsedUser);

    const parsedRoute = parseCurrentRoute();
    const urlTripId = parsedRoute.tripId || consumeRedirectTripId();

    if (urlTripId) {
      const isAlreadyViewing = currentTripIdRef.current === urlTripId;
      if (!isAlreadyViewing) setIsLoading(true);
      try {
        const trip = await getTripById(urlTripId);
        if (trip) {
          const userEmailLower = parsedUser.email.toLowerCase();
          const isOwner = trip.user_id === parsedUser.id;
          const isAllowed = trip.allowed_emails?.some(
            (e) => e.toLowerCase() === userEmailLower
          );

          if (isOwner || isAllowed) {
            setCurrentTripId(urlTripId);
            setTrips((prev) =>
              prev.some((t) => t.id === trip.id) ? prev : [trip, ...prev]
            );
            replaceRouteUrl("detail", urlTripId);
            setView("detail");
          } else {
            replaceRouteUrl("list", null);
            setNotification({
              message:
                translations[languageRef.current].noPermissionRedirect ||
                "您沒有此行程的存取權限，已為您跳轉至您的行程頁面",
              type: "error",
            });
            setView("list");
          }
        } else {
          replaceRouteUrl("list", null);
          setNotification({
            message:
              translations[languageRef.current].tripNotFoundRedirect ||
              "找不到此行程或無權限存取，已為您跳轉至您的行程頁面",
            type: "error",
          });
          setView("list");
        }
      } catch {
        replaceRouteUrl("list", null);
        setView("list");
      } finally {
        setIsLoading(false);
      }
    } else {
      replaceRouteUrl("list", null);
      setView("list");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 10000);

    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (sessionError) console.warn("[Auth] getSession error:", sessionError);

        if (session?.user) {
          await handleAuthUser(session.user);
        } else if (!window.location.hash.includes("access_token")) {
          const parsedRoute = parseCurrentRoute();
          const urlTripId = parsedRoute.tripId;
          if (urlTripId) {
            saveRedirectTripId(urlTripId);
            setPendingTripId(urlTripId);
            replaceRouteUrl("landing", null);
            setNotification({
              message:
                translations[languageRef.current].loginRequiredRedirect ||
                "此行程需要登入存取，已為您前往登入主頁",
              type: "info",
            });
            setLoginReason("trip_access");
            setIsLoginModalOpen(true);
          } else if (parsedRoute.view === "list") {
            replaceRouteUrl("landing", null);
            setIsLoginModalOpen(true);
          }

          if (isMounted) {
            setUser(null);
            navigateToLanding();
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn("[Auth] getSession unexpected failure:", err);
        if (isMounted) {
          setView("landing");
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted || event === "INITIAL_SESSION") return;

      if (event === "SIGNED_IN" && session?.user) {
        if (userRef.current?.id === session.user.id) {
          setSafeUser(parseSupabaseUser(session.user));
          return;
        }
        await handleAuthUser(session.user);
      } else if (event === "TOKEN_REFRESHED" && session?.user) {
        setSafeUser(parseSupabaseUser(session.user));
      } else if (event === "SIGNED_OUT") {
        const activeTripId = currentTripIdRef.current;
        replaceRouteUrl("landing", null);
        if (activeTripId) {
          saveRedirectTripId(activeTripId);
          setPendingTripId(activeTripId);
        }
        setUser(null);
        setTrips([]);
        navigateToLanding();
        setIsLoading(false);
        setNotification({
          message:
            translations[languageRef.current].sessionExpired ||
            "登入已過期，請重新登入",
          type: "info",
        });
        setLoginReason("session_expired");
        setIsLoginModalOpen(true);
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    if (!isSupabaseConfigured()) {
      setNotification({
        message:
          translations[languageRef.current].configMissing ||
          "Supabase configuration is missing",
        type: "error",
      });
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithGoogle(pendingTripId || currentTripId);
    } catch (loginError: any) {
      console.error("Error logging in:", loginError);
      setIsLoggingIn(false);
      setNotification({
        message:
          loginError?.message ||
          translations[languageRef.current].loginFailed ||
          "Failed to log in",
        type: "error",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSafely();
    } catch (logoutError) {
      console.warn("Logout error:", logoutError);
    } finally {
      setUser(null);
      setTrips([]);
      navigateToLanding();
      setIsLoading(false);
      setNotification({
        message: translations[languageRef.current].logoutSuccess || "Logged out",
        type: "info",
      });
    }
  };

  return {
    isLoggingIn,
    isLoginModalOpen,
    setIsLoginModalOpen,
    pendingTripId,
    loginReason,
    setLoginReason,
    handleLogin,
    handleLogout,
  };
}
