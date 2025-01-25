import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { StarIcon, CheckCircleIcon, ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { getImageUrl, fetchMovieRecommendations, fetchTVShowRecommendations } from '../services/tmdb';
import { analyzeWatchHistory, getUserPreferences, rankContentByPreference } from '../services/recommendations';
import { rankContentWithAI } from '../services/huggingface';

export default function Recommendations() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [movieRecommendations, setMovieRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [onlyTurkish, setOnlyTurkish] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    // Oturum kontrolü
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/giris');
        return;
      }
      setUser(session.user);
      loadUserPreferences(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Kullanıcı tercihlerini yükle
  const loadUserPreferences = async (userId) => {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('ai_enabled')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      setAiEnabled(data.ai_enabled);
    }
  };

  // Yapay zeka durumunu değiştir
  const toggleAI = async () => {
    if (!user) return;

    const newValue = !aiEnabled;
    setAiEnabled(newValue);

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ai_enabled: newValue
      });

    if (error) {
      console.error('Yapay zeka tercihi güncelleme hatası:', error);
    } else {
      // Önerileri yeniden yükle
      loadWatchedContent(user.id);
    }
  };

  // Kullanıcı değiştiğinde içerikleri yükle
  useEffect(() => {
    if (user) {
      loadWatchedContent(user.id);
      analyzeUserPreferences(user.id);
    }
  }, [user]);

  const loadWatchedContent = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      if (data) {
        setWatchedMovies(data);
        await generateRecommendations(data, userId);
      }
    } catch (error) {
      console.error('İçerik yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTurkishContent = (content) => {
    if (!onlyTurkish) return content;
    return content.filter(item => item.original_language === 'tr');
  };

  const generateRecommendations = async (watchedContent, userId) => {
    try {
      if (!userId) {
        console.error('Kullanıcı ID bulunamadı');
        return;
      }

      setMovieRecommendations([]); // Önerileri sıfırla
      setShowRecommendations([]); // Önerileri sıfırla

      // Kullanıcı tercihlerini getir
      const userPreferences = await getUserPreferences(userId);

      // Film önerileri
      const movies = watchedContent.filter(item => item.movie_data.media_type === 'movie');
      const moviePromises = movies.map(movie => 
        fetchMovieRecommendations(movie.movie_id)
      );

      if (moviePromises.length === 0) {
        console.log('İzlenen film bulunamadı');
        setMovieRecommendations([]);
      } else {
        const movieResults = await Promise.all(moviePromises);
        const allMovieRecs = movieResults.flatMap(result => result.results || []);
        
        // Tekrarlanan önerileri kaldır ve izlenmeyen filmleri filtrele
        const watchedMovieIds = new Set(movies.map(m => m.movie_id));
        const uniqueMovieRecs = [...new Set(allMovieRecs.map(m => m.id))]
          .map(id => allMovieRecs.find(m => m.id === id))
          .filter(movie => !watchedMovieIds.has(movie.id))
          .filter(movie => movie.overview && movie.overview.length > 0); // Açıklaması olan filmleri filtrele

        // Önerileri filtrele
        const filteredMovies = filterTurkishContent(uniqueMovieRecs);
        
        let finalMovies;
        if (aiEnabled) {
          try {
            console.log('AI film önerileri oluşturuluyor...');
            // Son izlenen filmi referans al
            const lastWatchedMovie = movies[movies.length - 1]?.movie_data;
            if (lastWatchedMovie) {
              finalMovies = await rankContentWithAI(
                filteredMovies,
                [lastWatchedMovie], // Sadece son izlenen filmi kullan
                0.7 // Benzerlik eşiği
              );
              // İlk 500 öneriyi al ve rastgele 14 tanesini seç
              const top500Movies = finalMovies.slice(0, 500);
              finalMovies = top500Movies
                .sort(() => Math.random() - 0.5) // Rastgele karıştır
                .slice(0, 14); // İlk 14'ü al
            } else {
              finalMovies = await rankContentByPreference(filteredMovies, userPreferences);
            }
            console.log('AI film önerileri oluşturuldu:', finalMovies.length);
          } catch (error) {
            console.error('Yapay zeka film önerileri alınamadı:', error);
            finalMovies = await rankContentByPreference(filteredMovies, userPreferences);
          }
        } else {
          finalMovies = await rankContentByPreference(filteredMovies, userPreferences);
        }
        
        setMovieRecommendations(finalMovies);
      }

      // Dizi önerileri
      const shows = watchedContent.filter(item => item.movie_data.media_type === 'tv');
      const showPromises = shows.map(show => 
        fetchTVShowRecommendations(show.movie_id)
      );

      if (showPromises.length === 0) {
        console.log('İzlenen dizi bulunamadı');
        setShowRecommendations([]);
      } else {
        const showResults = await Promise.all(showPromises);
        const allShowRecs = showResults.flatMap(result => result.results || []);

        // Tekrarlanan önerileri kaldır ve izlenmeyen dizileri filtrele
        const watchedShowIds = new Set(shows.map(s => s.movie_id));
        const uniqueShowRecs = [...new Set(allShowRecs.map(s => s.id))]
          .map(id => allShowRecs.find(s => s.id === id))
          .filter(show => !watchedShowIds.has(show.id))
          .filter(show => show.overview && show.overview.length > 0); // Açıklaması olan dizileri filtrele

        // Önerileri filtrele
        const filteredShows = filterTurkishContent(uniqueShowRecs);
        
        let finalShows;
        if (aiEnabled) {
          try {
            console.log('AI dizi önerileri oluşturuluyor...');
            // Son izlenen diziyi referans al
            const lastWatchedShow = shows[shows.length - 1]?.movie_data;
            if (lastWatchedShow) {
              finalShows = await rankContentWithAI(
                filteredShows,
                [lastWatchedShow], // Sadece son izlenen diziyi kullan
                0.7 // Benzerlik eşiği
              );
              // İlk 500 öneriyi al ve rastgele 14 tanesini seç
              const top500Shows = finalShows.slice(0, 500);
              finalShows = top500Shows
                .sort(() => Math.random() - 0.5) // Rastgele karıştır
                .slice(0, 14); // İlk 14'ü al
            } else {
              finalShows = await rankContentByPreference(filteredShows, userPreferences);
            }
            console.log('AI dizi önerileri oluşturuldu:', finalShows.length);
          } catch (error) {
            console.error('Yapay zeka dizi önerileri alınamadı:', error);
            finalShows = await rankContentByPreference(filteredShows, userPreferences);
          }
        } else {
          finalShows = await rankContentByPreference(filteredShows, userPreferences);
        }
        
        setShowRecommendations(finalShows);
      }

    } catch (error) {
      console.error('Öneri oluşturma hatası:', error);
    }
  };

  const analyzeUserPreferences = async (userId) => {
    setIsRefreshing(true);
    setProgress(0);

    try {
      // İzleme geçmişini analiz et
      const result = await analyzeWatchHistory(userId);
      
      if (result.success) {
        console.log('Tür istatistikleri:', result.genreStats);
        // İleriki adımlarda bu istatistikleri kullanacağız
      }

    } catch (error) {
      console.error('Kullanıcı tercihleri analiz hatası:', error);
    } finally {
      setIsRefreshing(false);
      setProgress(100);
    }
  };

  // Film/Dizi izleme durumunu güncelle
  const handleWatchContent = async (content, isShow = false) => {
    if (!user) return;

    try {
      setIsRefreshing(true);
      setProgress(0);

      const contentId = content.id;
      const contentData = {
        title: isShow ? content.name : content.title,
        poster_path: content.poster_path,
        vote_average: content.vote_average,
        overview: content.overview,
        media_type: isShow ? 'tv' : 'movie',
        genres: content.genres || []
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

      // İzlenen içerikleri yeniden yükle
      const { data: watchedData } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', user.id);

      if (watchedData) {
        setWatchedMovies(watchedData);
        // Progress barı ilerlet
        let progress = 0;
        const interval = setInterval(() => {
          progress += 5;
          setProgress(progress);
          if (progress >= 100) {
            clearInterval(interval);
            setIsRefreshing(false);
          }
        }, 50);

        // Önerileri yeniden oluştur
        await generateRecommendations(watchedData, user.id);
      }

    } catch (error) {
      console.error('İçerik işaretleme hatası:', error);
    } finally {
      setIsRefreshing(false);
      setProgress(100);
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
        <title>Kişiselleştirilmiş Öneriler - Film Öneri</title>
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

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-white text-sm">Yalnızca Türkçe</label>
                <button
                  onClick={() => {
                    setOnlyTurkish(!onlyTurkish);
                    loadWatchedContent(user.id);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    onlyTurkish ? 'bg-accent' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      onlyTurkish ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={toggleAI}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition ${
                  aiEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                <SparklesIcon className="h-5 w-5" />
                <span>{aiEnabled ? 'AI Öneriler' : 'Normal Öneriler'}</span>
              </button>

              <button
                onClick={handleRefreshRecommendations}
                className="flex items-center space-x-2 text-white hover:text-accent transition"
                disabled={isRefreshing}
              >
                <ArrowPathIcon className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Yenile</span>
              </button>
            </div>
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