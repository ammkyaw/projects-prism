// src/components/login-modal.tsx
import { useState } from 'react';
import { auth } from '@/lib/firebase'; // Import Firebase auth object
import { signInWithEmailAndPassword } from 'firebase/auth'; // Import the sign-in function
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast";
import { XCircle, Eye, EyeOff } from 'lucide-react'; // Import Eye and EyeOff icons

interface LoginModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({ isOpen, onOpenChange, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    setError(null);
    setIsLoading(true);

    try {
        console.log("Attempting login with:", email);
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Firebase login successful");
        toast({ title: "Login Successful", description: "Redirecting..." });
        onLoginSuccess(); // Call the success callback
    } catch (err: any) {
        console.error("Firebase login failed:", err);
        let errorMessage = "An unexpected error occurred. Please try again.";
        // Handle specific Firebase auth errors
        switch (err.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                 errorMessage = "Invalid email or password.";
                 break;
            case 'auth/invalid-email':
                errorMessage = "Please enter a valid email address.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Too many login attempts. Please try again later.";
                break;
             case 'auth/invalid-credential': // More generic error for wrong email/password
                 errorMessage = "Invalid email or password.";
                 break;
            // Add other specific error codes as needed
        }
        setError(errorMessage);
        toast({ variant: "destructive", title: "Login Failed", description: errorMessage });
    } finally {
        setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Login to Project Prism</DialogTitle>
          <DialogDescription>
            Enter your email and password to access your dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLogin}> {/* Add form element */}
          <div className="grid gap-4 py-4">
            {error && (
               <Alert variant="destructive">
                 <XCircle className="h-4 w-4" />
                 <AlertTitle>Error</AlertTitle>
                 <AlertDescription>
                   {error}
                 </AlertDescription>
               </Alert>
             )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="col-span-3"
                required
                autoComplete="email"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4 relative"> {/* Added relative positioning */}
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'} // Toggle input type
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3 pr-10" // Add padding for the icon
                required
                autoComplete="current-password"
              />
              <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground" // Position the icon button
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}> {/* Change to type="submit" */}
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </DialogFooter>
        </form> {/* Close form element */}
      </DialogContent>
    </Dialog>
  );
}
