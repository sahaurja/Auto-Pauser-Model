import { NavLink, useNavigate } from 'react-router-dom'
import { House, LibraryBig, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'

export function NavBar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <NavLink to="/home" className="navbar-brand">
          <Logo />
        </NavLink>
        <ul className="navbar-links">
          <li>
            <NavLink to="/home">
              <House size={20} />
              Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/library">
              <LibraryBig size={20} />
              Library
            </NavLink>
          </li>
        </ul>
      </div>
      <button className="btn-secondary" onClick={handleLogout}>
        <LogOut size={18} />
        Log out
      </button>
    </nav>
  )
}
