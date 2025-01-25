import { supabase } from '../lib/supabase';

// Kullanıcının izleme geçmişini analiz et
export const analyzeWatchHistory = async (userId) => {
  try {
    // İzlenen içerikleri getir
    const { data: watchedContent, error } = await supabase
      .from('watched_movies')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    // Tür istatistiklerini hesapla
    const genreStats = {};
    let totalGenres = 0;

    watchedContent.forEach(content => {
      // Film/dizi türlerini al ve istatistikleri hesapla
      const genres = content.movie_data.genres || [];
      genres.forEach(genre => {
        if (!genreStats[genre.id]) {
          genreStats[genre.id] = {
            id: genre.id,
            name: genre.name,
            count: 0,
            percentage: 0
          };
        }
        genreStats[genre.id].count++;
        totalGenres++;
      });
    });

    // Yüzdeleri hesapla
    Object.values(genreStats).forEach(genre => {
      genre.percentage = (genre.count / totalGenres) * 100;
    });

    // Önce mevcut kaydı kontrol et
    const { data: existingPrefs } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingPrefs) {
      // Kayıt varsa güncelle
      const { error: updateError } = await supabase
        .from('user_preferences')
        .update({
          genre_stats: genreStats,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    } else {
      // Kayıt yoksa yeni ekle
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert([{
          user_id: userId,
          genre_stats: genreStats,
          updated_at: new Date().toISOString()
        }]);

      if (insertError) throw insertError;
    }

    return {
      success: true,
      genreStats: Object.values(genreStats).sort((a, b) => b.percentage - a.percentage)
    };

  } catch (error) {
    console.error('İzleme geçmişi analiz hatası:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Kullanıcının tür tercihlerini getir
export const getUserPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('genre_stats')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data.genre_stats;
  } catch (error) {
    console.error('Kullanıcı tercihleri getirme hatası:', error);
    return {};
  }
};

// İçeriğin kullanıcı tercihlerine göre puanını hesapla
export const calculateContentScore = (content, userPreferences) => {
  let score = 0;
  let totalWeight = 0;

  // Temel puan (TMDB puanı)
  const baseScore = content.vote_average * 10; // 0-100 arası
  
  // Tür puanı
  content.genre_ids?.forEach(genreId => {
    const genrePref = userPreferences[genreId];
    if (genrePref) {
      const weight = genrePref.percentage / 100; // 0-1 arası
      score += baseScore * weight;
      totalWeight += weight;
    }
  });

  // Popülerlik puanı (0-20 arası)
  const popularityScore = Math.min(content.popularity / 5, 20);
  
  // Yayın tarihi puanı (son 2 yıl içindeyse bonus)
  const releaseDate = new Date(content.release_date || content.first_air_date || Date.now());
  const yearDiff = (new Date().getFullYear() - releaseDate.getFullYear());
  const recencyScore = yearDiff <= 2 ? 10 : Math.max(0, 10 - (yearDiff - 2) * 2);

  // Ağırlıklı ortalama
  const weightedScore = totalWeight > 0 ? score / totalWeight : baseScore;
  
  // Final skor: Ağırlıklı ortalama (%60) + Popülerlik (%20) + Yenilik (%20)
  const finalScore = (weightedScore * 0.6) + (popularityScore * 0.2) + (recencyScore * 0.2);

  return {
    score: finalScore,
    details: {
      baseScore,
      genreScore: totalWeight > 0 ? score / totalWeight : 0,
      popularityScore,
      recencyScore
    }
  };
};

// İçerikleri kullanıcı tercihlerine göre sırala ve çeşitlendir
export const rankContentByPreference = async (contents, userPreferences) => {
  // Puanları hesapla
  const scoredContents = contents.map(content => ({
    ...content,
    score: calculateContentScore(content, userPreferences)
  }));

  // İçerikleri farklı gruplara ayır
  const highlyRated = []; // Yüksek puanlı
  const trending = [];    // Trend olanlar
  const discovery = [];   // Keşif için
  const recent = [];      // Yeni çıkanlar

  scoredContents.forEach(content => {
    const releaseDate = new Date(content.release_date || content.first_air_date || Date.now());
    const monthsOld = (new Date() - releaseDate) / (1000 * 60 * 60 * 24 * 30);

    // Son 3 ay içinde çıkanlar
    if (monthsOld <= 3) {
      recent.push(content);
    }
    // Popülerlik skoru yüksek olanlar
    else if (content.score.details.popularityScore > 15) {
      trending.push(content);
    }
    // Yüksek puan alanlar
    else if (content.score.details.baseScore > 75) {
      highlyRated.push(content);
    }
    // Geri kalanlar keşif için
    else {
      discovery.push(content);
    }
  });

  // Her gruptan belirli sayıda içerik seç
  const selectRandomly = (array, count) => {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  // Toplam 14 içerik için dağılım:
  // 4 yüksek puanlı
  // 4 trend
  // 3 keşif
  // 3 yeni çıkan
  const selected = [
    ...selectRandomly(highlyRated, 4),
    ...selectRandomly(trending, 4),
    ...selectRandomly(discovery, 3),
    ...selectRandomly(recent, 3)
  ];

  // Eğer herhangi bir kategoride yeterli içerik yoksa, diğerlerinden tamamla
  if (selected.length < 14) {
    const remaining = scoredContents
      .filter(content => !selected.includes(content))
      .sort(() => Math.random() - 0.5)
      .slice(0, 14 - selected.length);
    
    selected.push(...remaining);
  }

  // Son bir kez karıştır
  return selected.sort(() => Math.random() - 0.5);
}; 