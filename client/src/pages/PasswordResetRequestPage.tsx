import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../providers/TrpcProvider';

function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError('');
    },
    onError: (err) => {
      setError(err.message);
      setSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    requestResetMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded relative">
            <strong className="font-bold">Success!</strong>
            <span className="block sm:inline"> If an account with that email exists, we've sent you a password reset link.</span>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={requestResetMutation.isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {requestResetMutation.isLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center">
          <Link
            to="/login"
            className="font-medium text-indigo-400 hover:text-indigo-300"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PasswordResetRequestPage; 