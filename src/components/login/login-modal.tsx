
// src/components/login/login-modal.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase'; // Import Firebase auth and db objects
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore'; // Firestore imports
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Import Tabs
import { useToast } from '@/hooks/use-toast';
import { XCircle, Eye, EyeOff, Loader2, UserPlus, LogIn } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  // Login states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup states
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);


  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen) {
      // Reset all fields when modal opens
      setLoginUsername('');
      setLoginPassword('');
      setSignupUsername('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setError(null);
      setIsLoading(false);
      setShowLoginPassword(false);
      setShowSignupPassword(false);
      setShowSignupConfirmPassword(false);
      setActiveTab('login'); // Default to login tab
    }
    setPrevIsOpen(isOpen);
  }, [isOpen, prevIsOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const userProfilesRef = collection(db, 'userProfiles');
      const q = query(
        userProfilesRef,
        where('username', '==', loginUsername.trim()),
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

      const userProfileDoc = querySnapshot.docs[0];
      const userProfileData = userProfileDoc.data() as UserProfile;
      const emailToAuth = userProfileData.email;

      if (!emailToAuth) {
        setError('User profile incomplete. Please contact support.');
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'User profile incomplete.',
        });
        setIsLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, emailToAuth, loginPassword);
      onLoginSuccess();
    } catch (err: any) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Invalid username or password.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email format in profile.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many login attempts. Please try again later.';
            break;
          case 'permission-denied':
            errorMessage =
              'Permission denied. Check Firestore security rules.';
            break;
          case 'unavailable':
            errorMessage =
              'Could not connect to the database. Check internet connection.';
            break;
        }
      } else if (err.message?.includes('Failed to fetch')) {
        errorMessage =
          'Network error. Please check your internet connection.';
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: 'Passwords do not match.',
      });
      setIsLoading(false);
      return;
    }

    try {
      // Check username uniqueness
      const userProfilesRef = collection(db, 'userProfiles');
      const q = query(userProfilesRef, where('username', '==', signupUsername.trim()), limit(1));
      const usernameSnapshot = await getDocs(q);

      if (!usernameSnapshot.empty) {
        setError('Username already taken. Please choose another.');
        toast({
          variant: 'destructive',
          title: 'Signup Failed',
          description: 'Username already taken.',
        });
        setIsLoading(false);
        return;
      }

      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail.trim(), signupPassword);
      const user = userCredential.user;

      // Store user profile in Firestore
      if (user) {
        await addDoc(collection(db, 'userProfiles'), {
          username: signupUsername.trim(),
          email: signupEmail.trim(),
          // You might want to add a uid field: user.uid
        });

        toast({
          title: 'Signup Successful!',
          description: 'You are now logged in.',
        });
        onLoginSuccess(); // Firebase auto-logs in, so proceed
      } else {
        throw new Error('User creation failed unexpectedly.');
      }
    } catch (err: any) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already in use.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters.';
            break;
           case 'permission-denied':
            errorMessage =
              'Permission denied. Check Firestore security rules for userProfiles.';
            break;
          case 'unavailable':
            errorMessage =
              'Could not connect to the database. Check internet connection.';
            break;
        }
      } else if (err.message?.includes('Failed to fetch')) {
        errorMessage =
          'Network error. Please check your internet connection.';
      }
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: errorMessage,
      });
      setIsLoading(false);
    }
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Projects Prism Account</DialogTitle>
          <DialogDescription>
            {activeTab === 'login'
              ? 'Enter your username and password to access your dashboard.'
              : 'Create a new account to get started.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" disabled={isLoading}>
              <LogIn className="mr-2 h-4 w-4" /> Login
            </TabsTrigger>
            <TabsTrigger value="signup" disabled={isLoading}>
              <UserPlus className="mr-2 h-4 w-4" /> Signup
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="login">
            <form onSubmit={handleLogin}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="login-username" className="text-right">
                    Username
                  </Label>
                  <Input
                    id="login-username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="col-span-3"
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
                <div className="relative grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="login-password" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
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
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showLoginPassword ? (
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
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-username" className="text-right">
                    Username
                  </Label>
                  <Input
                    id="signup-username"
                    type="text"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    className="col-span-3"
                    required
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="col-span-3"
                    required
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
                 <div className="relative grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-password" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="col-span-3 pr-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showSignupPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="relative grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="signup-confirm-password" className="text-right">
                    Confirm
                  </Label>
                  <Input
                    id="signup-confirm-password"
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className="col-span-3 pr-10"
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                   <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    aria-label={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                    disabled={isLoading}
                  >
                    {showSignupConfirmPassword ? (
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
                      Signing up...
                    </>
                  ) : (
                    'Signup'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

