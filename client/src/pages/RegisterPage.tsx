import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trpc } from '../providers/TrpcProvider';
import { useAuthStore } from '../stores/authStore';

function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      login(data.user, data.token, data.refreshToken);
      navigate('/lobby');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    registerMutation.mutate({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="card">
          <h2 className="text-3xl font-bold text-center mb-8">Register</h2>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-4 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="input w-full"
                required
                minLength={3}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input w-full"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="input w-full"
                required
              />
            </div>

            <button
              type="submit"
              disabled={registerMutation.isLoading}
              className="btn btn-primary w-full"
            >
              {registerMutation.isLoading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <p className="mt-4 text-center text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-game-accent hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage; 