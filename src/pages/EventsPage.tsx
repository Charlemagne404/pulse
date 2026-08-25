import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CodeBlock } from '../components/CodeBlock'
import { DataStateCard } from '../components/DataStateCard'
import { ProductShell } from '../components/ProductShell'
import { eventCatalog } from '../data/content'
import { useAnalyticsQuery } from '../hooks/useAnalyticsQuery'
import {
  fetchEventDebugDetail,
  fetchRecentEventsPage,
  fetchRejectedEventsPage,
  type RecentEventRow,
} from '../lib/analyticsApi'
import {
  formatDeviceLabel,
  formatTimestampLabel,
  getProjectName,
} from '../lib/analyticsUi'
import { copyToClipboard } from '../lib/clipboard'
import { fetchWorkspaceSettings } from '../lib/productApi'

interface EventFilters {
  projectId: string
  eventName: string
  pathPrefix: string
  deviceType: string
  countryCode: string
  fromDate: string
  toDate: string
}

const buildDefaultDate = (dayOffset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

const createInitialFilters = (): EventFilters => ({
  projectId: '',
  eventName: '',
  pathPrefix: '',
  deviceType: '',
  countryCode: '',
  fromDate: buildDefaultDate(-6),
  toDate: buildDefaultDate(0),
})

const buildRangeIso = (date: string, endOfDay: boolean) => {
  if (!date) {
    return ''
  }

  const parsed = new Date(`${date}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

const serializeFilters = (filters: EventFilters) => JSON.stringify(filters)

const deviceOptions = ['desktop', 'mobile', 'tablet', 'bot', 'unknown']

const formatPayload = (payload: unknown) => JSON.stringify(payload, null, 2)

const getProjectLabel = (projectNames: Map<string, string>, projectId: string) =>
  projectNames.get(projectId) || getProjectName(projectId)

export function EventsPage() {
  const [draftFilters, setDraftFilters] = useState<EventFilters>(createInitialFilters)
  const [appliedFilters, setAppliedFilters] = useState<EventFilters>(createInitialFilters)
  const [acceptedCursorStack, setAcceptedCursorStack] = useState<string[]>([])
  const [rejectedCursorStack, setRejectedCursorStack] = useState<string[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  const acceptedCursor = acceptedCursorStack[acceptedCursorStack.length - 1] || ''
  const rejectedCursor = rejectedCursorStack[rejectedCursorStack.length - 1] || ''
  const requestFilters = {
    ...(appliedFilters.projectId ? { projectId: appliedFilters.projectId } : {}),
    ...(appliedFilters.eventName ? { eventName: appliedFilters.eventName } : {}),
    ...(appliedFilters.pathPrefix ? { pathPrefix: appliedFilters.pathPrefix } : {}),
    ...(appliedFilters.deviceType ? { deviceType: appliedFilters.deviceType } : {}),
    ...(appliedFilters.countryCode ? { countryCode: appliedFilters.countryCode.toUpperCase() } : {}),
    from: buildRangeIso(appliedFilters.fromDate, false),
    to: buildRangeIso(appliedFilters.toDate, true),
  }

  const workspaceQuery = useAnalyticsQuery('events:workspace-filters', (signal) => fetchWorkspaceSettings(signal))
  const acceptedQuery = useAnalyticsQuery(
    `events:accepted:${serializeFilters(appliedFilters)}:${acceptedCursor}`,
    (signal) =>
      fetchRecentEventsPage(
        {
          ...requestFilters,
          ...(acceptedCursor ? { cursor: acceptedCursor } : {}),
          limit: 12,
        },
        signal,
      ),
  )
  const rejectedQuery = useAnalyticsQuery(
    `events:rejected:${serializeFilters(appliedFilters)}:${rejectedCursor}`,
    (signal) =>
      fetchRejectedEventsPage(
        {
          projectId: requestFilters.projectId,
          eventName: requestFilters.eventName,
          pathPrefix: requestFilters.pathPrefix,
          from: requestFilters.from,
          to: requestFilters.to,
          ...(rejectedCursor ? { cursor: rejectedCursor } : {}),
          limit: 8,
        },
        signal,
      ),
  )
  const detailQuery = useAnalyticsQuery(`events:detail:${selectedEventId}`, (signal) =>
    selectedEventId ? fetchEventDebugDetail(selectedEventId, signal) : Promise.resolve(null),
  )

  const projectNames = new Map(
    (workspaceQuery.data?.projects || []).map((project) => [project.projectId, project.projectName]),
  )
  const trackedProjects = acceptedQuery.data
    ? new Set(acceptedQuery.data.rows.map((row) => row.projectId)).size
    : 0

  const handleCopy = async (key: string, value: string) => {
    await copyToClipboard(value)
    setCopiedKey(key)
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? '' : current))
    }, 1800)
  }

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters)
    setAcceptedCursorStack([])
    setRejectedCursorStack([])
    setSelectedEventId('')
  }

  return (
    <ProductShell
      activeItem="events"
      pageTitle={<h1>Events</h1>}
      toolbar={
        <div className="toolbar-cluster">
          <Link to="/docs" className="secondary-button">
            Event Reference
          </Link>
          <span className={`status-chip${acceptedQuery.isRefreshing || rejectedQuery.isRefreshing ? ' refreshing' : ''}`}>
            {acceptedQuery.isRefreshing || rejectedQuery.isRefreshing ? 'Refreshing live data' : 'Live data'}
          </span>
        </div>
      }
    >
      <section className="data-panel page-intro-panel">
        <div>
          <h2>Workspace event debugger</h2>
          <p>
            {acceptedQuery.data
              ? `${acceptedQuery.data.rows.length} accepted events are loaded across ${trackedProjects} active projects in the current filter range. Rejected collector traffic appears beside it so setup mistakes are visible immediately.`
              : 'Filter accepted and rejected traffic together, inspect individual payloads, and confirm why Pulse accepted or rejected what the site sent.'}
          </p>
        </div>
        <Link to="/help" className="secondary-button">
          Open Help
        </Link>
      </section>

      <section className="data-panel event-debug-filter-panel">
        <div className="panel-head">
          <h2>Debug filters</h2>
        </div>

        <div className="setup-field-grid event-debug-filter-grid">
          <label className="setup-field">
            <span>Project</span>
            <select
              value={draftFilters.projectId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, projectId: event.target.value }))}
            >
              <option value="">All projects</option>
              {(workspaceQuery.data?.projects || []).map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </label>

          <label className="setup-field">
            <span>Event</span>
            <input
              type="text"
              list="event-debug-event-options"
              value={draftFilters.eventName}
              placeholder="page_view"
              onChange={(event) => setDraftFilters((current) => ({ ...current, eventName: event.target.value }))}
            />
            <datalist id="event-debug-event-options">
              {eventCatalog.map((item) => (
                <option key={item.name} value={item.name} />
              ))}
            </datalist>
          </label>

          <label className="setup-field">
            <span>Path prefix</span>
            <input
              type="text"
              value={draftFilters.pathPrefix}
              placeholder="/docs"
              onChange={(event) => setDraftFilters((current) => ({ ...current, pathPrefix: event.target.value }))}
            />
          </label>

          <label className="setup-field">
            <span>Device</span>
            <select
              value={draftFilters.deviceType}
              onChange={(event) => setDraftFilters((current) => ({ ...current, deviceType: event.target.value }))}
            >
              <option value="">All devices</option>
              {deviceOptions.map((deviceType) => (
                <option key={deviceType} value={deviceType}>
                  {formatDeviceLabel(deviceType)}
                </option>
              ))}
            </select>
          </label>

          <label className="setup-field">
            <span>Country</span>
            <input
              type="text"
              value={draftFilters.countryCode}
              placeholder="SE"
              maxLength={2}
              onChange={(event) =>
                setDraftFilters((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))
              }
            />
          </label>

          <label className="setup-field">
            <span>From</span>
            <input
              type="date"
              value={draftFilters.fromDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, fromDate: event.target.value }))}
            />
          </label>

          <label className="setup-field">
            <span>To</span>
            <input
              type="date"
              value={draftFilters.toDate}
              onChange={(event) => setDraftFilters((current) => ({ ...current, toDate: event.target.value }))}
            />
          </label>
        </div>

        <div className="setup-footer-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const nextFilters = createInitialFilters()
              setDraftFilters(nextFilters)
              setAppliedFilters(nextFilters)
              setAcceptedCursorStack([])
              setRejectedCursorStack([])
              setSelectedEventId('')
            }}
          >
            Reset filters
          </button>
          <button type="button" className="primary-button gold" onClick={handleApplyFilters}>
            Apply filters
          </button>
        </div>
      </section>

      {acceptedQuery.error && acceptedQuery.data ? (
        <DataStateCard
          title="Accepted-event refresh interrupted"
          message={`${acceptedQuery.error} The accepted event list is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {rejectedQuery.error && rejectedQuery.data ? (
        <DataStateCard
          title="Rejected-event refresh interrupted"
          message={`${rejectedQuery.error} The rejected event list is still showing the last successful response.`}
          tone="warning"
        />
      ) : null}

      {acceptedQuery.isLoading && !acceptedQuery.data ? (
        <DataStateCard
          title="Loading accepted events"
          message="Pulse is loading accepted traffic for the current debugger filters."
        />
      ) : null}

      {!acceptedQuery.isLoading && acceptedQuery.error && !acceptedQuery.data ? (
        <DataStateCard title="Could not load accepted events" message={acceptedQuery.error} tone="error" />
      ) : null}

      <section className="resource-card-grid">
        {eventCatalog.map((eventItem) => (
          <article key={eventItem.name} className="data-panel resource-card">
            <span className="table-event-pill">{eventItem.category}</span>
            <h2>{eventItem.name}</h2>
            <p>{eventItem.description}</p>
            <Link to="/docs" className="panel-link">
              Open docs
            </Link>
          </article>
        ))}
      </section>

      <section className="event-debug-grid">
        <section className="data-panel">
          <div className="panel-head">
            <h2>Accepted traffic</h2>
            <span className="country-pill">
              {acceptedQuery.data ? `${acceptedQuery.data.rows.length} loaded` : 'Live query'}
            </span>
          </div>

          {acceptedQuery.data && acceptedQuery.data.rows.length > 0 ? (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Project</th>
                    <th>Location</th>
                    <th>Device</th>
                    <th>Consent</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptedQuery.data.rows.map((row) => (
                    <AcceptedEventRowView
                      key={row.eventId}
                      row={row}
                      projectName={getProjectLabel(projectNames, row.projectId)}
                      isSelected={selectedEventId === row.eventId}
                      onInspect={() => setSelectedEventId(row.eventId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!acceptedQuery.isLoading && !acceptedQuery.error && acceptedQuery.data && acceptedQuery.data.rows.length === 0 ? (
            <p className="empty-list-copy">No accepted events matched the current filters.</p>
          ) : null}

          {acceptedQuery.data ? (
            <div className="setup-footer-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={acceptedCursorStack.length === 0}
                onClick={() => setAcceptedCursorStack((current) => current.slice(0, -1))}
              >
                Previous page
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!acceptedQuery.data.page.nextCursor}
                onClick={() =>
                  setAcceptedCursorStack((current) =>
                    acceptedQuery.data?.page.nextCursor ? [...current, acceptedQuery.data.page.nextCursor] : current,
                  )
                }
              >
                Next page
              </button>
            </div>
          ) : null}
        </section>

        <section className="data-panel">
          <div className="panel-head">
            <h2>Rejected traffic</h2>
            <span className="country-pill">
              {rejectedQuery.data ? `${rejectedQuery.data.rows.length} loaded` : 'Collector log'}
            </span>
          </div>

          {rejectedQuery.data && rejectedQuery.data.rows.length > 0 ? (
            <div className="mini-table-list">
              {rejectedQuery.data.rows.map((row) => (
                <article key={row.rejectionId} className="mini-table-row report-detail-row">
                  <span className="country-pill">{row.field || 'Collector'}</span>
                  <div>
                    <strong>{row.reason}</strong>
                    <p>
                      {formatTimestampLabel(row.receivedAt)}
                      {row.eventName ? ` · ${row.eventName}` : ''}
                      {row.projectId ? ` · ${getProjectLabel(projectNames, row.projectId)}` : ''}
                      {row.path ? ` · ${row.path}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button setup-inline-button"
                    onClick={() => void handleCopy(`reject-${row.rejectionId}`, formatPayload(row.payload))}
                  >
                    {copiedKey === `reject-${row.rejectionId}` ? 'Copied payload' : 'Copy payload'}
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          {!rejectedQuery.isLoading && !rejectedQuery.error && rejectedQuery.data && rejectedQuery.data.rows.length === 0 ? (
            <p className="empty-list-copy">No rejected collector events matched the current filters.</p>
          ) : null}

          {rejectedQuery.data ? (
            <div className="setup-footer-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={rejectedCursorStack.length === 0}
                onClick={() => setRejectedCursorStack((current) => current.slice(0, -1))}
              >
                Previous page
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!rejectedQuery.data.page.nextCursor}
                onClick={() =>
                  setRejectedCursorStack((current) =>
                    rejectedQuery.data?.page.nextCursor ? [...current, rejectedQuery.data.page.nextCursor] : current,
                  )
                }
              >
                Next page
              </button>
            </div>
          ) : null}
        </section>
      </section>

      {selectedEventId && detailQuery.data ? (
        <section className="data-panel">
          <div className="panel-head">
            <h2>Accepted event payload</h2>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleCopy(`accepted-${selectedEventId}`, formatPayload(detailQuery.data?.payload))}
            >
              {copiedKey === `accepted-${selectedEventId}` ? 'Copied payload' : 'Copy payload'}
            </button>
          </div>

          <CodeBlock title={selectedEventId} code={formatPayload(detailQuery.data.payload)} />
        </section>
      ) : null}
    </ProductShell>
  )
}

function AcceptedEventRowView({
  row,
  projectName,
  isSelected,
  onInspect,
}: {
  row: RecentEventRow
  projectName: string
  isSelected: boolean
  onInspect: () => void
}) {
  return (
    <tr className={isSelected ? 'event-debug-row-selected' : ''}>
      <td>{formatTimestampLabel(row.occurredAt)}</td>
      <td>
        <span className="table-event-pill">{row.eventName}</span>
      </td>
      <td>{projectName}</td>
      <td>{row.path}</td>
      <td>{formatDeviceLabel(row.deviceType)}</td>
      <td>{`${row.consentState} · ${row.consentMode}`}</td>
      <td>
        <button type="button" className="secondary-button setup-inline-button" onClick={onInspect}>
          Inspect
        </button>
      </td>
    </tr>
  )
}
