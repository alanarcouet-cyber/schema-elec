import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AuthModal.css'

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
        setInfo('Compte créé ! Vérifiez votre email pour confirmer.')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href,
        })
        if (error) throw error
        setInfo('Lien de réinitialisation envoyé. Vérifiez votre email.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m) => { setMode(m); setError(''); setInfo('') }

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <div className="auth-logo">
          <span className="auth-bolt">⚡</span>
          <h1>Schéma Électrique</h1>
        </div>
        <p className="auth-subtitle">Distribution publique BT / HTA</p>

        <h2>
          {mode === 'login' ? 'Connexion'
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
             : mode === 'login' ? 'Se connecter'
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
