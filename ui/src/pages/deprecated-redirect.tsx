/**
 * Deprecated Redirect Page
 *
 * Shows a friendly deprecation notice for removed routes and
 * auto-redirects users to the new location after a short delay.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeprecatedRedirectPageProps {
  target: string;
  title: string;
}

const REDIRECT_DELAY_MS = 3000;

export function DeprecatedRedirectPage({ target, title }: DeprecatedRedirectPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(target, { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigate, target]);

  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Page Moved</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            The <strong>{title}</strong> page has been moved as part of a dashboard update.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">New location</p>
              <p className="text-xs text-muted-foreground">
                You will be redirected automatically in a few seconds.
              </p>
            </div>
          </div>

          <Button className="w-full gap-2" onClick={() => navigate(target, { replace: true })}>
            Go to new page now
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
