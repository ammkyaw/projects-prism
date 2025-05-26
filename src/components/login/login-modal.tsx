// src/components/login-modal.tsx
import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase'; // Import Firebase auth object
import { signInWithEmailAndPassword } from 'firebase/auth'; // Import the sign-in function
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
import { XCircle, Eye, EyeOff, Loader2 } from 'lucide-react'; // Import Eye, EyeOff, and Loader2 icons

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
  const [username, setUsername] = useState(''); // Changed from email to username
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen) {
      // Dialog is opening
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
      console.log('Attempting login with username (as email):', username);
      // Firebase still expects an email for signInWithEmailAndPassword
      await signInWithEmailAndPassword(auth, username, password);
      console.log('Firebase login successful');
      // Toast will be shown by the parent upon successful redirection or data load
      onLoginSuccess();
    } catch (err: any) {
      console.error('Firebase login failed:', err);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid username or password.';
          break;
        case 'auth/invalid-email': // This error might still occur if the "username" isn't a valid email format
          errorMessage = 'Please enter a valid username (email format).';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many login attempts. Please try again later.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid username or password.';
          break;
      }
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
      });
      setIsLoading(false); // Set loading to false only on error
    }
    // Do not set isLoading to false on success here, as the modal will unmount
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isLoading) {
          // Prevent closing if loading
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
                type="text" // Changed from email to text, but Firebase expects email format
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-3"
                required
                autoComplete="username" // Changed from email
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
