import { createContext, useContext, useState, useEffect } from 'react'
import api from './api'

const ProjetContext = createContext(null)

export function ProjetProvider({ children }) {
  const [projets, setProjets]       = useState([])
  const [projetActif, setProjetActif] = useState(null)
  const [loading, setLoading]       = useState(true)

  const loadProjets = async () => {
    try {
      const res = await api.get('/projets/')
      setProjets(res.data)
      // Restaure le dernier projet sélectionné depuis localStorage
      const saved = localStorage.getItem('projet_actif_id')
      if (saved) {
        const found = res.data.find(p => p.id === parseInt(saved))
        if (found) { setProjetActif(found); setLoading(false); return }
      }
      if (res.data.length > 0) setProjetActif(res.data[0])
    } catch (e) {
      console.error('Erreur chargement projets', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjets() }, [])

  const selectProjet = (projet) => {
    setProjetActif(projet)
    localStorage.setItem('projet_actif_id', projet.id)
  }

  const createProjet = async (data) => {
    const res = await api.post('/projets/', data)
    await loadProjets()
    selectProjet(res.data)
    return res.data
  }

  const updateProjet = async (id, data) => {
    await api.put(`/projets/${id}`, data)
    await loadProjets()
  }

  const deleteProjet = async (id) => {
    await api.delete(`/projets/${id}`)
    const res = await api.get('/projets/')
    setProjets(res.data)
    if (projetActif?.id === id) {
      setProjetActif(res.data[0] || null)
    }
  }

  return (
    <ProjetContext.Provider value={{
      projets, projetActif, loading,
      selectProjet, createProjet, updateProjet, deleteProjet,
      reload: loadProjets,
    }}>
      {children}
    </ProjetContext.Provider>
  )
}

export const useProjet = () => useContext(ProjetContext)