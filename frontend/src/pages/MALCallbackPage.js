import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function MALCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleMALCallback } = useAuth();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      
      if (!code) {
        setStatus('error');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      const success = await handleMALCallback(code);
      
      if (success) {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setStatus('error');
        setTimeout(() => navigate('/'), 2000);
      }
    };

    processCallback();
  }, [searchParams, handleMALCallback, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <h2 className="text-xl font-bold mb-2">Authenticating...</h2>
                <p className="text-muted-foreground">
                  Connecting to your MyAnimeList account
                </p>
              </>
            )}
            
            {status === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">Success!</h2>
                <p className="text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">Authentication Failed</h2>
                <p className="text-muted-foreground">
                  Redirecting to login page...
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
