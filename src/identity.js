const KEY_ID   = 'quorum:userId';
const KEY_NAME = 'quorum:userName';

export function getUserId() {
  let id = sessionStorage.getItem(KEY_ID);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY_ID, id);
  }
  return id;
}

export function getUserName() {
  return localStorage.getItem(KEY_NAME) ?? '';
}

export function setUserName(name) {
  localStorage.setItem(KEY_NAME, name.trim());
}
