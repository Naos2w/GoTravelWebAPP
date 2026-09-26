import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { User } from "../types";
import { supabase } from "../services/storageService";
import {
  parseSupabaseUser,
  signInWithGoogle,
  signInWithEmail,
  signOutSafely,
  consumeRedirectTripId,
  isSupabaseConfigured,
} from "../services/authService";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggingIn: boolean;
  isConfigured: boolean;
  login: (redirectTripId?: string | null) => Promise<void>;
  loginWithEmail: (email: string, redirectTripId?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  consumeRedirectTripId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        // Prevent redundant state resets during TOKEN_REFRESHED
        if (userRef.current && userRef.current.id === session.user.id) {
          setIsLoading(false);
          return;
        }
        const parsed = parseSupabaseUser(session.user);
        setUser(parsed);
        setIsLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setIsLoading(false);
      } else {
        // Only clear loading if not in the middle of an OAuth hash callback
        if (!window.location.hash.includes("access_token")) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (redirectTripId?: string | null) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithGoogle(redirectTripId);
    } catch (err) {
      setIsLoggingIn(false);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, redirectTripId?: string | null) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithEmail(email, redirectTripId);
    } catch (err) {
      setIsLoggingIn(false);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOutSafely();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggingIn,
        isConfigured: isSupabaseConfigured(),
        login,
        loginWithEmail,
        logout,
        setUser,
        consumeRedirectTripId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
