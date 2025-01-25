import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../lib/supabase';
import { UserIcon, EnvelopeIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function UyeOl() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastAttempt, setLastAttempt] = useState(0);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Rate limiting kontrolü
    const now = Date.now();
    if (now - lastAttempt < 2000) {
      setError('Lütfen birkaç saniye bekleyip tekrar deneyin');
      return;
    }
    setLastAttempt(now);

    setLoading(true);

    // Doğrulama kontrolleri
    if (!formData.name.trim()) {
      setError('Ad Soyad alanı zorunludur');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('E-posta alanı zorunludur');
      setLoading(false);
      return;
    }

    if (!formData.password) {
      setError('Şifre alanı zorunludur');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Şifreler eşleşmiyor');
      setLoading(false);
      return;
    }

    try {
      // Supabase ile kayıt ve otomatik giriş işlemi
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name
          }
        }
      });

      if (signUpError) {
        if (signUpError.message.includes('For security purposes')) {
          throw new Error('Çok fazla deneme yapıldı. Lütfen birkaç saniye bekleyin.');
        }
        throw signUpError;
      }

      // Manuel olarak profil oluştur
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: signUpData.user.id,
            full_name: formData.name,
            email: formData.email
          }
        ]);

      if (profileError) {
        console.error('Profil oluşturma hatası:', profileError);
        throw new Error('Profil oluşturulurken bir hata oluştu');
      }

      // Otomatik giriş yap
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        throw signInError;
      }

      // Başarılı kayıt ve giriş sonrası ana sayfaya yönlendir
      router.push('/');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>Üye Ol - Film Öneri</title>
      </Head>

      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 
            className="text-2xl font-bold text-white cursor-pointer"
            onClick={() => router.push('/')}
          >
            Film Öneri
          </h1>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Hesap Oluştur
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Zaten hesabınız var mı?{' '}
            <button
              onClick={() => router.push('/giris')}
              className="font-medium text-accent hover:text-red-500 transition"
            >
              Giriş Yap
            </button>
          </p>
        </div>

        <div className="bg-gray-800 py-8 px-4 shadow-xl rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white">
                Ad Soyad
              </label>
              <div className="mt-1 relative">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-700 text-white focus:outline-none focus:ring-accent focus:border-accent"
                  placeholder="John Doe"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white">
                E-posta
              </label>
              <div className="mt-1 relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-700 text-white focus:outline-none focus:ring-accent focus:border-accent"
                  placeholder="ornek@email.com"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white">
                Şifre
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pl-10 pr-10 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-700 text-white focus:outline-none focus:ring-accent focus:border-accent"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-white">
                Şifre Tekrar
              </label>
              <div className="mt-1 relative">
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pl-10 pr-10 border border-gray-600 rounded-md shadow-sm placeholder-gray-400 bg-gray-700 text-white focus:outline-none focus:ring-accent focus:border-accent"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 text-red-200 px-4 py-2 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-accent hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Kaydediliyor...' : 'Üye Ol'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 