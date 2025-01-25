const API_KEY = 'f6a19bd984254cfe611d57a1cf5307b6';
const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchPopularMovies = async () => {
  const response = await fetch(
    `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=tr-TR`
  );
  return response.json();
};

export const fetchPopularTVShows = async () => {
  const response = await fetch(
    `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=tr-TR`
  );
  return response.json();
};

export const fetchMovieRecommendations = async (movieId) => {
  const response = await fetch(
    `${BASE_URL}/movie/${movieId}/recommendations?api_key=${API_KEY}&language=tr-TR`
  );
  return response.json();
};

export const searchMovies = async (query) => {
  const response = await fetch(
    `${BASE_URL}/search/multi?api_key=${API_KEY}&language=tr-TR&query=${encodeURIComponent(query)}&page=1`
  );
  return response.json();
};

export const getImageUrl = (path) => {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : '/no-image.jpg';
};

export const fetchTVShowRecommendations = async (showId) => {
  try {
    const response = await fetch(
      `${BASE_URL}/tv/${showId}/recommendations?api_key=${API_KEY}&language=tr-TR`
    );
    return await response.json();
  } catch (error) {
    console.error('Dizi önerileri getirme hatası:', error);
    return { results: [] };
  }
}; 