import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from '../contexts/AuthContext'
import { fetchWithAuth } from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmModal from '../components/ConfirmModal'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'

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
  const { toasts, showToast, removeToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'banned' | 'active'>('all')
  const [reportFilterStatus, setReportFilterStatus] = useState<'all' | 'Pending' | 'Resolved'>(
    'all'
  )
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
  const [createAdminModal, setCreateAdminModal] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // Validation helper functions
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const isValidPassword = (password: string): boolean => {
    return password.length >= 8
  }

  const isFormValid = (): boolean => {
    return (
      newAdminEmail.trim() !== '' &&
      isValidEmail(newAdminEmail) &&
      newAdminPassword.trim() !== '' &&
      isValidPassword(newAdminPassword)
    )
  }

  // Redirect if not authenticated (admin check is handled by middleware)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  // Fetch data when tab changes (middleware ensures only admins can access)
  useEffect(() => {
    if (status === 'authenticated') {
      if (activeTab === 'users') {
        fetchUsers()
      } else {
        fetchReports()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, status])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetchWithAuth('/api/admin/users')
      const result = await response.json()

      if (result.success) {
        setUsers(Array.isArray(result.data) ? result.data : [])
      } else {
        showToast(result.error || 'Failed to fetch users', 'error')
        setUsers([]) // Ensure users is always an array
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to fetch users', 'error')
      setUsers([]) // Ensure users is always an array on error
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async (status?: 'all' | 'Pending' | 'Resolved') => {
    try {
      setLoading(true)
      const filterStatus = status ?? reportFilterStatus
      const queryParam = filterStatus !== 'all' ? `?status=${filterStatus}` : ''
      const response = await fetchWithAuth(`/api/admin/reports${queryParam}`)
      const result = await response.json()

      if (result.success) {
        setReports(Array.isArray(result.data) ? result.data : [])
      } else {
        showToast(result.error || 'Failed to fetch reports', 'error')
        setReports([]) // Ensure reports is always an array
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to fetch reports', 'error')
      setReports([]) // Ensure reports is always an array on error
    } finally {
      setLoading(false)
    }
  }

  // Group reports by reported user
  interface GroupedReport {
    user: NonNullable<Report['reportedUser']> & { id: string }
    reports: Report[]
  }

  const groupedReports = reports.reduce(
    (acc, report) => {
      const userId = report.reportedId
      if (!acc[userId]) {
        acc[userId] = {
          user: (report.reportedUser || {
            id: report.reportedId,
            email: 'Unknown',
            name: 'Unknown User',
            banned: false,
          }) as NonNullable<Report['reportedUser']> & { id: string },
          reports: [],
        }
      }
      acc[userId].reports.push(report)
      return acc
    },
    {} as Record<string, GroupedReport>
  )

  const groupedReportsArray = Object.values(groupedReports)

  const handleUserAction = async (userId: string, action: 'ban' | 'unban') => {
    // Show confirmation modal instead of using confirm()
    const confirmMessage = `Are you sure you want to ${action} this user?`

    setConfirmModal({
      isOpen: true,
      message: confirmMessage,
      type: action === 'ban' ? 'danger' : 'warning',
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
            showToast(result.message, 'success')
            fetchUsers()
            // Refresh reports if we're on the reports tab
            if (activeTab === 'reports') {
              // If filtering by 'Pending', switch to 'all' to see the resolved reports
              if (reportFilterStatus === 'Pending') {
                setReportFilterStatus('all')
                fetchReports('all')
              } else {
                fetchReports()
              }
            }
          } else {
            showToast(result.error || 'Action failed', 'error')
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Action failed', 'error')
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const handleBanFromReport = async (userId: string, reportId: string, action: 'ban' | 'unban') => {
    // Show confirmation modal
    const confirmMessage = `Are you sure you want to ${action} this user? ${
      action === 'ban' ? 'This will also resolve all pending reports for this user.' : ''
    }`

    setConfirmModal({
      isOpen: true,
      message: confirmMessage,
      type: action === 'ban' ? 'danger' : 'warning',
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
            showToast(result.message, 'success')
            // Refresh reports to show updated statuses
            // If filtering by 'Pending', switch to 'all' to see the resolved reports
            if (reportFilterStatus === 'Pending') {
              setReportFilterStatus('all')
              fetchReports('all')
            } else {
              fetchReports()
            }
          } else {
            showToast(result.error || 'Action failed', 'error')
          }
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Action failed', 'error')
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const handleInvalidReport = async (reportId: string) => {
    // Show confirmation modal
    setConfirmModal({
      isOpen: true,
      message:
        'Are you sure you want to mark this report as invalid? This will resolve the report without banning the user.',
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal({ isOpen: false, message: '', onConfirm: () => {} })

        try {
          setActionLoading(reportId)
          const response = await fetchWithAuth(`/api/admin/reports/${reportId}/invalid`, {
            method: 'POST',
          })

          const result = await response.json()

          if (result.success) {
            showToast(result.message, 'success')
            // If filtering by 'Pending', switch to 'all' to see the resolved report
            if (reportFilterStatus === 'Pending') {
              setReportFilterStatus('all')
              fetchReports('all')
            } else {
              fetchReports()
            }
          } else {
            showToast(result.error || 'Failed to mark report as invalid', 'error')
          }
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : 'Failed to mark report as invalid',
            'error'
          )
        } finally {
          setActionLoading(null)
        }
      },
    })
  }

  const handleCreateAdmin = async () => {
    if (!newAdminEmail || !newAdminPassword) {
      showToast('Email and password are required', 'error')
      return
    }

    try {
      setCreatingAdmin(true)
      const response = await fetchWithAuth('/api/admin/users/create-admin', {
        method: 'POST',
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
        }),
      })

      // Try to parse the response as JSON
      let result
      try {
        result = await response.json()
      } catch {
        // If JSON parsing fails, it means the server returned HTML or invalid JSON
        throw new Error(
          'Server error: Unable to process the request. Please check if the backend is running.'
        )
      }

      if (result.success) {
        showToast('Admin account created successfully', 'success')
        setCreateAdminModal(false)
        setNewAdminEmail('')
        setNewAdminPassword('')
        fetchUsers() // Refresh the user list
      } else {
        showToast(result.error || 'Failed to create admin account', 'error')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create admin account', 'error')
    } finally {
      setCreatingAdmin(false)
    }
  }

  const filteredUsers = (Array.isArray(users) ? users : []).filter((user) => {
    // Skip invalid user objects
    if (
      !user ||
      typeof user !== 'object' ||
      !user.name ||
      !user.email ||
      typeof user.name !== 'string' ||
      typeof user.email !== 'string'
    ) {
      return false
    }

    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'banned' && user.banned) ||
      (filterStatus === 'active' && !user.banned)

    return matchesSearch && matchesFilter
  })

  // Middleware handles admin check, so if we reach here, user is authenticated
  // Just show loading if session is not yet loaded
  if (status === 'loading' || !session) {
    return <LoadingSpinner message="Loading admin panel..." />
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
              {/* Search, Filter, and Create Admin Button */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
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
                <button
                  onClick={() => setCreateAdminModal(true)}
                  className="btn btn-primary"
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0.75rem 1.5rem',
                  }}
                >
                  Create Admin
                </button>
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
                    const newStatus = e.target.value as 'all' | 'Pending' | 'Resolved'
                    setReportFilterStatus(newStatus)
                    fetchReports(newStatus)
                  }}
                  className="input"
                  style={{ width: '200px' }}
                >
                  <option value="all">All Reports</option>
                  <option value="Pending">Pending</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              {loading ? (
                <LoadingSpinner message="Loading reports..." />
              ) : groupedReportsArray.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  No reports found
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {groupedReportsArray.map((group) => {
                    const pendingCount = group.reports.filter((r) => r.status === 'Pending').length
                    const resolvedCount = group.reports.filter(
                      (r) => r.status === 'Resolved'
                    ).length
                    const totalCount = group.reports.length

                    return (
                      <div
                        key={group.user.id}
                        style={{
                          padding: '1.5rem',
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                        }}
                      >
                        {/* User Header */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto',
                            gap: '1rem',
                            marginBottom: '1.5rem',
                            paddingBottom: '1rem',
                            borderBottom: '2px solid #e5e7eb',
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
                              <h3 style={{ margin: 0, color: '#111827', fontSize: '1.25rem' }}>
                                {group.user.name || 'Unknown User'}
                              </h3>
                              {group.user.banned && (
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
                                marginBottom: '0.5rem',
                              }}
                            >
                              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                                {group.user.email || 'N/A'}
                              </p>
                              <button
                                onClick={() => router.push(`/profile/${group.user.id}?from=admin`)}
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
                            </div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              <strong>{totalCount}</strong> report{totalCount !== 1 ? 's' : ''} (
                              {pendingCount} Pending, {resolvedCount} Resolved)
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {group.user && (
                              <button
                                onClick={() => {
                                  handleBanFromReport(
                                    group.user.id,
                                    group.reports[0].id,
                                    group.user.banned ? 'unban' : 'ban'
                                  )
                                }}
                                disabled={actionLoading === group.user.id}
                                style={{
                                  padding: '0.5rem 1rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor:
                                    actionLoading === group.user.id ? 'not-allowed' : 'pointer',
                                  backgroundColor: group.user.banned ? '#10b981' : '#ef4444',
                                  color: '#fff',
                                  opacity: actionLoading === group.user.id ? 0.5 : 1,
                                }}
                              >
                                {group.user.banned ? 'Unban User' : 'Ban User'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Reports List */}
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {group.reports.map((report) => (
                            <div
                              key={report.id}
                              style={{
                                padding: '1rem',
                                backgroundColor: '#f9fafb',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  marginBottom: '0.75rem',
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      color: '#374151',
                                      marginBottom: '0.25rem',
                                    }}
                                  >
                                    Reason: {report.reason}
                                  </div>
                                  {report.description && (
                                    <p
                                      style={{
                                        margin: '0.25rem 0 0 0',
                                        color: '#6b7280',
                                        fontSize: '0.9375rem',
                                      }}
                                    >
                                      {report.description}
                                    </p>
                                  )}
                                </div>
                                <div
                                  style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                                >
                                  <span
                                    style={{
                                      padding: '0.375rem 0.75rem',
                                      borderRadius: '999px',
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                      backgroundColor:
                                        report.status === 'Pending' ? '#fef3c7' : '#d1fae5',
                                      color: report.status === 'Pending' ? '#92400e' : '#065f46',
                                    }}
                                  >
                                    {report.status}
                                  </span>
                                  {report.status === 'Pending' && (
                                    <button
                                      onClick={() => handleInvalidReport(report.id)}
                                      disabled={actionLoading === report.id}
                                      style={{
                                        padding: '0.375rem 0.75rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        border: 'none',
                                        cursor:
                                          actionLoading === report.id ? 'not-allowed' : 'pointer',
                                        backgroundColor: '#6b7280',
                                        color: '#fff',
                                        opacity: actionLoading === report.id ? 0.5 : 1,
                                      }}
                                    >
                                      Invalid
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div
                                style={{
                                  fontSize: '0.875rem',
                                  color: '#9ca3af',
                                  paddingTop: '0.75rem',
                                  borderTop: '1px solid #e5e7eb',
                                }}
                              >
                                Reported on {new Date(report.createdAt).toLocaleDateString()} by{' '}
                                {report.reportedBy}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Showing {groupedReportsArray.length} user
                {groupedReportsArray.length !== 1 ? 's' : ''} with {reports.length} total report
                {reports.length !== 1 ? 's' : ''}
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

      {/* Create Admin Modal */}
      {createAdminModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setCreateAdminModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
              Create Admin Account
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Email Address
              </label>
              <input
                type="email"
                className="input"
                placeholder="admin@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                disabled={creatingAdmin}
                style={{
                  width: '100%',
                  borderColor:
                    newAdminEmail && !isValidEmail(newAdminEmail) ? '#ef4444' : undefined,
                }}
              />
              {newAdminEmail && !isValidEmail(newAdminEmail) && (
                <p style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.25rem' }}>
                  Please enter a valid email address
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Password
              </label>
              <input
                type="password"
                className="input"
                placeholder="Enter a secure password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                disabled={creatingAdmin}
                style={{
                  width: '100%',
                  borderColor:
                    newAdminPassword && !isValidPassword(newAdminPassword) ? '#ef4444' : undefined,
                }}
              />
              <p
                style={{
                  fontSize: '0.875rem',
                  color:
                    newAdminPassword && !isValidPassword(newAdminPassword) ? '#ef4444' : '#6b7280',
                  marginTop: '0.5rem',
                }}
              >
                Password must be at least 8 characters long
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setCreateAdminModal(false)
                  setNewAdminEmail('')
                  setNewAdminPassword('')
                }}
                disabled={creatingAdmin}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#374151',
                  cursor: creatingAdmin ? 'not-allowed' : 'pointer',
                  opacity: creatingAdmin ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAdmin}
                disabled={creatingAdmin || !isFormValid()}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem 1.5rem',
                  opacity: creatingAdmin || !isFormValid() ? 0.5 : 1,
                  cursor: creatingAdmin || !isFormValid() ? 'not-allowed' : 'pointer',
                }}
              >
                {creatingAdmin ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
