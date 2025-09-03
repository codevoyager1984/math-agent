import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/user';

export interface AuthStore {
  loggedIn: boolean;
  setLoggedIn: (loggedIn: boolean) => void;
  user: User | null;
  setUser: (user: User | null) => void;
  accessToken: string | null;
  setAccessToken: (accessToken: string | null) => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      loggedIn: false,
      setLoggedIn: (loggedIn: boolean) => {
        set({
          loggedIn: loggedIn,
        });
      },
      user: null,
      setUser: (user: User | null) => {
        set({
          user: user,
        });
      },
      accessToken: null,
      setAccessToken: (accessToken: string | null) => {
        set({
          accessToken: accessToken,
        });
      },
    }),
    {
      name: 'auth',
    }
  )
);

export default useAuthStore;
