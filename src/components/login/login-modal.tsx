
// src/components/login-modal.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase'; // Import Firebase auth and db objects
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore'; // Firestore imports
import type { UserProfile } from '@/types/sprint-data'; // Import UserProfile type
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({
  isOpen,
  onOpenChange,
  onLoginSuccess,
}: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen) {
      setUsername('');
      setPassword('');
      setError(null);
      setIsLoading(false);
      setShowPassword(false);
    }
    setPrevIsOpen(isOpen);
  }, [isOpen, prevIsOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      console.log('Attempting login with username:', username);

      // 1. Query Firestore for the user profile based on username
      const userProfilesRef = collection(db, 'userProfiles');
      const q = query(
        userProfilesRef,
        where('username', '==', username.trim()),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Invalid username or password.');
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Invalid username or password.',
        });
        setIsLoading(false);
        return;
      }

      // Assuming username is unique, there should be at most one document
      const userProfileDoc = querySnapshot.docs[0];
      const userProfileData = userProfileDoc.data() as UserProfile;
      const emailToAuth = userProfileData.email;

      if (!emailToAuth) {
        // This case should ideally not happen if data is consistent
        console.error('Email not found for username:', username);
        setError('User profile incomplete. Please contact support.');
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'User profile incomplete.',
        });
        setIsLoading(false);
        return;
      }

      // 2. Use the retrieved email to sign in with Firebase Auth
      console.log('Authenticating with Firebase Auth using email:', emailToAuth);
      await signInWithEmailAndPassword(auth, emailToAuth, password);
      console.log('Firebase login successful for email:', emailToAuth);
      onLoginSuccess();
      // isLoading will remain true as the modal will unmount on success
    } catch (err: any) {
      console.error('Login process failed:', err);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      // Firebase auth errors
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found': // This would apply to the email, not the username
          case 'auth/wrong-password':
            errorMessage = 'Invalid username or password.';
            break;
          case 'auth/invalid-email': // Should be caught earlier if email format from profile is bad
            errorMessage = 'Invalid email format in profile.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid username or password.';
            break;
          // Firestore specific errors (less likely here but good to be aware)
          case 'permission-denied':
            errorMessage =
              'Permission denied. Check Firestore security rules for userProfiles.';
            break;
          case 'unavailable':
            errorMessage =
              'Could not connect to the database. Please check your internet connection.';
            break;
        }
      } else if (err.message.includes('Failed to fetch')) {
        // Network error during Firestore query
        errorMessage =
          'Network error. Please check your internet connection and try again.';
      }

      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isLoading) {
          onOpenChange(open);
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Login to Projects Prism</DialogTitle>
          <DialogDescription>
            Enter your username and password to access your dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin}>
          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username-login" className="text-right">
                Username
              </Label>
              <Input
                id="username-login"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-3"
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
            <div className="relative grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password-login" className="text-right">
                Password
              </Label>
              <Input
                id="password-login"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3 pr-10"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
