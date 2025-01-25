import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { StarIcon, CheckCircleIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { getImageUrl, fetchMovieRecommendations, fetchTVShowRecommendations } from '../services/tmdb';

export default function Recommendations() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [movieRecommendations, setMovieRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Oturum kontrolü
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/giris');
        return;
      }
      setUser(session.user);
      loadWatchedContent(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadWatchedContent = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      setWatchedMovies(data);
      await generateRecommendations(data);
    } catch (error) {
      console.error('İçerik yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async (watchedContent) => {
    try {
      // Film önerileri
      const movies = watchedContent.filter(item => item.movie_data.media_type === 'movie');
      const moviePromises = movies.map(movie => 
        fetchMovieRecommendations(movie.movie_id)
      );
      const movieResults = await Promise.all(moviePromises);
      const allMovieRecs = movieResults.flatMap(result => result.results || []);
      
      // Tekrarlanan önerileri kaldır ve izlenmeyen filmleri filtrele
      const watchedMovieIds = new Set(movies.map(m => m.movie_id));
      const uniqueMovieRecs = [...new Set(allMovieRecs.map(m => m.id))]
        .map(id => allMovieRecs.find(m => m.id === id))
        .filter(movie => !watchedMovieIds.has(movie.id));

      // Önerileri karıştır ve ilk 14'ünü al
      const shuffledMovies = uniqueMovieRecs
        .sort(() => Math.random() - 0.5)
        .slice(0, 14);

      setMovieRecommendations(shuffledMovies);

      // Dizi önerileri
      const shows = watchedContent.filter(item => item.movie_data.media_type === 'tv');
      const showPromises = shows.map(show => 
        fetchTVShowRecommendations(show.movie_id)
      );
      const showResults = await Promise.all(showPromises);
      const allShowRecs = showResults.flatMap(result => result.results || []);

      // Tekrarlanan önerileri kaldır ve izlenmeyen dizileri filtrele
      const watchedShowIds = new Set(shows.map(s => s.movie_id));
      const uniqueShowRecs = [...new Set(allShowRecs.map(s => s.id))]
        .map(id => allShowRecs.find(s => s.id === id))
        .filter(show => !watchedShowIds.has(show.id));

      // Önerileri karıştır ve ilk 14'ünü al
      const shuffledShows = uniqueShowRecs
        .sort(() => Math.random() - 0.5)
        .slice(0, 14);

      setShowRecommendations(shuffledShows);
    } catch (error) {
      console.error('Öneri oluşturma hatası:', error);
    }
  };

  // Film/Dizi izleme durumunu güncelle
  const handleWatchContent = async (content, isShow = false) => {
    if (!user) return;

    try {
      const contentId = content.id;
      const contentData = {
        title: isShow ? content.name : content.title,
        poster_path: content.poster_path,
        vote_average: content.vote_average,
        media_type: isShow ? 'tv' : 'movie'
      };

      const { error } = await supabase
        .from('watched_movies')
        .insert([
          {
            user_id: user.id,
            movie_id: contentId,
            movie_data: contentData
          }
        ]);

      if (error) throw error;

      // Önerileri güncelle
      loadWatchedContent(user.id);
    } catch (error) {
      console.error('İçerik işaretleme hatası:', error);
    }
  };

  const handleRefreshRecommendations = () => {
    setIsRefreshing(true);
    setProgress(0);

    // 5 saniye boyunca progress'i artır
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRefreshing(false);
          loadWatchedContent(user.id);
          return 100;
        }
        return prev + 2; // Her 50ms'de 2 birim artır (5 saniye için)
      });
    }, 50); // 50ms aralıklarla güncelle
  };

  const ContentCard = ({ content, isShow = false }) => {
    const isWatched = watchedMovies.some(m => m.movie_id === content.id);

    return (
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
            {!isWatched && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleWatchContent(content, isShow);
                }}
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs transition bg-gray-700 hover:bg-gray-600 text-gray-300"
              >
                <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                <span>İzledim</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Öneriler yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Head>
        <title>Öneriler - Film Öneri</title>
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

            <button
              onClick={handleRefreshRecommendations}
              disabled={isRefreshing}
              className="flex items-center space-x-2 text-white hover:text-accent transition disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Önerileri Yenile</span>
            </button>
          </div>
        </div>
      </header>

      {isRefreshing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-center mb-4">
              <SparklesIcon className="h-8 w-8 text-accent animate-pulse" />
            </div>
            <h3 className="text-xl text-white text-center mb-4">
              Yeni öneriler hazırlanıyor...
            </h3>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-center text-sm">
              İzleme geçmişiniz yeniden analiz ediliyor
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 max-w-[2000px]">
        <h2 className="text-4xl font-bold text-center mb-12 text-white">
          Size Özel Öneriler
        </h2>

        {movieRecommendations.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 text-white">Önerilen Filmler</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              {movieRecommendations.map((movie) => (
                <ContentCard 
                  key={movie.id} 
                  content={movie}
                />
              ))}
            </div>
          </section>
        )}

        {showRecommendations.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6 text-white">Önerilen Diziler</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
              {showRecommendations.map((show) => (
                <ContentCard 
                  key={show.id} 
                  content={show}
                  isShow={true}
                />
              ))}
            </div>
          </section>
        )}

        {movieRecommendations.length === 0 && showRecommendations.length === 0 && (
          <div className="text-center text-gray-400">
            <p>Henüz yeterli izleme geçmişiniz yok.</p>
            <p>Daha iyi öneriler için film ve dizileri izledikçe işaretleyin.</p>
          </div>
        )}
      </main>
    </div>
  );
} 