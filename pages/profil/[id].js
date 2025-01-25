import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabase';
import { StarIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { getImageUrl } from '../../services/tmdb';

export default function UserProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedContent, setDeletedContent] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [movieSearch, setMovieSearch] = useState('');
  const [showSearch, setShowSearch] = useState('');
  const [currentMoviePage, setCurrentMoviePage] = useState(1);
  const [currentShowPage, setCurrentShowPage] = useState(1);
  const itemsPerPage = 14;

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

  const handleDelete = async (content) => {
    try {
      // Silinen içeriği sakla
      setDeletedContent(content);
      setShowUndo(true);

      // Listeden kaldır
      setWatchedMovies(prev => prev.filter(item => item.id !== content.id));

      // 5 saniye sonra veritabanından sil
      setTimeout(async () => {
        if (deletedContent?.id === content.id) {
          const { error } = await supabase
            .from('watched_movies')
            .delete()
            .eq('id', content.id);

          if (error) throw error;

          setShowUndo(false);
          setDeletedContent(null);
        }
      }, 5000);

    } catch (error) {
      console.error('Silme hatası:', error);
    }
  };

  const handleUndo = async () => {
    if (!deletedContent) return;

    try {
      // Veritabanına geri ekle
      const { error } = await supabase
        .from('watched_movies')
        .insert([{
          user_id: id,
          movie_id: deletedContent.movie_id,
          movie_data: deletedContent.movie_data
        }]);

      if (error) throw error;

      // Listeye geri ekle
      setWatchedMovies(prev => [...prev, deletedContent]);

      // Geri al durumunu sıfırla
      setShowUndo(false);
      setDeletedContent(null);

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
            handleDelete(item);
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

  const filterAndPaginateContent = (items, searchTerm, currentPage) => {
    // Önce arama filtresini uygula
    const filtered = items.filter(item => 
      item.movie_data.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Toplam sayfa sayısını hesapla
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    // Sayfalama için dilimleme
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(start, start + itemsPerPage);

    return {
      items: paginatedItems,
      totalPages,
      totalItems: filtered.length
    };
  };

  const movies = watchedMovies.filter(item => item.movie_data.media_type === 'movie');
  const shows = watchedMovies.filter(item => item.movie_data.media_type === 'tv');

  const { items: paginatedMovies, totalPages: totalMoviePages } = filterAndPaginateContent(movies, movieSearch, currentMoviePage);
  const { items: paginatedShows, totalPages: totalShowPages } = filterAndPaginateContent(shows, showSearch, currentShowPage);

  const Pagination = ({ currentPage, totalPages, onPageChange }) => (
    <div className="flex justify-center space-x-2 mt-4">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1 rounded ${
            currentPage === page
              ? 'bg-accent text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {page}
        </button>
      ))}
    </div>
  );

  const SearchInput = ({ value, onChange, placeholder }) => {
    const inputRef = useRef(null);

    useEffect(() => {
      // Arama kutusuna tıklandığında odağı koru
      const handleClick = (e) => {
        if (inputRef.current && inputRef.current.contains(e.target)) {
          inputRef.current.focus();
        }
      };

      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }, []);

    return (
      <div className="relative mb-4">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-gray-700 text-white px-4 py-2 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ WebkitAppearance: 'none' }}
        />
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
      </div>
    );
  };

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
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-white">İzlenen Filmler</h3>
          </div>
          
          <SearchInput 
            value={movieSearch}
            onChange={setMovieSearch}
            placeholder="Film ara..."
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {paginatedMovies.map((item) => (
              <ContentCard key={item.id} item={item} type="film" />
            ))}
          </div>

          {totalMoviePages > 1 && (
            <Pagination
              currentPage={currentMoviePage}
              totalPages={totalMoviePages}
              onPageChange={setCurrentMoviePage}
            />
          )}
        </section>

        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-semibold text-white">İzlenen Diziler</h3>
          </div>

          <SearchInput 
            value={showSearch}
            onChange={setShowSearch}
            placeholder="Dizi ara..."
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
            {paginatedShows.map((item) => (
              <ContentCard key={item.id} item={item} type="dizi" />
            ))}
          </div>

          {totalShowPages > 1 && (
            <Pagination
              currentPage={currentShowPage}
              totalPages={totalShowPages}
              onPageChange={setCurrentShowPage}
            />
          )}
        </section>

        {showUndo && (
          <div className="fixed bottom-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg flex items-center space-x-4">
            <p className="text-white">İçerik silindi</p>
            <button
              onClick={handleUndo}
              className="text-accent hover:text-accent/80 transition"
            >
              Geri Al
            </button>
          </div>
        )}
      </main>
    </div>
  );
} 