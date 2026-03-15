// src/components/login/login-modal.tsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '@/types/sprint-data';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { XCircle, Eye, EyeOff, Loader2, UserPlus, LogIn, AlertCircle } from 'lucide-react';

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

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
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
    }
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const userProfilesRef = collection(db, 'userProfiles');
      const q = query(userProfilesRef, where('username', '==', loginUsername.trim().toLowerCase()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('User not found.');
      }

      const userProfile = querySnapshot.docs[0].data() as UserProfile;
      const email = userProfile.email;

      await signInWithEmailAndPassword(auth, email, loginPassword);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Login Error:", err);
      let message = 'Invalid username or password.';
      if (err.code === 'auth/too-many-requests') message = 'Too many attempts. Try again later.';
      setError(message);
      toast({ variant: 'destructive', title: 'Login Failed', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const cleanUsername = signupUsername.trim().toLowerCase();
      const userProfilesRef = collection(db, 'userProfiles');
      const q = query(userProfilesRef, where('username', '==', cleanUsername), limit(1));
      const usernameSnapshot = await getDocs(q);

      if (!usernameSnapshot.empty) {
        throw new Error('Username is already taken.');
      }

      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail.trim(), signupPassword);
      const user = userCredential.user;

      if (user) {
        await addDoc(collection(db, 'userProfiles'), {
          uid: user.uid,
          username: cleanUsername,
          email: signupEmail.trim(),
          createdAt: serverTimestamp(),
        });

        toast({ title: 'Welcome to Prism!', description: 'Your account has been created.' });
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error("Signup Error:", err);
      let message = err.message || 'Signup failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') message = 'Email already registered.';
      setError(message);
      toast({ variant: 'destructive', title: 'Signup Error', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onOpenChange(open)}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Projects Prism Account
          </DialogTitle>
          <DialogDescription>
            {activeTab === 'login' ? 'Access your Agile dashboards.' : 'Join the Projects Prism workspace.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="mt-4 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" disabled={isLoading}><LogIn className="mr-2 h-4 w-4" />Login</TabsTrigger>
            <TabsTrigger value="signup" disabled={isLoading}><UserPlus className="mr-2 h-4 w-4" />Signup</TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Account Issue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="login" className="space-y-4 pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g. agile_master"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="relative space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-8 h-7 w-7 text-muted-foreground"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</> : 'Enter Dashboard'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 pt-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <Input
                  id="signup-username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="Unique workspace handle"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email Address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="work@company.com"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-8 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                  >
                    {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="relative space-y-2">
                  <Label htmlFor="signup-confirm">Confirm</Label>
                  <Input
                    id="signup-confirm"
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-8 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                  >
                    {showSignupConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...</> : 'Create Free Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" className="w-full" disabled={isLoading}>Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
