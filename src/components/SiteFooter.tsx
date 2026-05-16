import { Link } from 'react-router-dom'
import { ContinentalSignature } from './Brand'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <ContinentalSignature />
      <nav aria-label="Footer links">
        <Link to="/">Home</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/projects/aegis">Aegis</Link>
        <Link to="/docs">Docs</Link>
      </nav>
    </footer>
  )
}
