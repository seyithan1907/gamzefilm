import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabase';
import { StarIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { getImageUrl } from '../../services/tmdb';

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRemoved, setLastRemoved] = useState(null);
  const [showUndo, setShowUndo] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadUserProfile();
  }, [id]);

  const loadUserProfile = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (userError) throw userError;
      setUser(userData);

      const { data: moviesData, error: moviesError } = await supabase
        .from('watched_movies')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (moviesError) throw moviesError;
      setWatchedMovies(moviesData);
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContent = async (item) => {
    try {
      const { error } = await supabase
        .from('watched_movies')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setWatchedMovies(prev => prev.filter(m => m.id !== item.id));
      setLastRemoved(item);
      setShowUndo(true);
    } catch (error) {
      console.error('İçerik kaldırma hatası:', error);
    }
  };

  // Geri alma bildirimi için zamanlayıcı
  useEffect(() => {
    let timer;
    if (showUndo) {
      timer = setTimeout(() => {
        setShowUndo(false);
        setLastRemoved(null);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showUndo]);

  const handleUndo = async () => {
    if (!lastRemoved) return;

    try {
      const { error } = await supabase
        .from('watched_movies')
        .insert([lastRemoved]);

      if (error) throw error;

      setWatchedMovies(prev => [...prev, lastRemoved]);
      setShowUndo(false);
      setLastRemoved(null);
    } catch (error) {
      console.error('Geri alma hatası:', error);
    }
  };

  const ContentCard = ({ item, type }) => (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition duration-300"
    >
      <div 
        className="relative pb-[150%] cursor-pointer"
        onClick={() => router.push(`/${type}/${item.movie_id}`)}
      >
        <img
          src={getImageUrl(item.movie_data.poster_path)}
          alt={item.movie_data.title}
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveContent(item);
          }}
          className="absolute top-2 right-2 bg-green-600 hover:bg-green-700 text-white rounded-full p-1 transition"
        >
          <CheckCircleIcon className="h-6 w-6" />
        </button>
      </div>
      <div className="p-2">
        <h4 className="text-base font-medium text-white mb-2 line-clamp-1">
          {item.movie_data.title}
        </h4>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <StarIcon className="h-4 w-4 text-yellow-400" />
            <span className="ml-1 text-white text-xs">
              {item.movie_data.vote_average.toFixed(1)}
            </span>
          </div>
          <span className="text-gray-400 text-xs">
            {new Date(item.created_at).toLocaleDateString('tr-TR')}
          </span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Kullanıcı bulunamadı</div>
      </div>
    );
  }

  const movies = watchedMovies.filter(item => item.movie_data.media_type === 'movie');
  const shows = watchedMovies.filter(item => item.movie_data.media_type === 'tv');

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Head>
        <title>{user.full_name} - Film Öneri</title>
      </Head>

      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <h1 
            className="text-2xl font-bold text-white cursor-pointer"
            onClick={() => router.push('/')}
          >
            Film Öneri
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-[2000px]">
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-2">{user.full_name}</h2>
          <div className="flex space-x-4 text-gray-400">
            <p>{movies.length} film</p>
            <p>{shows.length} dizi</p>
          </div>
        </div>

        <section className="mb-12">
          <h3 className="text-2xl font-semibold mb-6 text-white">İzlenen Filmler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {movies.map((item) => (
              <ContentCard key={item.id} item={item} type="film" />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h3 className="text-2xl font-semibold mb-6 text-white">İzlenen Diziler</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {shows.map((item) => (
              <ContentCard key={item.id} item={item} type="dizi" />
            ))}
          </div>
        </section>

        {showUndo && lastRemoved && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-4">
            <span>
              "{lastRemoved.movie_data.title}" izlenenlerden kaldırıldı
            </span>
            <button
              onClick={handleUndo}
              className="bg-accent hover:bg-red-600 px-4 py-1 rounded transition"
            >
              Geri Al
            </button>
          </div>
        )}
      </main>
    </div>
  );
} 