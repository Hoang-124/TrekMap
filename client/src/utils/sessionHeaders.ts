export const getClientSessionId = (): string => {
  let sid = localStorage.getItem('trekmap_client_session_id');
  if (!sid) {
    sid = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('trekmap_client_session_id', sid);
  }
  return sid;
};

export const getApiHeaders = (extraHeaders: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-Client-Session-Id': getClientSessionId(),
    ...extraHeaders,
  };
  const token = localStorage.getItem('trekmap_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const notifyForumUpdated = (payload?: any) => {
  window.dispatchEvent(new CustomEvent('trekmap:forum-updated', { detail: payload }));
};
