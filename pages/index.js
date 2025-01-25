import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { fetchPopularMovies, fetchPopularTVShows, searchMovies, getImageUrl } from '../services/tmdb';
import { StarIcon, UserIcon, MagnifyingGlassIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabase';

const API_KEY = 'f6a19bd984254cfe611d57a1cf5307b6';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [popularMovies, setPopularMovies] = useState([]);
  const [popularTVShows, setPopularTVShows] = useState([]);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [topRatedTVShows, setTopRatedTVShows] = useState([]);

  useEffect(() => {
    // Oturum durumunu kontrol et
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadWatchedMovies(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // İzlenen filmleri yükle
  const loadWatchedMovies = async (userId) => {
    const { data, error } = await supabase
      .from('watched_movies')
      .select('movie_id')
      .eq('user_id', userId);

    if (!error && data) {
      setWatchedMovies(data.map(item => item.movie_id));
    }
  };

  useEffect(() => {
    fetchPopularContent();
    fetchTopRatedContent();
  }, []);

  const fetchPopularContent = async () => {
    try {
      // Popüler filmleri getir
      const moviesData = await fetchPopularMovies();
      setPopularMovies(moviesData.results.slice(0, 14));

      // Popüler dizileri getir
      const tvShowsData = await fetchPopularTVShows();
      setPopularTVShows(tvShowsData.results.slice(0, 14));

      setLoading(false);
    } catch (error) {
      console.error('Popüler içerik getirme hatası:', error);
      setLoading(false);
    }
  };

  const fetchTopRatedContent = async () => {
    try {
      // En iyi filmleri getir
      const moviesResponse = await fetch(
        `https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&language=tr-TR&page=1`
      );
      const moviesData = await moviesResponse.json();
      setTopRatedMovies(moviesData.results.slice(0, 14));

      // En iyi dizileri getir
      const tvShowsResponse = await fetch(
        `https://api.themoviedb.org/3/tv/top_rated?api_key=${API_KEY}&language=tr-TR&page=1`
      );
      const tvShowsData = await tvShowsResponse.json();
      setTopRatedTVShows(tvShowsData.results.slice(0, 14));

      setLoading(false);
    } catch (error) {
      console.error('En iyi içerik getirme hatası:', error);
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchMovies(query);
      setSearchResults(results.results.slice(0, 5));
    }, 300);
  };

  const handleGetRecommendations = () => {
    setIsAnalyzing(true);
    setProgress(0);

    // 5 saniye boyunca progress'i artır
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          router.push('/oneriler');
          return 100;
        }
        return prev + 2; // Her 50ms'de 2 birim artır (5 saniye için)
      });
    }, 50); // 50ms aralıklarla güncelle
  };

  // Film/Dizi kartı bileşeni
  const ContentCard = ({ content, isShow = false, isWatched }) => (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition duration-300">
      <div 
        className="relative pb-[150%] cursor-pointer"
        onClick={() => router.push(`/${isShow ? 'dizi' : 'film'}/${content.id}`)}
      >
        <img
          src={getImageUrl(content.poster_path)}
          alt={isShow ? content.name : content.title}
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
      </div>
      <div className="p-2">
        <h3 className="text-base font-medium text-white mb-1 line-clamp-1">
          {isShow ? content.name : content.title}
        </h3>
        <p className="text-gray-400 text-xs mb-2 line-clamp-2">{content.overview}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <StarIcon className="h-4 w-4 text-yellow-400" />
            <span className="ml-1 text-white text-xs">{content.vote_average.toFixed(1)}</span>
          </div>
          {user && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleWatchContent(content, isShow);
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition ${
                isWatched 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              <CheckCircleIcon className={`h-4 w-4 ${isWatched ? 'text-white' : 'text-gray-400'}`} />
              <span>{isWatched ? 'İzlendi' : 'İzledim'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Head>
        <title>Film Öneri - Kişiselleştirilmiş Film ve Dizi Önerileri</title>
      </Head>

      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 
              className="text-2xl font-bold text-white cursor-pointer"
              onClick={() => router.push('/')}
            >
              Film Öneri
            </h1>

            <div className="flex-1 max-w-xl mx-8 relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Film veya dizi ara..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg pl-10 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {isSearching && searchResults.length > 0 && (
                <div className="absolute w-full mt-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="p-3 hover:bg-gray-700 cursor-pointer flex items-center space-x-3"
                      onClick={() => {
                        router.push(`/${result.media_type === 'movie' ? 'film' : 'dizi'}/${result.id}`);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                    >
                      <img
                        src={getImageUrl(result.poster_path)}
                        alt={result.title || result.name}
                        className="w-10 h-14 object-cover rounded"
                      />
                      <div>
                        <h4 className="text-white font-medium">
                          {result.title || result.name}
                        </h4>
                        <p className="text-gray-400 text-sm">
                          {result.media_type === 'movie' ? 'Film' : 'Dizi'} • {
                            result.release_date?.split('-')[0] || 
                            result.first_air_date?.split('-')[0]
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={handleGetRecommendations}
                    className="flex items-center space-x-2 text-white hover:text-accent transition"
                    disabled={isAnalyzing}
                  >
                    <SparklesIcon className="h-6 w-6" />
                    <span>Öneri Al</span>
                  </button>
                  <button
                    onClick={() => router.push(`/profil/${user.id}`)}
                    className="text-white font-medium hover:text-accent transition"
                  >
                    {user.user_metadata.full_name}
                  </button>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center space-x-2 text-white hover:text-accent transition"
                  >
                    <UserIcon className="h-6 w-6" />
                    <span>Çıkış Yap</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/giris')}
                    className="text-white hover:text-accent transition"
                  >
                    Giriş Yap
                  </button>
                  <button
                    onClick={() => router.push('/kayit')}
                    className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition"
                  >
                    Üye Ol
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-center mb-4">
              <SparklesIcon className="h-8 w-8 text-accent animate-pulse" />
            </div>
            <h3 className="text-xl text-white text-center mb-4">
              İzleme geçmişiniz analiz ediliyor...
            </h3>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-center text-sm">
              Size en uygun içerikler belirleniyor
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-12 text-white">
          AI Destekli Film ve Dizi Önerileri
        </h1>

        {/* Popüler Filmler */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-white">Popüler Filmler</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {popularMovies.map((movie) => (
              <ContentCard
                key={movie.id}
                content={movie}
                isWatched={watchedMovies.includes(movie.id)}
              />
            ))}
          </div>
        </section>

        {/* Popüler Diziler */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-white">Popüler Diziler</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {popularTVShows.map((show) => (
              <ContentCard
                key={show.id}
                content={show}
                isShow={true}
                isWatched={watchedMovies.includes(show.id)}
              />
            ))}
          </div>
        </section>

        {/* En İyi Filmler */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-white">En İyi Filmler</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {topRatedMovies.map((movie) => (
              <ContentCard 
                key={movie.id}
                content={movie}
                isWatched={watchedMovies.includes(movie.id)} 
              />
            ))}
          </div>
        </section>

        {/* En İyi Diziler */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-white">En İyi Diziler</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {topRatedTVShows.map((show) => (
              <ContentCard 
                key={show.id}
                content={show}
                isShow={true}
                isWatched={watchedMovies.includes(show.id)} 
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}