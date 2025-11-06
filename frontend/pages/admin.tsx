import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from '../contexts/AuthContext'
import { fetchWithAuth } from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmModal from '../components/ConfirmModal'

interface User {
  id: string
  email: string
  name: string
  age: number
  gender: string
  role: string
  course?: string
  verified: boolean
  banned: boolean
  bannedAt?: string
  createdAt: string
  updatedAt: string
  _count: {
    reports: number
  }
}

interface Report {
  id: string
  reportedId: string
  reportedBy: string
  reason: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
  reportedUser?: {
    id: string
    email: string
    name: string
    banned: boolean
  }
}

type Tab = 'users' | 'reports'

export default function AdminPanel() {
  const { session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'banned' | 'active'>('all')
  const [reportFilterStatus, setReportFilterStatus] = useState<
    'all' | 'Pending' | 'Reviewed' | 'Resolved'
  >('all')
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    message: string
    onConfirm: () => void
    type?: 'warning' | 'danger'
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
  })

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    } else if (status === 'authenticated' && session?.user?.role !== 'Admin') {
      router.push('/')
    }
  }, [status, session, router])

  // Fetch data when tab changes
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'Admin') {
      if (activeTab === 'users') {
        fetchUsers()
      } else {
        fetchReports()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, status, session])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth('/api/admin/users')
      const result = await response.json()

      if (result.success) {
        setUsers(Array.isArray(result.data) ? result.data : [])
      } else {
        showMessage('error', result.error || 'Failed to fetch users')
        setUsers([]) // Ensure users is always an array
      }
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to fetch users')
      setUsers([]) // Ensure users is always an array on error
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async (status?: 'all' | 'Pending' | 'Reviewed' | 'Resolved') => {
    try {
      setLoading(true)
      const filterStatus = status ?? reportFilterStatus
      const queryParam = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const response = await fetchWithAuth(`/api/admin/reports${queryParam}`)
      const result = await response.json()

      if (result.success) {
        setReports(Array.isArray(result.data) ? result.data : [])
      } else {
        showMessage('error', result.error || 'Failed to fetch reports')
        setReports([]) // Ensure reports is always an array
      }
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to fetch reports')
      setReports([]) // Ensure reports is always an array on error
    } finally {
      setLoading(false)
    }
  }

  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'reset-password') => {
    // Show confirmation modal instead of using confirm()
    const confirmMessage =
      action === 'reset-password'
        ? "Are you sure you want to reset this user's password? A new temporary password will be generated and displayed."
        : `Are you sure you want to ${action} this user?`

    setConfirmModal({
      isOpen: true,
      message: confirmMessage,
      type: action === 'ban' || action === 'reset-password' ? 'danger' : 'warning',
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} })

        try {
          setActionLoading(userId)
          const response = await fetchWithAuth('/api/admin/user-actions', {
            method: 'POST',
            body: JSON.stringify({ userId, action }),
          })

          const result = await response.json()

          if (result.success) {
            if (action === 'reset-password' && result.data?.temporaryPassword) {
              const tempPassword = result.data.temporaryPassword
              showMessage(
                'success',
                `${result.message}\n\nTemporary password: ${tempPassword}\n\nPlease copy this password and share it securely with the user.`
              )
            } else {
              showMessage('success', result.message)
            }
            fetchUsers()
          } else {
            showMessage('error', result.error || 'Action failed')
          }
        } catch (error) {
          showMessage('error', error instanceof Error ? error.message : 'Action failed')
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const filteredUsers = (Array.isArray(users) ? users : []).filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'banned' && user.banned) ||
      (filterStatus === 'active' && !user.banned)

    return matchesSearch && matchesFilter
  })

  if (status === 'loading') {
    return <LoadingSpinner message="Loading admin panel..." />
  }

  if (!session || session.user.role !== 'Admin') {
    return null
  }

  return (
    <>
      <Head>
        <title>SITogether • Admin Panel</title>
        <meta name="description" content="Admin panel for user management" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ marginBottom: '0.5rem' }}>Admin Panel</h1>
            <p style={{ color: '#6b7280', margin: 0 }}>Manage users and review reported accounts</p>
          </div>

          {message && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                color: message.type === 'success' ? '#155724' : '#721c24',
              }}
            >
              {message.text}
            </div>
          )}

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              borderBottom: '2px solid #e5e7eb',
              marginBottom: '2rem',
            }}
          >
            <button
              onClick={() => setActiveTab('users')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                color: activeTab === 'users' ? '#6366f1' : '#6b7280',
                borderBottom: activeTab === 'users' ? '2px solid #6366f1' : '2px solid transparent',
                marginBottom: '-2px',
                fontSize: '1rem',
              }}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                color: activeTab === 'reports' ? '#6366f1' : '#6b7280',
                borderBottom:
                  activeTab === 'reports' ? '2px solid #6366f1' : '2px solid transparent',
                marginBottom: '-2px',
                fontSize: '1rem',
              }}
            >
              Reported Accounts
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              {/* Search and Filter */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as 'all' | 'banned' | 'active')}
                  className="input"
                  style={{ width: '200px' }}
                >
                  <option value="all">All Users</option>
                  <option value="active">Active Users</option>
                  <option value="banned">Banned Users</option>
                </select>
              </div>

              {loading ? (
                <LoadingSpinner message="Loading users..." />
              ) : filteredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  No users found
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={tableHeaderStyle}>Name</th>
                        <th style={tableHeaderStyle}>Email</th>
                        <th style={tableHeaderStyle}>Role</th>
                        <th style={tableHeaderStyle}>Status</th>
                        <th style={tableHeaderStyle}>Reports</th>
                        <th style={tableHeaderStyle}>Joined</th>
                        <th style={tableHeaderStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={tableCellStyle}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#111827' }}>{user.name}</div>
                              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                {user.age} • {user.gender}
                              </div>
                            </div>
                          </td>
                          <td style={tableCellStyle}>{user.email}</td>
                          <td style={tableCellStyle}>
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: user.role === 'Admin' ? '#fef3c7' : '#e0e7ff',
                                color: user.role === 'Admin' ? '#92400e' : '#3730a3',
                              }}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td style={tableCellStyle}>
                            <span
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                backgroundColor: user.banned ? '#fee2e2' : '#d1fae5',
                                color: user.banned ? '#991b1b' : '#065f46',
                              }}
                            >
                              {user.banned ? 'Banned' : user.verified ? 'Active' : 'Unverified'}
                            </span>
                          </td>
                          <td style={tableCellStyle}>
                            {user._count.reports > 0 ? (
                              <span
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '999px',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                }}
                              >
                                {user._count.reports}
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>0</span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td style={tableCellStyle}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => router.push(`/profile/${user.id}?from=admin`)}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: '1px solid #6366f1',
                                  cursor: 'pointer',
                                  backgroundColor: '#6366f1',
                                  color: '#fff',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#4f46e5'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#6366f1'
                                }}
                              >
                                View Profile
                              </button>
                              {user.role !== 'Admin' && (
                                <button
                                  onClick={() =>
                                    handleUserAction(user.id, user.banned ? 'unban' : 'ban')
                                  }
                                  disabled={actionLoading === user.id}
                                  style={{
                                    padding: '0.375rem 0.75rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: 'none',
                                    cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                                    backgroundColor: user.banned ? '#10b981' : '#ef4444',
                                    color: '#fff',
                                    opacity: actionLoading === user.id ? 0.5 : 1,
                                  }}
                                >
                                  {user.banned ? 'Unban' : 'Ban'}
                                </button>
                              )}
                              <button
                                onClick={() => handleUserAction(user.id, 'reset-password')}
                                disabled={actionLoading === user.id}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  cursor: actionLoading === user.id ? 'not-allowed' : 'pointer',
                                  backgroundColor: '#fff',
                                  color: '#374151',
                                  opacity: actionLoading === user.id ? 0.5 : 1,
                                }}
                              >
                                Reset Password
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div>
              {/* Filter */}
              <div style={{ marginBottom: '1.5rem' }}>
                <select
                  value={reportFilterStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value as 'all' | 'Pending' | 'Reviewed' | 'Resolved'
                    setReportFilterStatus(newStatus)
                    fetchReports(newStatus)
                  }}
                  className="input"
                  style={{ width: '200px' }}
                >
                  <option value="all">All Reports</option>
                  <option value="Pending">Pending</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {loading ? (
                <LoadingSpinner message="Loading reports..." />
              ) : reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  No reports found
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      style={{
                        padding: '1.5rem',
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: '1rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              marginBottom: '0.5rem',
                            }}
                          >
                            <h3 style={{ margin: 0, color: '#111827', fontSize: '1.125rem' }}>
                              {report.reportedUser?.name || 'Unknown User'}
                            </h3>
                            {report.reportedUser?.banned && (
                              <span
                                style={{
                                  padding: '0.25rem 0.75rem',
                                  borderRadius: '999px',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  backgroundColor: '#fee2e2',
                                  color: '#991b1b',
                                }}
                              >
                                Banned
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                              {report.reportedUser?.email || 'N/A'}
                            </p>
                            {report.reportedUser && (
                              <button
                                onClick={() =>
                                  router.push(`/profile/${report.reportedUser!.id}?from=admin`)
                                }
                                style={{
                                  padding: '0.25rem 0.75rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: '1px solid #6366f1',
                                  cursor: 'pointer',
                                  backgroundColor: '#6366f1',
                                  color: '#fff',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#4f46e5'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#6366f1'
                                }}
                              >
                                View Profile
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <span
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '999px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              backgroundColor:
                                report.status === 'Pending'
                                  ? '#fef3c7'
                                  : report.status === 'Reviewed'
                                    ? '#e0e7ff'
                                    : '#d1fae5',
                              color:
                                report.status === 'Pending'
                                  ? '#92400e'
                                  : report.status === 'Reviewed'
                                    ? '#3730a3'
                                    : '#065f46',
                            }}
                          >
                            {report.status}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
                          Reason: {report.reason}
                        </div>
                        {report.description && (
                          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9375rem' }}>
                            {report.description}
                          </p>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '1rem',
                          borderTop: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                          Reported on {new Date(report.createdAt).toLocaleDateString()} by{' '}
                          {report.reportedBy}
                        </div>
                        {report.reportedUser && (
                          <button
                            onClick={() => {
                              const user = report.reportedUser!
                              handleUserAction(user.id, user.banned ? 'unban' : 'ban')
                            }}
                            disabled={actionLoading === report.reportedUser.id}
                            style={{
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: 'none',
                              cursor:
                                actionLoading === report.reportedUser.id
                                  ? 'not-allowed'
                                  : 'pointer',
                              backgroundColor: report.reportedUser.banned ? '#10b981' : '#ef4444',
                              color: '#fff',
                              opacity: actionLoading === report.reportedUser.id ? 0.5 : 1,
                            }}
                          >
                            {report.reportedUser.banned ? 'Unban User' : 'Ban User'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Showing {reports.length} report{reports.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      </main>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} })}
        type={confirmModal.type}
      />
    </>
  )
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const tableCellStyle: React.CSSProperties = {
  padding: '1rem',
  fontSize: '0.9375rem',
  color: '#111827',
}
