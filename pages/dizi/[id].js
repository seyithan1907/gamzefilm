import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { StarIcon, ClockIcon, CalendarIcon, UserIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { getImageUrl } from '../../services/tmdb';
import { supabase } from '../../lib/supabase';

const API_KEY = 'f6a19bd984254cfe611d57a1cf5307b6';

export default function TVShowDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [show, setShow] = useState(null);
  const [user, setUser] = useState(null);
  const [isWatched, setIsWatched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [krediler, setKrediler] = useState(null);
  const [fragmanlar, setFragmanlar] = useState([]);
  const [imdbId, setImdbId] = useState(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && id) {
        checkIfWatched(session.user.id, id);
      }
    });

    return () => subscription.unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchShowDetails();
  }, [id]);

  const fetchShowDetails = async () => {
    try {
      // Dizi detaylarını getir
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEY}&language=tr-TR&append_to_response=external_ids`
      );
      const data = await response.json();
      setShow(data);
      setImdbId(data.external_ids?.imdb_id);

      // Oyuncu ve ekip bilgilerini getir
      const kredilerResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${id}/credits?api_key=${API_KEY}&language=tr-TR`
      );
      const kredilerData = await kredilerResponse.json();
      setKrediler(kredilerData);

      // Fragmanları getir
      const videolarResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${id}/videos?api_key=${API_KEY}&language=tr-TR`
      );
      const videolarData = await videolarResponse.json();
      setFragmanlar(videolarData.results.filter(video => video.type === "Trailer"));

      setLoading(false);
    } catch (error) {
      console.error('Dizi detayları getirme hatası:', error);
      setLoading(false);
    }
  };

  const checkIfWatched = async (userId, showId) => {
    try {
      const { data, error } = await supabase
        .from('watched_movies')
        .select('id')
        .eq('user_id', userId)
        .eq('movie_id', parseInt(showId))
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIsWatched(!!data);
    } catch (error) {
      console.error('İzlenme durumu kontrol hatası:', error);
    }
  };

  const handleWatchClick = async () => {
    if (!user) {
      router.push('/giris');
      return;
    }

    try {
      if (isWatched) {
        // Diziyi izlenenlerden kaldır
        const { error } = await supabase
          .from('watched_movies')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_id', show.id);

        if (error) throw error;
        setIsWatched(false);
      } else {
        // Diziyi izlenenlere ekle
        const { error } = await supabase
          .from('watched_movies')
          .insert([
            {
              user_id: user.id,
              movie_id: show.id,
              movie_data: {
                title: show.name,
                poster_path: show.poster_path,
                vote_average: show.vote_average,
                media_type: 'tv'
              }
            }
          ]);

        if (error) throw error;
        setIsWatched(true);
      }
    } catch (error) {
      console.error('İzleme durumu güncelleme hatası:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Yükleniyor...</div>
      </div>
    );
  }

  if (!show || !krediler) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Dizi bulunamadı</div>
      </div>
    );
  }

  const yonetmen = krediler.crew.find(person => person.job === "Series Director" || person.job === "Director");
  const basrolOyunculari = krediler.cast.slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <Head>
        <title>{show.name} - Film Öneri</title>
        <meta name="description" content={show.overview} />
      </Head>

      <header className="bg-gray-900 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-[1920px] flex justify-between items-center">
          <h1 
            className="text-2xl font-bold text-white cursor-pointer" 
            onClick={() => router.push('/')}
          >
            Film Öneri
          </h1>
          <div className="flex items-center space-x-4">
            <button className="bg-transparent hover:bg-gray-800 text-white px-4 py-2 rounded-md transition duration-300 border border-gray-600 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Giriş Yap
            </button>
            <button className="bg-accent hover:bg-red-600 text-white px-4 py-2 rounded-md transition duration-300">
              Üye Ol
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-[1920px]">
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl">
          <div className="md:flex">
            <div className="md:w-1/3">
              <div className="relative pb-[150%] md:pb-[150%]">
                <img
                  src={getImageUrl(show.poster_path)}
                  alt={show.name}
                  className="absolute top-0 left-0 w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="md:w-2/3 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-bold text-white">{show.name}</h2>
                {user && (
                  <button
                    onClick={handleWatchClick}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                      isWatched 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <CheckCircleIcon className={`h-5 w-5 ${isWatched ? 'text-white' : 'text-gray-400'}`} />
                    <span>{isWatched ? 'İzlendi' : 'İzledim'}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div 
                  className="flex items-center cursor-pointer hover:opacity-75 transition-opacity"
                  onClick={() => imdbId && window.open(`https://www.imdb.com/title/${imdbId}`, '_blank')}
                  title="IMDb'de görüntüle"
                >
                  <StarIcon className="h-5 w-5 text-yellow-400 mr-1" />
                  <span className="text-white">{show.vote_average.toFixed(1)}</span>
                </div>
                <div className="flex items-center">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mr-1" />
                  <span className="text-white">{new Date(show.first_air_date).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-white">{show.number_of_seasons} Sezon</span>
                </div>
                <div className="flex items-center">
                  <span className="text-white">{show.number_of_episodes} Bölüm</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {show.genres?.map((genre) => (
                  <span
                    key={genre.id}
                    className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Özet</h2>
                <p className="text-gray-300">{show.overview || "Bu dizi için özet bulunmuyor."}</p>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Yapım Ekibi</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {yonetmen && (
                    <div>
                      <h3 className="text-white font-medium">Yönetmen</h3>
                      <p className="text-gray-300">{yonetmen.name}</p>
                    </div>
                  )}
                  <div>
                    <h3 className="text-white font-medium">Başrol Oyuncuları</h3>
                    <div className="text-gray-300">
                      {basrolOyunculari.map((actor, index) => (
                        <span key={actor.id}>
                          {actor.name}{index < basrolOyunculari.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {fragmanlar.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Fragman</h2>
                  <div className="aspect-w-16 aspect-h-9">
                    <iframe
                      src={`https://www.youtube.com/embed/${fragmanlar[0].key}`}
                      title="Dizi Fragmanı"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rounded-lg"
                    ></iframe>
                  </div>
                </div>
              )}

              {show.production_companies?.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">Yapım Şirketleri</h2>
                  <div className="flex flex-wrap gap-4">
                    {show.production_companies.map((company) => (
                      <span key={company.id} className="text-gray-300">
                        {company.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 