import { useState, useEffect, useRef, useCallback, MutableRefObject } from "react";
import { User } from "../../types";
import {
  AppView,
  ParsedRoute,
  buildPathForRoute,
  isPublicContentView,
  parseRouteFromLocation,
  syncUrlWithRoute,
} from "../../shared/services/routerService";

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
  navigateToPublicPage: (pathOrView: string) => void;
  parseCurrentRoute: () => ParsedRoute;
  replaceRouteUrl: (nextView: AppView, nextTripId?: string | null) => void;
}

/**
 * Manages application route state (/, /trips, /trips/:tripId, legacy /?tripId=,
 * and public content pages), History API synchronization, and browser popstate handling.
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
      const currentParsed = parseRouteFromLocation();
      const mode =
        window.location.pathname === "/trips" || isPublicContentView(currentParsed.view)
          ? "push"
          : "replace";
      syncUrlWithRoute("detail", currentTripId, mode);
    } else if (view === "list") {
      sessionStorage.removeItem("currentTripId");
      const currentParsed = parseRouteFromLocation();
      const mode =
        window.location.pathname.startsWith("/trips/") ||
        isPublicContentView(currentParsed.view)
          ? "push"
          : "replace";
      syncUrlWithRoute("list", null, mode);
    } else if (isPublicContentView(view)) {
      sessionStorage.removeItem("currentTripId");
      const targetPath = buildPathForRoute(view);
      const mode = window.location.pathname !== targetPath ? "push" : "replace";
      syncUrlWithRoute(view, null, mode);
    } else if (view === "landing") {
      sessionStorage.removeItem("currentTripId");
      if (!window.location.hash.includes("access_token")) {
        const currentParsed = parseRouteFromLocation();
        const mode = isPublicContentView(currentParsed.view) ? "push" : "replace";
        syncUrlWithRoute("landing", null, mode);
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
      } else if (isPublicContentView(route.view)) {
        setCurrentTripId(null);
        setView(route.view);
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

  const navigateToPublicPage = useCallback(
    (pathOrView: string) => {
      const slug = pathOrView.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
      setCurrentTripId(null);
      if (isPublicContentView(slug as AppView)) {
        setView(slug as AppView);
      } else if (slug === "trips" || slug === "list") {
        setView(userRef.current ? "list" : "landing");
      } else {
        setView("landing");
      }
      try {
        window.scrollTo?.(0, 0);
      } catch {
        // Ignore in environments without scrollTo
      }
    },
    [userRef]
  );

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
    navigateToPublicPage,
    parseCurrentRoute,
    replaceRouteUrl,
  };
}
