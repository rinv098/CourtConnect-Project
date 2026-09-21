import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageTransition from '@/components/PageTransition';
import coverImage from '@/assets/cover.jpg';
import logo from '@/assets/logo.png';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();
      setLoading(false);

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      navigate('/login');
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
        {/* Left panel - cover image */}
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
              Account Security Portal
            </p>
          </div>
        </div>

        {/* Right panel - form centered */}
        <div className="flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center mb-6">
              <img src={logo} alt="CourtConnect" className="w-12 h-12 rounded-lg object-cover mb-3" />
              <h1 className="text-xl font-extrabold tracking-tight">COURTCONNECT</h1>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                San Juan Court Reservations
              </p>
            </div>

            <h2 className="text-xl font-bold text-center mb-1">Set a New Password</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Please enter your new password below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-xs uppercase text-muted-foreground">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                    minLength={6}
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

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? (
                  'Saving...'
                ) : (
                  <>
                    Reset Password <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground mt-6">
              <Link to="/login" className="text-primary font-semibold underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default ResetPassword;