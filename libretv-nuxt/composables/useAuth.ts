
import { sha256 } from 'js-sha256';

export const useAuth = () => {
  const authCookie = useCookie('authHash', {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      default: () => ''
  });
  
  const passwordHash = useState<string>('passwordHash', () => authCookie.value || '');
  const isAuthenticated = useState<boolean>('isAuthenticated', () => !!authCookie.value);

  const setPassword = (password: string) => {
    const hash = sha256(password);
    passwordHash.value = hash;
    authCookie.value = hash;
    isAuthenticated.value = true;
  };

  const getAuthParams = () => {
      // Use cookie value directly if state is empty (though state should sync)
      const hash = passwordHash.value || authCookie.value;
      if (!hash) return {};
      return {
          auth: hash,
          t: Date.now().toString()
      };
  };

  return {
    passwordHash,
    isAuthenticated,
    setPassword,
    getAuthParams
  };
};
