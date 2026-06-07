import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AuthModal.css'

const ERROR_MAP = {
  'Invalid login credentials':          'Email ou mot de passe incorrect.',
  'Email not confirmed':                'Votre adresse email n\'est pas encore confirmée. Vérifiez votre boîte mail.',
  'User already registered':            'Un compte existe déjà avec cet email.',
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'email rate limit exceeded':          'Trop de tentatives d\'inscription. Veuillez réessayer dans quelques minutes.',
  'For security purposes, you can only request this once every 60 seconds': 'Veuillez attendre au moins 60 secondes avant de renvoyer un email.',
  'Unable to validate email address: invalid format': 'Adresse email invalide.',
  'Signup requires a valid password':   'Veuillez saisir un mot de passe valide.',
  'over_email_send_rate_limit':         'Limite d\'envoi d\'emails atteinte. Réessayez dans quelques minutes.',
}

function translateError(msg) {
  if (!msg) return 'Une erreur est survenue.'
  for (const [key, fr] of Object.entries(ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return fr
  }
  return msg  // fallback : message brut si non traduit
}

export default function AuthModal() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('login')   // 'login' | 'register' | 'reset'
  const [error, setError]       = useState('')
  const [info, setInfo]         = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMode('confirm')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href,
        })
        if (error) throw error
        setInfo('Un lien de réinitialisation vous a été envoyé. Vérifiez votre boîte mail (et vos spams).')
      }
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m) => { setMode(m); setError(''); setInfo('') }

  // ── Écran de confirmation email ───────────────────────────────────────────
  if (mode === 'confirm') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <div className="auth-logo">
            <span className="auth-bolt">⚡</span>
            <h1>Schéma Électrique</h1>
          </div>
          <div className="auth-confirm-box">
            <div className="auth-confirm-icon">📧</div>
            <h2>Vérifiez votre boîte mail</h2>
            <p>
              Un email de confirmation a été envoyé à <strong>{email}</strong>.
            </p>
            <p>
              Cliquez sur le lien dans cet email pour activer votre compte, puis revenez vous connecter.
            </p>
            <p className="auth-confirm-hint">
              Vous ne trouvez pas l'email ? Vérifiez vos spams ou dossier « Promotions ».
            </p>
          </div>
          <div className="auth-links">
            <button className="auth-switch" onClick={() => switchMode('login')}>
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-logo">
          <span className="auth-bolt">⚡</span>
          <h1>Schéma Électrique</h1>
        </div>
        <p className="auth-subtitle">Distribution publique BT / HTA</p>

        <h2>
          {mode === 'login'    ? 'Connexion'
           : mode === 'register' ? 'Créer un compte'
           : 'Réinitialiser le mot de passe'}
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {mode !== 'reset' && (
            <input
              type="password"
              placeholder="Mot de passe (min. 6 caractères)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          {error && <p className="auth-error">{error}</p>}
          {info  && <p className="auth-info">{info}</p>}
          <button type="submit" disabled={loading}>
            {loading ? '…'
             : mode === 'login'    ? 'Se connecter'
             : mode === 'register' ? "S'inscrire"
             : 'Envoyer le lien'}
          </button>
        </form>

        <div className="auth-links">
          {mode !== 'login' && (
            <button className="auth-switch" onClick={() => switchMode('login')}>
              Déjà un compte ? Se connecter
            </button>
          )}
          {mode !== 'register' && (
            <button className="auth-switch" onClick={() => switchMode('register')}>
              Pas de compte ? S'inscrire
            </button>
          )}
          {mode === 'login' && (
            <button className="auth-switch auth-forgot" onClick={() => switchMode('reset')}>
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
