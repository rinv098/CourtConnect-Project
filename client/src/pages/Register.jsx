import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PageTransition from '@/components/PageTransition';
import coverImage from '@/assets/cover.jpg';

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    setError('');

    if (!agreeTerms || !agreePrivacy) {
      setError('Please agree to the Terms of Use and Privacy Notice.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/send-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send code');
        return;
      }

      setStep('verify');
    } catch (err) {
      console.error(err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            code,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      navigate('/login');
    } catch (err) {
      console.error(err);
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition>
      <div
        className="min-h-screen flex items-center justify-center bg-cover bg-center relative px-4"
        style={{ backgroundImage: `url(${coverImage})` }}
      >
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 w-full max-w-sm">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-2xl">
                {step === 'form' ? 'Create an Account' : 'Check Your Email'}
              </CardTitle>

              <p className="text-sm text-muted-foreground">
                {step === 'form'
                  ? 'Sign up to reserve barangay courts'
                  : `We sent a 6-digit code to ${email}`}
              </p>
            </CardHeader>

            <CardContent>
              {step === 'form' ? (
                <form onSubmit={handleSendCode} className="space-y-4">

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      Confirm Password
                    </Label>

                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-3 pt-1">

                    <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />

                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          className="underline text-primary"
                          onClick={() =>
                            alert(
                              'Terms of Use: CourtConnect is intended for legitimate barangay court reservations and community recreation. Users are responsible for providing accurate information and following court rules.'
                            )
                          }
                        >
                          Terms of Use
                        </button>
                        .
                      </span>
                    </label>

                    <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreePrivacy}
                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />

                      <span>
                        I acknowledge the{' '}
                        <button
                          type="button"
                          className="underline text-primary"
                          onClick={() =>
                            alert(
                              'Privacy Notice: CourtConnect collects information such as your name and email to create and manage your account, verify your identity, and process court reservations.'
                            )
                          }
                        >
                          Privacy Notice
                        </button>
                        .
                      </span>
                    </label>

                  </div>

                  {error && (
                    <p className="text-sm text-red-500">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading
                      ? 'Sending code...'
                      : 'Send Verification Code'}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="underline text-primary"
                    >
                      Log in
                    </Link>
                  </p>

                </form>
              ) : (
                <form
                  onSubmit={handleVerifyAndRegister}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="code">
                      Verification Code
                    </Label>

                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={6}
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-500">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading
                      ? 'Verifying...'
                      : 'Verify & Create Account'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="text-xs text-muted-foreground underline w-full text-center"
                  >
                    Wrong email? Go back
                  </button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

export default Register;