import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { trpc } from '../providers/TrpcProvider';

function UserSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'email' | 'password'>('email');
  
  // Email change form
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    currentPassword: '',
  });
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const changeEmailMutation = trpc.user.changeEmail.useMutation({
    onSuccess: () => {
      setEmailSuccess(true);
      setEmailError('');
      setEmailForm({ newEmail: '', currentPassword: '' });
      setTimeout(() => setEmailSuccess(false), 3000);
    },
    onError: (err) => {
      setEmailError(err.message);
      setEmailSuccess(false);
    },
  });

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError('');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err) => {
      setPasswordError(err.message);
      setPasswordSuccess(false);
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    changeEmailMutation.mutate(emailForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailForm({
      ...emailForm,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>
        
        {/* User Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
          <div className="space-y-2">
            <p className="text-gray-300">
              <span className="font-medium">Username:</span> {user?.username}
            </p>
            <p className="text-gray-300">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-4 px-6 text-center font-medium ${
                activeTab === 'email'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Change Email
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-4 px-6 text-center font-medium ${
                activeTab === 'password'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              Change Password
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'email' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Change Email Address</h3>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="newEmail" className="block text-sm font-medium text-gray-300 mb-2">
                      New Email Address
                    </label>
                    <input
                      type="email"
                      id="newEmail"
                      name="newEmail"
                      value={emailForm.newEmail}
                      onChange={handleEmailChange}
                      required
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter new email address"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="currentPasswordEmail" className="block text-sm font-medium text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPasswordEmail"
                      name="currentPassword"
                      value={emailForm.currentPassword}
                      onChange={handleEmailChange}
                      required
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter current password"
                    />
                  </div>

                  {emailError && (
                    <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
                      {emailError}
                    </div>
                  )}

                  {emailSuccess && (
                    <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded">
                      Email address updated successfully!
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={changeEmailMutation.isLoading}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {changeEmailMutation.isLoading ? 'Updating...' : 'Update Email'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'password' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="currentPasswordPassword" className="block text-sm font-medium text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPasswordPassword"
                      name="currentPassword"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      required
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter current password"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      required
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter new password"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      required
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Confirm new password"
                    />
                  </div>

                  {passwordError && (
                    <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
                      {passwordError}
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded">
                      Password updated successfully!
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={changePasswordMutation.isLoading}
                    className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {changePasswordMutation.isLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserSettingsPage; 