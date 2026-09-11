'use client'

import React, { useState } from 'react'
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
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { UserProfile, UserRole, Department } from '@/types/afms'

export default function UsersAdminPage() {
  const {
    users,
    currentUser,
    setCurrentUser,
    addUser,
    updateUser,
    deleteUser,
    departments,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    assets,
    roomAccessLogs,
  } = useAFMS()

  // Active Tab: Users or Departments
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users')

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
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Dedicated Password Reset Modal State
  const [resetUser, setResetUser] = useState<UserProfile | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetSuccessMsg, setResetSuccessMsg] = useState('')

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [deptDescription, setDeptDescription] = useState('')
  const [deptHead, setDeptHead] = useState('')

  // User Detail Drawer / Modal State (Assigned Assets & Check-In Logs)
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null)

  // Generate Secure Random Password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
    let result = 'Pass#'
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Open User Create Modal
  const openCreateUserModal = () => {
    setEditingUser(null)
    setFullName('')
    setEmail('')
    setRole('Faculty')
    setSelectedDeptId(departments[0]?.id || '')
    setPhone('+91 98201 00000')
    setAvatarUrl('')
    setPassword('password123')
    setShowPassword(false)
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
    setPassword(u.password || '')
    setShowPassword(false)
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
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const targetDept = departments.find(d => d.id === selectedDeptId)
    const deptNameStr = targetDept ? targetDept.name : ''

    const userPayload: any = {
      fullName,
      email,
      role,
      department: deptNameStr,
      departmentId: selectedDeptId || undefined,
      phone,
      avatarUrl: avatarUrl || undefined,
    }
    if (password.trim()) {
      userPayload.password = password.trim()
      userPayload.passwordLastChanged = new Date().toISOString().split('T')[0]
    }

    if (editingUser) {
      updateUser(editingUser.id, userPayload)
    } else {
      userPayload.password = userPayload.password || 'password123'
      addUser(userPayload)
    }
    setShowUserModal(false)
  }

  // Handle Password Reset by Admin
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetUser || !newPassword.trim()) return
    updateUser(resetUser.id, {
      password: newPassword.trim(),
      passwordLastChanged: new Date().toISOString().split('T')[0],
    })
    setResetSuccessMsg(`Password for ${resetUser.fullName} was updated to: ${newPassword.trim()}`)
  }

  // Handle User Delete
  const handleDeleteUser = (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (confirm(`Are you sure you want to delete user "${name}"?`)) {
      const res = deleteUser(id)
      if (!res.success) {
        alert(res.message || 'Could not delete user.')
      } else if (viewingUser?.id === id) {
        setViewingUser(null)
      }
    }
  }

  // Handle Department Submit
  const handleDeptSubmit = (e: React.FormEvent) => {
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
      addDepartment({
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase() || deptName.substring(0, 3).toUpperCase(),
        description: deptDescription.trim() || undefined,
        headOfDepartment: deptHead.trim() || undefined,
      })
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

  // Filtered users
  const filteredUsers = users.filter(
    u =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <span>Personnel ({users.length})</span>
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
                <p className="text-xs text-slate-400">Click any user row to view assigned assets and check-in history</p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, role, department..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium">
                    <th className="py-3.5 px-6">User Profile</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Contact Details</th>
                    <th className="py-3.5 px-4">Assigned Assets</th>
                    <th className="py-3.5 px-4">Password &amp; Security</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
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
                                <span className="font-mono text-[10px] text-slate-400">{user.id}</span>
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

                          {/* Password & Security Status */}
                          <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono text-slate-400 text-[11px]">••••••••</span>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Configured
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
                              Updated: {user.passwordLastChanged || '2026-02-15'}
                            </p>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => setCurrentUser(user)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                                  currentUser.id === user.id
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700'
                                }`}
                                title="Switch current session to this user"
                              >
                                {currentUser.id === user.id ? 'Active User' : 'Switch'}
                              </button>

                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setResetUser(user)
                                  setNewPassword(generateRandomPassword())
                                  setResetSuccessMsg('')
                                  setShowNewPassword(true)
                                }}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-500 hover:text-amber-700 transition"
                                title="Reset User Password"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

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

              {/* Credential Security & Password Management Card */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs shrink-0">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-amber-950">Password &amp; Security</p>
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                        Active
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                      Last password update: <strong className="font-mono">{viewingUser.passwordLastChanged || '2026-02-15'}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setResetUser(viewingUser)
                    setNewPassword(generateRandomPassword())
                    setResetSuccessMsg('')
                    setShowNewPassword(true)
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Reset User Password</span>
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
                          <span className="font-mono text-[10px] font-bold text-blue-600">{asset.id}</span>
                          <p className="font-bold text-xs text-slate-900">{asset.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {asset.manufacturer || 'General'} {asset.modelNumber ? `• ${asset.modelNumber}` : ''}
                          </p>
                        </div>

                        <Link
                          href={`/assets/${asset.id}`}
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
                      placeholder="user@institute.edu"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
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

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      {editingUser ? 'Account Password (Leave blank to keep unchanged)' : 'Account Password *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateRandomPassword())}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generate Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={editingUser ? '•••••••• (Preserve current password)' : 'Enter password (min 6 characters)'}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Registered users will sign in with this password along with their email address.
                  </p>
                </div>

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
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition"
                  >
                    {editingUser ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </form>
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

        {/* MODAL: ADMIN PASSWORD RESET */}
        {resetUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Reset User Password</h3>
                    <p className="text-[11px] text-slate-500">Update credentials for personnel</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResetUser(null)
                    setResetSuccessMsg('')
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target User Pill */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                  {resetUser.fullName.charAt(0)}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs text-slate-900">{resetUser.fullName}</p>
                    <span className="font-mono text-[10px] text-slate-400">({resetUser.id})</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{resetUser.email} • {resetUser.role}</p>
                </div>
              </div>

              {resetSuccessMsg ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Password Reset Completed!</span>
                  </div>
                  <div className="p-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono text-emerald-950 flex items-center justify-between">
                    <span>{newPassword}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(newPassword)
                        alert('Password copied to clipboard!')
                      }}
                      className="text-emerald-700 hover:text-emerald-900 font-sans text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    The user can now sign in using this new password and their registered email.
                  </p>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => {
                        setResetUser(null)
                        setResetSuccessMsg('')
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">New Password *</label>
                      <button
                        type="button"
                        onClick={() => setNewPassword(generateRandomPassword())}
                        className="text-[11px] text-amber-700 hover:text-amber-900 font-bold inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Generate Secure Password</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500/20 pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                    <p className="font-semibold">Security Note:</p>
                    <p>Changing the password will update the user's login credentials immediately.</p>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setResetUser(null)}
                      className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Set New Password</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
