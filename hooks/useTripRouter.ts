import { useState, useEffect, useRef, useCallback, MutableRefObject } from "react";
import { User } from "../types";
import {
  AppView,
  ParsedRoute,
  parseRouteFromLocation,
  syncUrlWithRoute,
} from "../services/routerService";

export interface UseTripRouterOptions {
  isLoading: boolean;
  userRef: MutableRefObject<User | null>;
}

export interface UseTripRouterResult {
  view: AppView;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  currentTripId: string | null;
  setCurrentTripId: React.Dispatch<React.SetStateAction<string | null>>;
  currentTripIdRef: MutableRefObject<string | null>;
  navigateToTrip: (tripId: string) => void;
  navigateToList: () => void;
  navigateToLanding: () => void;
  parseCurrentRoute: () => ParsedRoute;
  replaceRouteUrl: (nextView: AppView, nextTripId?: string | null) => void;
}

/**
 * Manages application route state (/, /trips, /trips/:tripId, legacy /?tripId=),
 * History API pushState/replaceState synchronization, and browser popstate handling.
 */
export function useTripRouter({
  isLoading,
  userRef,
}: UseTripRouterOptions): UseTripRouterResult {
  const [view, setView] = useState<AppView>("landing");
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const currentTripIdRef = useRef<string | null>(currentTripId);
  currentTripIdRef.current = currentTripId;

  // Synchronize browser URL path & sessionStorage once initial auth/loading settles
  useEffect(() => {
    // Do not touch the URL until loading is complete to prevent clearing invite links
    if (isLoading) return;

    if (view === "detail" && currentTripId) {
      sessionStorage.setItem("currentTripId", currentTripId);
      const mode = window.location.pathname === "/trips" ? "push" : "replace";
      syncUrlWithRoute("detail", currentTripId, mode);
    } else if (view === "list") {
      sessionStorage.removeItem("currentTripId");
      const mode = window.location.pathname.startsWith("/trips/") ? "push" : "replace";
      syncUrlWithRoute("list", null, mode);
    } else if (view === "landing") {
      sessionStorage.removeItem("currentTripId");
      if (!window.location.hash.includes("access_token")) {
        syncUrlWithRoute("landing", null, "replace");
      }
    }
  }, [currentTripId, view, isLoading]);

  // Handle browser back/forward button (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRouteFromLocation();
      if (route.view === "detail" && route.tripId) {
        setCurrentTripId(route.tripId);
        setView("detail");
      } else if (route.view === "list") {
        setCurrentTripId(null);
        setView(userRef.current ? "list" : "landing");
      } else {
        setCurrentTripId(null);
        setView("landing");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [userRef]);

  const navigateToTrip = useCallback((tripId: string) => {
    setCurrentTripId(tripId);
    setView("detail");
  }, []);

  const navigateToList = useCallback(() => {
    setCurrentTripId(null);
    setView("list");
  }, []);

  const navigateToLanding = useCallback(() => {
    setCurrentTripId(null);
    setView("landing");
  }, []);

  const parseCurrentRoute = useCallback(() => parseRouteFromLocation(), []);

  const replaceRouteUrl = useCallback(
    (nextView: AppView, nextTripId: string | null = null) => {
      syncUrlWithRoute(nextView, nextTripId, "replace");
    },
    []
  );

  return {
    view,
    setView,
    currentTripId,
    setCurrentTripId,
    currentTripIdRef,
    navigateToTrip,
    navigateToList,
    navigateToLanding,
    parseCurrentRoute,
    replaceRouteUrl,
  };
}
