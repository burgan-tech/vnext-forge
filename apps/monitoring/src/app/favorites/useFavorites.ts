import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Favorite {
  path: string;
  label: string;
}

interface FavoritesState {
  favorites: Favorite[];
  addFavorite: (fav: Favorite) => void;
  removeFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (fav: Favorite) => void;
}

const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (fav) =>
        set((s) => {
          if (s.favorites.some((f) => f.path === fav.path)) return s;
          return { favorites: [...s.favorites, fav] };
        }),
      removeFavorite: (path) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.path !== path) })),
      isFavorite: (path) => get().favorites.some((f) => f.path === path),
      toggleFavorite: (fav) => {
        const store = get();
        if (store.isFavorite(fav.path)) {
          store.removeFavorite(fav.path);
        } else {
          store.addFavorite(fav);
        }
      },
    }),
    { name: 'monitoring-favorites' },
  ),
);

export function useFavorites() {
  const { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite } =
    useFavoritesStore();
  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
