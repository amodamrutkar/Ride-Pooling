import { Link, useLocation } from 'react-router-dom'

export default function NavBar({ roadData = 'Nashik Urban OSRM' }) {
  const location = useLocation()
  const isRider = location.pathname.startsWith('/rider')

  return (
    <header className="app-navbar">
      <div className="nav-container">
        <div className="nav-left">
          <Link to="/" className="nav-brand">
            <span className="brand-pulse-dot" />
            <span className="brand-title">PoolIQ</span>
            <span className="brand-zone-tag">Nashik Metro</span>
          </Link>
        </div>

        <div className="nav-center">
          <div className="telemetry-pill">
            <span className="telemetry-live-dot" />
            <span className="telemetry-text">Road Engine: {roadData}</span>
          </div>
        </div>

        <div className="nav-right">
          <div className="view-switch-tabs">
            <Link
              to="/"
              className={`view-tab-btn ${!isRider ? 'active' : ''}`}
              title="Operator Fleet Control Dashboard"
            >
              Control Room
            </Link>
            <Link
              to="/rider"
              className={`view-tab-btn ${isRider ? 'active' : ''}`}
              title="Passenger Ride View"
            >
              Rider App
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
