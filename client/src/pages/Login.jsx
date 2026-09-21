import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import PageTransition from '@/components/PageTransition';
import coverImage from '@/assets/cover.jpg';
import logo from '@/assets/logo.png';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.dispatchEvent(new Event('auth-change'));
      navigate('/courts');
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* Left panel - cover image + placeholder info text */}
        <div
          className="hidden md:flex relative items-end p-12 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          <div className="relative z-10 text-white space-y-4">
            <p className="text-sm uppercase tracking-wider text-orange-400">
              San Juan City
            </p>
            <h2 className="text-3xl font-bold leading-tight">
              Barangay Court Reservations
            </h2>
            <p className="text-sm text-white/80 max-w-md leading-relaxed">
              A welcoming community where residents can stay active, connect with neighbors, and easily reserve barangay courts for sports and recreation.

            </p>
          </div>
        </div>

        {/* Right panel - form */}
        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center mb-6">
              <img src={logo} alt="CourtConnect" className="w-12 h-12 rounded-lg object-cover mb-3" />
              <h1 className="text-xl font-extrabold tracking-tight">COURTCONNECT</h1>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                San Juan Court Reservations
              </p>
            </div>

            <h2 className="text-xl font-bold text-center mb-1">Sign In</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Sign in to reserve barangay courts
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase text-muted-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs uppercase text-muted-foreground">
                    Password
                  </Label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={setRememberMe}
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal">
                  Keep me logged in
                </Label>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? (
                  'Signing in...'
                ) : (
                  <>
                    Access Portal <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary font-semibold underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default Login;