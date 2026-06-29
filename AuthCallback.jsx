import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/FirebaseAuthContext';

interface AuthCallbackProps {
  workerUrl: string;
  tokenEndpoint?: string; // Optional custom token endpoint
  onSuccess?: () => void;
  onFailure?: (error: string) => void;
}

export const AuthCallback: React.FC<AuthCallbackProps> = ({ 
  workerUrl, 
  tokenEndpoint = '/api/oauth/token', // Default endpoint
  onSuccess = () => {}, 
  onFailure = () => {} 
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('Processing authentication callback...');
  const { setAuthTokens } = useAuth();

  useEffect(() => {
    let isMounted = true;
    
    // Timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        setStatus('Authentication timeout');
        onFailure('Request timed out');
      }
    }, 10000);
    
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Handle OAuth provider errors
      const error = urlParams.get('error');
      if (error) {
        const errorDesc = urlParams.get('error_description') || error;
        if (isMounted) {
          setStatus(`Authentication failed: ${errorDesc}`);
          onFailure(errorDesc);
          setTimeout(() => navigate('/login?error=auth_failed', { replace: true }), 2000);
        }
        return;
      }
      
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      const savedVerifier = sessionStorage.getItem('oauth_code_verifier');
      const savedState = sessionStorage.getItem('oauth_state');

      // Clear short-lived storage tracking items immediately
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_state');

      if (!code || !state) {
        const errorMsg = 'Authentication failed: Missing parameters in URL.';
        if (isMounted) {
          setStatus(errorMsg);
          onFailure(errorMsg);
          setTimeout(() => navigate('/login?error=missing_params', { replace: true }), 2000);
        }
        return;
      }

      if (state !== savedState || !savedVerifier) {
        const errorMsg = 'Authentication failed: CSRF state validation mismatch.';
        if (isMounted) {
          setStatus(errorMsg);
          onFailure(errorMsg);
          setTimeout(() => navigate('/login?error=csrf', { replace: true }), 2000);
        }
        return;
      }

      try {
        if (isMounted) setStatus('Exchanging code via Cloudflare Worker...');
        
        // Construct the full token endpoint URL
        const tokenUrl = `${workerUrl}${tokenEndpoint}`;
        
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, code_verifier: savedVerifier }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const tokenData = await response.json();
        
        // Save tokens straight to secure React memory
        if (setAuthTokens) {
          setAuthTokens(tokenData);
        }
        
        if (isMounted) {
          setStatus('Authentication successful! Redirecting...');
          onSuccess();
          // Redirect to dashboard
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 500);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (isMounted) {
          setStatus(`Authentication server error: ${errorMessage}`);
          onFailure(errorMessage);
          setTimeout(() => navigate('/login?error=token_exchange', { replace: true }), 2000);
        }
      }
    };

    handleCallback();
    
    return () => { 
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [workerUrl, tokenEndpoint, setAuthTokens, onSuccess, onFailure, navigate]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      fontFamily: 'sans-serif', 
      background: '#121212' 
    }}>
      <div style={{ 
        padding: '30px', 
        background: '#1e1e1e', 
        color: '#ffffff', 
        borderRadius: '8px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
        textAlign: 'center' 
      }}>
        {status.includes('Exchanging') && (
          <div style={{ 
            width: 30, 
            height: 30, 
            border: '3px solid #333', 
            borderTop: '3px solid #4af', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 12px'
          }} />
        )}
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>{status}</p>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};