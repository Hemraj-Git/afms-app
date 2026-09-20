'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAFMS } from '@/context/AFMSContext'
import { AppLayout } from '@/components/AppLayout'
import {
  Users,
  UserCheck,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  Shield,
  Building2,
  Boxes,
  LogIn,
  LogOut,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  FolderTree,
  UserPlus,
  Loader2,
  ClipboardList,
  QrCode,
} from 'lucide-react'
import { UserProfile, UserRole, Department, ServiceRequest } from '@/types/afms'
import { inviteUser } from '@/app/actions/users'
import { formatDateDisplay } from '@/lib/dateUtils'

export default function UsersAdminPage() {
  const {
    users,
    addInvitedUser,
    updateUser,
    deleteUser,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    assets,
    roomAccessLogs,
    serviceRequests,
  } = useAFMS()

  // Active Tab: Users or Departments
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users')

  // Personnel Sub-Tab: Registered (real accounts) or Guests (anonymous visitor logins)
  const [personnelSubTab, setPersonnelSubTab] = useState<'registered' | 'guests'>('registered')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [deptSearchQuery, setDeptSearchQuery] = useState('')

  // User Modal State
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('Faculty')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccessEmail, setInviteSuccessEmail] = useState('')

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [deptDescription, setDeptDescription] = useState('')
  const [deptHead, setDeptHead] = useState('')

  // User Detail Drawer / Modal State (Assigned Assets & Check-In Logs)
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null)

  // Guest identity: every guest login mints a fresh anonymous profiles row
  // (there's no persistent auth account to key off), so guests are grouped
  // by lower-cased email into one visitor per group for display/detail.
  type GuestGroup = {
    email: string
    fullName: string
    phone: string
    profileIds: string[]
    visitCount: number
    firstSeen?: string
    lastSeen?: string
  }
  const [viewingGuestGroup, setViewingGuestGroup] = useState<GuestGroup | null>(null)

  // Open User Create Modal
  const openCreateUserModal = () => {
    setEditingUser(null)
    setFullName('')
    setEmail('')
    setRole('Faculty')
    setSelectedDeptId(departments[0]?.id || '')
    setPhone('+91 98201 00000')
    setAvatarUrl('')
    setInviteError('')
    setInviteSuccessEmail('')
    setShowUserModal(true)
  }

  // Open User Edit Modal
  const openEditUserModal = (u: UserProfile, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingUser(u)
    setFullName(u.fullName)
    setEmail(u.email)
    setRole(u.role)
    const matchingDept = departments.find(d => d.id === u.departmentId || d.name === u.department)
    setSelectedDeptId(matchingDept ? matchingDept.id : departments[0]?.id || '')
    setPhone(u.phone || '')
    setAvatarUrl(u.avatarUrl || '')
    setInviteError('')
    setInviteSuccessEmail('')
    setShowUserModal(true)
  }

  // Open Department Create Modal
  const openCreateDeptModal = () => {
    setEditingDept(null)
    setDeptName('')
    setDeptCode('')
    setDeptDescription('')
    setDeptHead('')
    setShowDeptModal(true)
  }

  // Open Department Edit Modal
  const openEditDeptModal = (d: Department) => {
    setEditingDept(d)
    setDeptName(d.name)
    setDeptCode(d.code)
    setDeptDescription(d.description || '')
    setDeptHead(d.headOfDepartment || '')
    setShowDeptModal(true)
  }

  // Handle User Submit
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetDept = departments.find(d => d.id === selectedDeptId)
    const deptNameStr = targetDept ? targetDept.name : ''

    if (editingUser) {
      // Saved through an Admin-verified server action; on failure the change is
      // rolled back, a toast explains why, and the modal stays open.
      setIsInviting(true)
      const res = await updateUser(editingUser.id, {
        fullName,
        role,
        department: deptNameStr,
        departmentId: selectedDeptId || undefined,
        phone,
        avatarUrl: avatarUrl || undefined,
      })
      setIsInviting(false)
      if (res.success) setShowUserModal(false)
      return
    }

    setInviteError('')
    setIsInviting(true)
    try {
      const result = await inviteUser({
        email,
        fullName,
        role,
        department: deptNameStr,
        phone,
      })
      if (!result.success) {
        setInviteError(result.error)
        return
      }
      addInvitedUser({
        id: result.profile.id,
        email: result.profile.email,
        fullName: result.profile.fullName,
        role: result.profile.role,
        department: result.profile.department,
        departmentId: selectedDeptId || undefined,
        phone: result.profile.phone,
      })
      setInviteSuccessEmail(result.profile.email)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send the invite.')
    } finally {
      setIsInviting(false)
    }
  }

  // Handle User Delete
  const handleDeleteUser = async (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (confirm(`Are you sure you want to delete user "${name}"?`)) {
      // deleteUser reports any failure itself (toast) and restores the row.
      const res = await deleteUser(id)
      if (res.success && viewingUser?.id === id) {
        setViewingUser(null)
      }
    }
  }

  // Handle Department Submit
  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptName.trim()) {
      alert('Department name is required.')
      return
    }

    if (editingDept) {
      updateDepartment(editingDept.id, {
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase() || deptName.substring(0, 3).toUpperCase(),
        description: deptDescription.trim() || undefined,
        headOfDepartment: deptHead.trim() || undefined,
      })
    } else {
      try {
        await addDepartment({
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase() || deptName.substring(0, 3).toUpperCase(),
          description: deptDescription.trim() || undefined,
          headOfDepartment: deptHead.trim() || undefined,
        })
      } catch {
        // Not saved (a toast already says why). Keep the form open so nothing typed is lost.
        return
      }
    }
    setShowDeptModal(false)
  }

  // Handle Department Delete with Dependency Check
  const handleDeleteDept = (d: Department) => {
    if (confirm(`Are you sure you want to delete department "${d.name}" (${d.id})?`)) {
      const res = deleteDepartment(d.id)
      if (!res.success) {
        alert(res.message || 'Cannot delete department.')
      }
    }
  }

  // Registered (real, invited) accounts only -- Guests live in their own tab
  const registeredUsers = users.filter(u => u.role !== 'Guest')

  // Filtered users
  const filteredUsers = registeredUsers.filter(
    u =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Guests grouped by lower-cased email -- one row per returning visitor,
  // even though each of their logins created its own profiles row.
  const guestGroups: GuestGroup[] = useMemo(() => {
    const map = new Map<string, GuestGroup>()
    users
      .filter(u => u.role === 'Guest' && u.email)
      .forEach(g => {
        const key = g.email.toLowerCase()
        const existing = map.get(key)
        if (!existing) {
          map.set(key, {
            email: key,
            fullName: g.fullName,
            phone: g.phone || '',
            profileIds: [g.id],
            visitCount: 1,
            firstSeen: g.createdAt,
            lastSeen: g.createdAt,
          })
          return
        }
        existing.profileIds.push(g.id)
        existing.visitCount += 1
        if (g.createdAt && (!existing.lastSeen || g.createdAt > existing.lastSeen)) {
          existing.lastSeen = g.createdAt
          existing.fullName = g.fullName
          existing.phone = g.phone || existing.phone
        }
        if (g.createdAt && (!existing.firstSeen || g.createdAt < existing.firstSeen)) {
          existing.firstSeen = g.createdAt
        }
      })
    return Array.from(map.values()).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''))
  }, [users])

  const filteredGuestGroups = guestGroups.filter(
    g =>
      g.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.phone.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Filtered departments
  const filteredDepts = departments.filter(
    d =>
      d.name.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
      d.code.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(deptSearchQuery.toLowerCase()))
  )

  // Role Badge Helper
  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'Admin':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Admin</span>
      case 'Faculty':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Faculty</span>
      case 'Technician':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Technician</span>
      case 'Housekeeping':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Housekeeping</span>
    }
  }

  // Assets assigned to the viewing user
  const userAssignedAssets = viewingUser
    ? assets.filter(a => a.assignedToUserId === viewingUser.id || a.assignedToUserName === viewingUser.fullName)
    : []

  // CheckIn / CheckOut access logs of viewing user
  const userAccessLogs = viewingUser
    ? roomAccessLogs.filter(l => l.userId === viewingUser.id || l.userName === viewingUser.fullName)
    : []

  // Service requests raised by the viewing registered user
  const userRaisedRequests = viewingUser
    ? serviceRequests.filter(sr => sr.requestedByUserId === viewingUser.id)
    : []

  // Access log + raised requests for the viewing guest group, matched across
  // every profiles row that shares this guest's email
  const guestAccessLogs = viewingGuestGroup
    ? roomAccessLogs.filter(l => viewingGuestGroup.profileIds.includes(l.userId))
    : []
  const guestRaisedRequests = viewingGuestGroup
    ? serviceRequests.filter(sr => sr.requestedByEmail?.toLowerCase() === viewingGuestGroup.email)
    : []

  return (
    <AppLayout breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Admin' }, { label: 'Users & Departments' }]}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Personnel &amp; Departments</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage institute staff, departmental affiliations, and view custodian asset allocations &amp; access logs
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'users' ? (
              <button
                onClick={openCreateUserModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            ) : (
              <button
                onClick={openCreateDeptModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Personnel ({registeredUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments ({departments.length})</span>
          </button>
        </div>

        {/* TAB 1: USERS MASTER LIST */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden animate-in fade-in">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Institute Personnel Directory</h2>
                <p className="text-xs text-slate-400">
                  {personnelSubTab === 'registered'
                    ? 'Click any user row to view assigned assets, access log, and raised requests'
                    : 'Click any visitor row to view their access log and raised requests'}
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={personnelSubTab === 'registered' ? 'Search by name, role, department...' : 'Search by name, email, phone...'}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Registered / Guests Sub-Tab Pills */}
            <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center gap-2">
              <button
                onClick={() => setPersonnelSubTab('registered')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                  personnelSubTab === 'registered'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Registered ({registeredUsers.length})</span>
              </button>
              <button
                onClick={() => setPersonnelSubTab('guests')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                  personnelSubTab === 'guests'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Guests ({guestGroups.length})</span>
              </button>
            </div>

            {personnelSubTab === 'registered' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">User Profile</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Assigned Assets</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No personnel found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(user => {
                      const countAssigned = assets.filter(
                        a => a.assignedToUserId === user.id || a.assignedToUserName === user.fullName
                      ).length

                      return (
                        <tr
                          key={user.id}
                          onClick={() => setViewingUser(user)}
                          className="hover:bg-blue-50/40 transition cursor-pointer group"
                        >
                          {/* User Profile */}
                          <td className="py-4 px-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0 border border-blue-200">
                              {user.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                                  {user.fullName}
                                </p>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{user.email}</p>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-4 px-4">{getRoleBadge(user.role)}</td>

                          {/* Department */}
                          <td className="py-4 px-4">
                            <span className="font-semibold text-slate-800">{user.department || 'General'}</span>
                          </td>

                          {/* Phone */}
                          <td className="py-4 px-4 text-slate-600 font-mono">
                            {user.phone || '—'}
                          </td>

                          {/* Assigned Assets Count */}
                          <td className="py-4 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                countAssigned > 0
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              {countAssigned} {countAssigned === 1 ? 'Asset' : 'Assets'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={e => openEditUserModal(user, e)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                                title="Edit User Profile"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={e => handleDeleteUser(user.id, user.fullName, e)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Guest Profile</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Visits</th>
                    <th className="py-3.5 px-4">Last Visit</th>
                    <th className="py-3.5 px-6 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGuestGroups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No guest visitors found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredGuestGroups.map(group => (
                      <tr
                        key={group.email}
                        onClick={() => setViewingGuestGroup(group)}
                        className="hover:bg-blue-50/40 transition cursor-pointer group"
                      >
                        {/* Guest Profile */}
                        <td className="py-4 px-6 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm shrink-0 border border-slate-200">
                            {group.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                              {group.fullName}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{group.email}</p>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-4 text-slate-600 font-mono">
                          {group.phone || '—'}
                        </td>

                        {/* Visit Count */}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-200">
                            {group.visitCount} {group.visitCount === 1 ? 'Visit' : 'Visits'}
                          </span>
                        </td>

                        {/* Last Visit */}
                        <td className="py-4 px-4 text-slate-500">
                          {group.lastSeen ? new Date(group.lastSeen).toLocaleDateString() : '—'}
                        </td>

                        {/* View Chevron */}
                        <td className="py-4 px-6 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 inline-block transition" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* TAB 2: DEPARTMENTS MANAGEMENT */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden animate-in fade-in">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Institute Departments ({departments.length})</h2>
                <p className="text-xs text-slate-400">
                  Departments linked with any user cannot be deleted to preserve organizational taxonomy.
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={deptSearchQuery}
                  onChange={e => setDeptSearchQuery(e.target.value)}
                  placeholder="Search departments..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">Department Code</th>
                    <th className="py-3.5 px-4">Department Name</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Head of Department</th>
                    <th className="py-3.5 px-4">Assigned Personnel</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDepts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No departments found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDepts.map(dept => {
                      const linkedUsers = users.filter(
                        u => u.departmentId === dept.id || u.department === dept.name
                      )
                      const isLinked = linkedUsers.length > 0

                      return (
                        <tr key={dept.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-4 px-6 font-mono font-bold text-blue-600">
                            {dept.code || dept.id}
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-900">{dept.name}</td>
                          <td className="py-4 px-4 text-slate-500 max-w-sm">
                            {dept.description || '—'}
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-medium">
                            {dept.headOfDepartment || '—'}
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isLinked
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {linkedUsers.length} {linkedUsers.length === 1 ? 'User' : 'Users'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditDeptModal(dept)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                                title="Edit Department"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteDept(dept)}
                                className={`p-1.5 rounded-lg transition ${
                                  isLinked
                                    ? 'opacity-40 cursor-not-allowed text-slate-300 hover:bg-transparent'
                                    : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                }`}
                                title={
                                  isLinked
                                    ? `Cannot delete: Department is linked with ${linkedUsers.length} users.`
                                    : 'Delete Department'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DRAWER / MODAL: USER DETAILS (ASSIGNED ASSETS & CHECK-IN LOGS) */}
        {viewingUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold border border-blue-200">
                    {viewingUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{viewingUser.fullName}</h3>
                      <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {viewingUser.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {viewingUser.email} • {viewingUser.role} • {viewingUser.department || 'Staff'} • {viewingUser.phone || 'No phone'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingUser(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>


              {/* Section 1: Assigned Assets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    <span>Assigned Assets ({userAssignedAssets.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Assets under this user's custody</span>
                </div>

                {userAssignedAssets.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-600">No Assets Assigned</p>
                    <p className="text-[11px] text-slate-400">
                      Assets can be assigned to this user from the Add Asset Wizard or Asset Hub.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userAssignedAssets.map(asset => (
                      <div
                        key={asset.id}
                        className="bg-slate-50 hover:bg-blue-50/50 p-3.5 rounded-xl border border-slate-200/70 transition flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-[10px] font-bold text-blue-600">{asset.assetId}</span>
                          <p className="font-bold text-xs text-slate-900">{asset.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {asset.manufacturer || 'General'} {asset.modelNumber ? `• ${asset.modelNumber}` : ''}
                          </p>
                        </div>

                        <Link
                          href={`/assets/${asset.assetId}`}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold shadow-2xs transition inline-flex items-center gap-1"
                        >
                          <span>Hub</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Check-In & Check-Out Access Logs */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Facility Check-In / Check-Out Log ({userAccessLogs.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Room access history log</span>
                </div>

                {userAccessLogs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-600">No Room Check-In History</p>
                    <p className="text-[11px] text-slate-400">
                      When this user scans room QR codes or checks in, the access history will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                    {userAccessLogs.map(log => (
                      <div key={log.id} className="pt-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{log.roomName}</p>
                          <p className="text-[11px] text-slate-400">{log.purpose || 'Routine Access'}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-mono">{formatDateDisplay(log.checkInDate)}</p>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                              <LogIn className="w-3 h-3" />
                              {log.checkInTime}
                            </span>
                            {log.checkOutTime && (
                              <span className="text-slate-500 flex items-center gap-1">
                                <LogOut className="w-3 h-3" />
                                {log.checkOutTime}
                              </span>
                            )}
                          </div>
                          {!log.checkOutTime && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                              Currently Inside Room
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Raised Service Requests */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-600" />
                    <span>Raised Service Requests ({userRaisedRequests.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Tickets submitted by this user</span>
                </div>
                <ServiceRequestList requests={userRaisedRequests} />
              </div>

              {/* Drawer Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DRAWER / MODAL: GUEST DETAILS (ACCESS LOG & RAISED REQUESTS ONLY -- no assigned assets, guests are never assignable) */}
        {viewingGuestGroup && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center text-xl font-bold border border-slate-200">
                    {viewingGuestGroup.fullName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">{viewingGuestGroup.fullName}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Guest
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {viewingGuestGroup.email} • {viewingGuestGroup.phone || 'No phone'} •{' '}
                      {viewingGuestGroup.visitCount} {viewingGuestGroup.visitCount === 1 ? 'visit' : 'visits'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingGuestGroup(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Section 1: Check-In & Check-Out Access Logs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span>Facility Check-In / Check-Out Log ({guestAccessLogs.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Room access history across all visits</span>
                </div>

                {guestAccessLogs.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-600">No Room Check-In History</p>
                    <p className="text-[11px] text-slate-400">
                      When this visitor scans room QR codes or checks in, the access history will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                    {guestAccessLogs.map(log => (
                      <div key={log.id} className="pt-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{log.roomName}</p>
                          <p className="text-[11px] text-slate-400">{log.purpose || 'Routine Access'}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-mono">{formatDateDisplay(log.checkInDate)}</p>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                              <LogIn className="w-3 h-3" />
                              {log.checkInTime}
                            </span>
                            {log.checkOutTime && (
                              <span className="text-slate-500 flex items-center gap-1">
                                <LogOut className="w-3 h-3" />
                                {log.checkOutTime}
                              </span>
                            )}
                          </div>
                          {!log.checkOutTime && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                              Currently Inside Room
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Raised Service Requests */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-600" />
                    <span>Raised Service Requests ({guestRaisedRequests.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">Tickets submitted across all visits</span>
                </div>
                <ServiceRequestList requests={guestRaisedRequests} />
              </div>

              {/* Drawer Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingGuestGroup(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT USER */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingUser ? 'Edit User Profile' : 'Add New Personnel'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Configure credentials and role privileges</p>
                  </div>
                </div>
                <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!editingUser && inviteSuccessEmail ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 text-xs animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Invite sent!</span>
                  </div>
                  <p className="text-emerald-800">
                    A real Supabase Auth account was created and an invite email was sent to{' '}
                    <strong className="font-mono">{inviteSuccessEmail}</strong>. They&apos;ll set their own
                    password from that email before they can sign in.
                  </p>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowUserModal(false)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleUserSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Captain James Cook"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      readOnly={!!editingUser}
                      title={editingUser ? 'Email is the sign-in identity and cannot be changed here' : undefined}
                      placeholder="user@institute.edu"
                      className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 ${editingUser ? 'text-slate-500 cursor-not-allowed' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Faculty">Faculty</option>
                      <option value="Technician">Technician</option>
                      <option value="Housekeeping">Housekeeping</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department</label>
                    <select
                      value={selectedDeptId}
                      onChange={e => setSelectedDeptId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code || d.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98201 00000"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-mono bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {!editingUser && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-900">
                    This sends a real invite email through Supabase Auth — the person sets their own password
                    from that email before they can sign in. No password is ever set or stored here.
                  </div>
                )}

                {inviteError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xs transition flex items-center gap-2"
                  >
                    {isInviting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{editingUser ? 'Save Changes' : isInviting ? 'Sending Invite...' : 'Send Invite'}</span>
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL: ADD / EDIT DEPARTMENT */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingDept ? 'Edit Department' : 'Add New Department'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Configure organizational department hierarchy</p>
                  </div>
                </div>
                <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDeptSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Department Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={e => setDeptName(e.target.value)}
                    placeholder="e.g. Maritime Studies, Engineering"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Department Code</label>
                    <input
                      type="text"
                      value={deptCode}
                      onChange={e => setDeptCode(e.target.value)}
                      placeholder="e.g. ENG, ACAD"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl font-mono uppercase bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Head of Department</label>
                    <input
                      type="text"
                      value={deptHead}
                      onChange={e => setDeptHead(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={deptDescription}
                    onChange={e => setDeptDescription(e.target.value)}
                    placeholder="Department responsibilities and operations overview..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowDeptModal(false)}
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {editingDept ? 'Save Changes' : 'Create Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

// Shared list of service-request tickets, used by both the registered-user
// and guest detail drawers.
function srStatusBadgeClasses(status: ServiceRequest['status']) {
  switch (status) {
    case 'Open':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'In Progress':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'Resolved':
    case 'Closed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'Escalated':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function ServiceRequestList({ requests }: { requests: ServiceRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
        <p className="text-xs font-semibold text-slate-600">No Service Requests Raised</p>
        <p className="text-[11px] text-slate-400">
          Requests raised via the mobile app or a scanned QR code will appear here.
        </p>
      </div>
    )
  }
  return (
    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
      {requests.map(sr => (
        <div key={sr.id} className="pt-2 flex items-center justify-between text-xs gap-3">
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{sr.title}</p>
            <p className="text-[11px] text-slate-400 font-mono">{sr.ticketId}</p>
          </div>
          <div className="text-right shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${srStatusBadgeClasses(sr.status)}`}>
              {sr.status}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">{new Date(sr.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
