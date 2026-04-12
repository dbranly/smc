import axios from 'axios'

// En production (GitHub Pages) → API Render
// En développement (localhost) → proxy Vite vers localhost:8001
const BASE_URL = import.meta.env.PROD
  ? 'https://smc-cp8d.onrender.com'
  : ''

const api = axios.create({
  baseURL: BASE_URL,
})

// Injecte le token JWT sur chaque requête
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('smc_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Redirige vers /login si 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('smc_token')
      window.location.href = '/smc/login'
    }
    return Promise.reject(err)
  }
)

export default api
