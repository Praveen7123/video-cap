import { useState, useEffect } from "react";
import { AppShell } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiErrorDetail } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [emailModal, setEmailModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);

  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [inviteEmails, setInviteEmails] = useState({});
  const [inviting, setInviting] = useState({});
  const [billingResult, setBillingResult] = useState({});
  const [updatingSeats, setUpdatingSeats] = useState({});

  const fetchTeams = async () => {
    setLoadingTeams(true);
    try {
      const { data } = await api.get("/teams");
      setTeams(data);
    } catch (e) {
      toast.error("Failed to load teams");
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      await api.post("/teams", { name: newTeamName.trim() });
      setNewTeamName("");
      fetchTeams();
      toast.success("Team created");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setCreatingTeam(false);
    }
  };

  const inviteMember = async (teamId) => {
    const email = inviteEmails[teamId] || "";
    if (!email.trim()) return;
    setInviting({ ...inviting, [teamId]: true });
    try {
      await api.post(`/teams/${teamId}/invite`, { email: email.trim() });
      setInviteEmails({ ...inviteEmails, [teamId]: "" });
      fetchTeams();
      toast.success("Member invited");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setInviting({ ...inviting, [teamId]: false });
    }
  };

  const removeMember = async (teamId, email) => {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      await api.delete(`/teams/${teamId}/members/${email}`);
      fetchTeams();
      toast.success("Member removed");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const deleteTeam = async (teamId, teamName) => {
    if (!confirm(`Are you sure you want to delete the team "${teamName}"? All team projects will be moved to Personal workspace.`)) return;
    try {
      await api.delete(`/teams/${teamId}`);
      fetchTeams();
      toast.success("Team deleted");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  const updateSeats = async (teamId, seats) => {
    setUpdatingSeats({ ...updatingSeats, [teamId]: true });
    try {
      const { data } = await api.post("/billing/seats", { team_id: teamId, seats });
      setBillingResult({ ...billingResult, [teamId]: data });
      fetchTeams();
      toast.success(`Seats updated to ${seats}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setUpdatingSeats({ ...updatingSeats, [teamId]: false });
    }
  };

  const nameDirty = name.trim() && name.trim() !== (user?.name || "");

  const saveName = async () => {
    setSavingName(true);
    try {
      const { data } = await api.patch("/account", { name: name.trim() });
      setUser(data);
      toast.success("Name updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <AppShell topbarVariant="app">
      <main className="px-6 md:px-10 py-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-hilite text-black text-2xl font-bold flex items-center justify-center shrink-0">
            {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-xl font-semibold" data-testid="profile-name">{user?.name || "—"}</div>
            <div className="text-sm text-muted-ink">{user?.email}</div>
          </div>
        </div>

        {/* Account */}
        <div className="grid md:grid-cols-[220px_1fr] gap-4 mb-6">
          <div>
            <h2 className="text-base font-medium">Account</h2>
            <p className="mt-1 text-sm text-muted-ink">The email and password you sign in with.</p>
          </div>
          <div className="bg-card border border-line rounded-xl divide-y divide-line">
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-ink">{user?.email}</div>
              </div>
              <button
                onClick={() => setEmailModal(true)}
                data-testid="change-email-btn"
                className="text-sm border border-line rounded-lg px-3 py-1.5 hover:bg-bg-2 transition-colors shrink-0"
              >
                Change email
              </button>
            </div>
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Password</div>
                <div className="text-sm text-muted-ink">••••••••</div>
              </div>
              <button
                onClick={() => setPasswordModal(true)}
                data-testid="change-password-btn"
                className="text-sm border border-line rounded-lg px-3 py-1.5 hover:bg-bg-2 transition-colors shrink-0"
              >
                Change password
              </button>
            </div>
          </div>
        </div>

        {/* Personal details */}
        <div className="grid md:grid-cols-[220px_1fr] gap-4 mb-8">
          <div>
            <h2 className="text-base font-medium">Personal details</h2>
            <p className="mt-1 text-sm text-muted-ink">Your name.</p>
          </div>
          <div className="bg-card border border-line rounded-xl p-4">
            <label className="text-sm font-medium block mb-2">Full Name</label>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="profile-name-input"
                className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-ink/40"
              />
              <button
                onClick={saveName}
                disabled={!nameDirty || savingName}
                data-testid="save-name-btn"
                className="text-sm bg-white text-black rounded-lg px-4 py-2 font-medium hover:bg-hilite disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {savingName ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Teams and Collaboration */}
        <div className="grid md:grid-cols-[220px_1fr] gap-4 border-t border-line pt-8">
          <div>
            <h2 className="text-base font-medium">Teams & Collaboration</h2>
            <p className="mt-1 text-sm text-muted-ink">Collaborate with others on shared workspaces.</p>
          </div>
          <div className="space-y-6">
            {/* Create team */}
            <div className="bg-card border border-line rounded-xl p-4">
              <label className="text-sm font-medium block mb-2" htmlFor="new-team-name-input">Create New Team</label>
              <div className="flex items-center gap-2">
                <input
                  id="new-team-name-input"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Design Team"
                  data-testid="create-team-input"
                  className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-ink/40"
                />
                <button
                  onClick={createTeam}
                  disabled={!newTeamName.trim() || creatingTeam}
                  data-testid="create-team-btn"
                  className="text-sm bg-white text-black rounded-lg px-4 py-2 font-medium hover:bg-hilite disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {creatingTeam ? "Creating..." : "Create"}
                </button>
              </div>
            </div>

            {/* List teams */}
            {loadingTeams && teams.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-ink">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-ink border border-dashed border-line rounded-xl">
                You do not belong to any teams yet.
              </div>
            ) : (
              teams.map((t) => (
                <div key={t.id} className="bg-card border border-line rounded-xl p-6 spaces-y-6 space-y-6" data-testid={`team-card-${t.id}`}>
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <h3 className="text-base font-semibold text-white">{t.name}</h3>
                    <button
                      onClick={() => deleteTeam(t.id, t.name)}
                      data-testid={`delete-team-btn-${t.id}`}
                      className="text-xs text-red-500 hover:text-red-400 font-medium hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      Delete Team
                    </button>
                  </div>

                  {/* Team Members */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">Members</h4>

                    {/* Member rows */}
                    <div className="border border-line rounded-lg divide-y divide-line overflow-hidden max-h-48 overflow-y-auto">
                      {t.members && t.members.map((m) => (
                        <div key={m.id} className="p-3 flex items-center justify-between text-sm bg-bg-2">
                          <div>
                            <span className="font-medium text-white">{m.name}</span>
                            <span className="ml-2 text-xs text-muted-ink">({m.email})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {m.user_id ? (
                              <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">Joined</span>
                            ) : (
                              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded px-1.5 py-0.5 uppercase tracking-wide font-medium">Pending</span>
                            )}
                            {m.email !== user?.email && (
                              <button
                                onClick={() => removeMember(t.id, m.email)}
                                data-testid={`remove-member-${m.email}`}
                                className="text-xs text-red-500 hover:text-red-400 font-medium ml-2"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Invite Section */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="email"
                        value={inviteEmails[t.id] || ""}
                        onChange={(e) => setInviteEmails({ ...inviteEmails, [t.id]: e.target.value })}
                        placeholder="newmember@example.com"
                        data-testid={`invite-email-input-${t.id}`}
                        className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-ink/40"
                      />
                      <button
                        onClick={() => inviteMember(t.id)}
                        disabled={!inviteEmails[t.id]?.trim() || inviting[t.id]}
                        data-testid={`invite-btn-${t.id}`}
                        className="text-xs bg-[#444] text-white hover:bg-[#555] rounded-lg px-4 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        {inviting[t.id] ? "Inviting..." : "Invite"}
                      </button>
                    </div>
                  </div>

                  {/* Seating and Billing */}
                  <div className="pt-4 border-t border-line space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-ink">Seating & Billing</h4>
                    <div className="flex items-center justify-between bg-bg-2 p-3 border border-line rounded-lg flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Seats:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateSeats(t.id, Math.max(1, t.seats - 1))}
                            disabled={t.seats <= 1 || updatingSeats[t.id]}
                            data-testid={`decrement-seats-${t.id}`}
                            className="w-7 h-7 rounded border border-line bg-card flex items-center justify-center text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <span className="font-semibold px-2" data-testid={`seat-count-${t.id}`}>{t.seats}</span>
                          <button
                            onClick={() => updateSeats(t.id, t.seats + 1)}
                            disabled={updatingSeats[t.id]}
                            data-testid={`increment-seats-${t.id}`}
                            className="w-7 h-7 rounded border border-line bg-card flex items-center justify-center text-sm font-bold text-white hover:bg-neutral-800 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Subscription price indicator */}
                      <div className="text-right">
                        <div className="text-xs text-muted-ink">Subscription Fee</div>
                        <div className="text-sm font-mono font-bold text-[#ff5c00]" data-testid={`subscription-total-${t.id}`}>
                          {billingResult[t.id]
                            ? `₹${billingResult[t.id].total_price} / mo`
                            : `₹${t.seats * 400} / mo`
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {emailModal && <ChangeEmailModal onClose={() => setEmailModal(false)} currentEmail={user?.email} />}
      {passwordModal && <ChangePasswordModal onClose={() => setPasswordModal(false)} currentEmail={user?.email} />}
    </AppShell>
  );
}

function ChangeEmailModal({ onClose, currentEmail }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      // Re-verify identity with the current password before letting the
      // email change through — Supabase's updateUser() trusts the existing
      // session alone, so this re-check is the only thing standing in for
      // the "current_password" confirmation the old backend route used to do.
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
      if (signInError) throw new Error("Current password is incorrect");
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });
      if (updateError) throw updateError;
      toast.success("Check your new email address to confirm the change.");
      onClose();
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Change email" onClose={onClose}>
      <Field label="New email" type="email" value={newEmail} onChange={setNewEmail} autoFocus />
      <Field label="Current password" type="password" value={password} onChange={setPassword} />
      {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
      <ModalActions onClose={onClose} onSubmit={submit} disabled={!newEmail || !password || saving} label={saving ? "Saving…" : "Save changes"} />
    </Modal>
  );
}

function ChangePasswordModal({ onClose, currentEmail }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const mismatch = next && confirm && next !== confirm;

  const submit = async () => {
    setError("");
    if (next !== confirm) { setError("Passwords do not match"); return; }
    setSaving(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: currentEmail, password: current });
      if (signInError) throw new Error("Current password is incorrect");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      toast.success("Password updated");
      onClose();
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Change password" onClose={onClose}>
      <Field label="Current password" type="password" value={current} onChange={setCurrent} autoFocus />
      <Field label="New password" type="password" value={next} onChange={setNext} />
      <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} error={mismatch ? "Passwords do not match" : null} />
      {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
      <ModalActions onClose={onClose} onSubmit={submit} disabled={!current || next.length < 6 || mismatch || saving} label={saving ? "Saving…" : "Save changes"} />
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, autoFocus, error }) {
  return (
    <div className="mb-4">
      <label className="text-xs text-muted-ink block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className={`w-full bg-bg-2 border rounded-lg px-3 py-2 text-sm outline-none transition-colors ${error ? "border-red-500/60" : "border-line focus:border-ink/40"}`}
      />
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
    </div>
  );
}

function ModalActions({ onClose, onSubmit, disabled, label }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-2">
      <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-ink hover:text-ink hover:bg-bg-2 transition-colors">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={disabled}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-hilite disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>
    </div>
  );
}
