// ============================================================
// AUTH.JS — Protection des pages + déconnexion
// ============================================================

// Détecte le chemin de base selon où on est
function getBasePath() {
  return window.location.pathname.includes('/pages/') ? '../' : '';
}

// Redirige vers login si non connecté
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = getBasePath() + 'pages/login.html';
    return null;
  }
  return session;
}

// Déconnexion
document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = getBasePath() + 'pages/login.html';
});