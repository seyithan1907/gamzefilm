const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'; // Metin benzerliği için kullanacağımız model

// İzleme geçmişinden film/dizi açıklamalarını çıkar
const extractContentDescriptions = (watchedContent) => {
  return watchedContent.map(item => {
    const data = item.movie_data;
    return {
      id: item.movie_id,
      description: `${data.title}. ${data.overview || ''}. ${(data.genres || []).join(', ')}`,
      rating: data.vote_average
    };
  });
};

// İçerik benzerliğini hesapla
const calculateContentSimilarity = async (content, watchedContent) => {
  try {
    const watchedDescriptions = extractContentDescriptions(watchedContent);
    
    // İçerik açıklamasını oluştur
    const contentDescription = `${content.title || content.name}. ${content.overview || ''}. ${(content.genres || []).join(', ')}`;

    // HuggingFace API'sine gönderilecek veri
    const payload = {
      inputs: {
        source_sentence: contentDescription,
        sentences: watchedDescriptions.map(item => item.description)
      }
    };

    // HuggingFace API'sini çağır
    const response = await fetch(`${HUGGINGFACE_API_URL}/${MODEL_NAME}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('HuggingFace API hatası');
    }

    const similarities = await response.json();

    // En yüksek benzerlik skorunu bul
    const maxSimilarity = Math.max(...similarities);
    
    // İzlenen içeriklerin ortalama puanını hesapla
    const averageRating = watchedDescriptions.reduce((acc, item) => acc + item.rating, 0) / watchedDescriptions.length;

    // Benzerlik ve puan bazlı ağırlıklı skor hesapla
    // Benzerlik: %70, Puan: %30
    const score = (maxSimilarity * 0.7) + ((content.vote_average / 10) * 0.3);

    console.log('AI Skor Hesaplama:', {
      content: content.title || content.name,
      similarity: maxSimilarity,
      rating: content.vote_average,
      finalScore: score
    });

    return score;
  } catch (error) {
    console.error('Benzerlik hesaplama hatası:', error);
    return 0;
  }
};

// İçerikleri yapay zeka ile sırala
export const rankContentWithAI = async (contents, watchedContent) => {
  try {
    console.log('AI Sıralama başladı:', {
      contentCount: contents.length,
      watchedCount: watchedContent.length
    });

    // Her içerik için benzerlik skoru hesapla
    const contentWithScores = await Promise.all(
      contents.map(async (content) => {
        const score = await calculateContentSimilarity(content, watchedContent);
        return { ...content, aiScore: score };
      })
    );

    // Skorlara göre sırala
    const rankedContent = contentWithScores
      .sort((a, b) => b.aiScore - a.aiScore)
      .map(({ aiScore, ...content }) => content);

    console.log('AI Sıralama tamamlandı');

    return rankedContent;
  } catch (error) {
    console.error('AI sıralama hatası:', error);
    return contents;
  }
}; 