// Google Identity Services (GIS) token client — loaded via script tag in index.html
interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: {
            access_token: string;
            expires_in: number;
            error?: string;
          }) => void;
        }) => {
          requestAccessToken: (opts?: { prompt?: string }) => void;
        };
      };
    };
  };
}
