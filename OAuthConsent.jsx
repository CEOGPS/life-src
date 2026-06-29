import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/FirebaseAuthContext";

const WORKER_URL = "https://lifeos1.ceogps.workers.dev";
const SUPABASE_URL = "https://mhvcdstgkyplhzjptgfr.supabase.co";

// These are the Supabase Auth endpoints you provided for the OAuth provider flow.
// Use them for client registration (admin), authorization details, consent decision, token exchange, and discovery.

export default function OAuthConsent() {
  const { user, isAuthenticated } = useAuth();
  const [params, setParams] = useState({});
  const [clientInfo, setClientInfo] = useState(null);
  const [scopes, setScopes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authzId, setAuthzId] = useState(null); // from Supabase authorization flow

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const parsed = {
      client_id: urlParams.get("client_id"),
      redirect_uri: urlParams.get("redirect_uri"),
      scope: urlParams.get("scope") || "profile",
      state: urlParams.get("state"),
      response_type: urlParams.get("response_type") || "code",
      code_challenge: urlParams.get("code_challenge"),
      code_challenge_method: urlParams.get("code_challenge_method"),
      authz_id: urlParams.get("authz_id") || urlParams.get("authorization_id"),
    };
    setParams(parsed);
    setAuthzId(parsed.authz_id);

    // If we have an authz_id from Supabase, fetch rich details for the consent UI
    if (parsed.authz_id) {
      fetchSupabaseAuthorizationDetails(parsed.authz_id).then(details => {
        if (details) {
          setClientInfo(details.client || { name: "Connected App", description: "Requesting access to your LifeOS account." });
          const requestedScopes = details.requested_scopes || (parsed.scope || "profile").split(" ");
          setScopes(requestedScopes);
        }
      }).catch(() => {
        // fallback
        if (parsed.client_id) fetchClientInfo(parsed.client_id).then(setClientInfo);
      });
    } else if (parsed.client_id) {
      fetchClientInfo(parsed.client_id).then(setClientInfo);
    }

    const scopeList = (parsed.scope || "").split(" ").filter(Boolean);
    if (!parsed.authz_id) {
      setScopes(scopeList.length ? scopeList : ["profile", "read_data"]);
    }

    setLoading(false);
  }, []);

  async function fetchSupabaseAuthorizationDetails(authorizationId) {
    // Use service role or appropriate token in production (via worker proxy recommended for security)
    // For demo, this may require additional auth header from the session.
    const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}`, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '', // or service role via secure call
      },
    });
    if (!res.ok) throw new Error('Failed to fetch authorization details');
    return res.json();
  }

  async function fetchClientInfo(clientId) {
    if (clientId === 'da025257-10ff-438c-8840-f29fc5f147b2') {
      return {
        name: 'LifeOS1',
        description: 'LifeOS1 application requesting access to your data and features.',
        website: 'https://lifeos1.pages.dev'
      };
    }
    // Fallback or call your worker /api/oauth/client-info
    try {
      const res = await fetch(`${WORKER_URL}/api/oauth/client-info?client_id=${clientId}`);
      if (res.ok) return res.json();
    } catch {}
    return {
      name: clientId.includes("demo") ? "Demo Client" : "Third-party App",
      description: "This app wants to access your LifeOS data with the permissions below.",
      website: "https://example.com"
    };
  }

  const handleDecision = async (approved) => {
    if (!params.client_id || !params.redirect_uri) {
      setError("Invalid OAuth request parameters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (authzId) {
        // Supabase-backed consent using the endpoints you provided
        // POST to the consent endpoint with the authorization ID
        // Note: Proxy this through your worker in production to use service_role key securely
        const consentRes = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authzId}/consent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Use anon for demo; in prod proxy via worker with service key + verify user
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({
            action: approved ? "approved" : "denied",
          }),
        });

        const consentData = await consentRes.json();

        if (consentData.redirect_url) {
          window.location.href = consentData.redirect_url;
          return;
        } else if (consentData.error) {
          setError(consentData.error);
        }
      }

      // Fallback / primary custom consent using the LifeOS1 client_id you created in Supabase
      const body = {
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        scope: params.scope,
        state: params.state,
        approved,
        user_id: user?.uid,
        code_challenge: params.code_challenge,
        authz_id: authzId,
      };

      const res = await fetch(`${WORKER_URL}/api/oauth/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (data.error) {
        setError(data.error);
        const errUrl = new URL(params.redirect_uri);
        errUrl.searchParams.set("error", data.error);
        if (params.state) errUrl.searchParams.set("state", params.state);
        setTimeout(() => { window.location.href = errUrl.toString(); }, 1200);
      }
    } catch (e) {
      setError("Failed to process your decision.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{padding:40,textAlign:"center",color:"#888"}}>Loading consent request...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{maxWidth:480,margin:"60px auto",padding:24,background:"#1a1b24",borderRadius:12}}>
        <h2>Sign in required</h2>
        <p>You need to be logged into LifeOS to approve third-party access.</p>
        <button onClick={() => window.location.href = "/"} style={{padding:"10px 16px",background:"#4ab3f4",color:"#111",border:"none",borderRadius:8,cursor:"pointer"}}>Go to LifeOS Login</button>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#0b0c14",display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"system-ui"}}>
      <div style={{maxWidth:560,width:"100%",background:"#13141f",border:"1px solid #222",borderRadius:14,padding:28}}>
        <div style={{fontSize:11,color:"#4ab3f4",marginBottom:4,letterSpacing:1}}>LIFEOS • SECURE AUTHORIZATION</div>
        <h1 style={{fontSize:20,margin:"4px 0 16px",color:"#eee"}}>Approve access request</h1>

        {clientInfo && (
          <div style={{marginBottom:18,padding:14,background:"#1a1b24",borderRadius:8}}>
            <div style={{fontWeight:600}}>{clientInfo.name}</div>
            <div style={{fontSize:13,color:"#888",marginTop:2}}>{clientInfo.description}</div>
          </div>
        )}

        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:"#4ab3f4",marginBottom:6}}>REQUESTED PERMISSIONS</div>
          <div style={{fontSize:13,lineHeight:1.6}}>
            {scopes.map((s,i) => <div key={i}>• {s}</div>)}
          </div>
        </div>

        <div style={{fontSize:11,color:"#666",background:"#1a1b24",padding:10,borderRadius:6,marginBottom:20}}>
          Approving will allow the app to access the selected data in <strong>your LifeOS account</strong>. You can revoke this anytime from Integrations.
        </div>

        {error && <div style={{color:"#ff4f5e",marginBottom:12}}>{error}</div>}

        <div style={{display:"flex",gap:10}}>
          <button onClick={() => handleDecision(false)} disabled={submitting} style={{flex:1,padding:"11px 0",background:"transparent",border:"1px solid #444",color:"#aaa",borderRadius:8,cursor:"pointer"}}>Deny</button>
          <button onClick={() => handleDecision(true)} disabled={submitting} style={{flex:1,padding:"11px 0",background:"#4ab3f4",border:"none",color:"#111",fontWeight:700,borderRadius:8,cursor:"pointer"}}>{submitting ? "..." : "Approve"}</button>
        </div>

        <div style={{textAlign:"center",marginTop:18,fontSize:10,color:"#444"}}>
          Signed in as {user?.email} • <a href="/#integrations" style={{color:"#4ab3f4"}}>Manage apps</a>
        </div>
      </div>
    </div>
  );
}
