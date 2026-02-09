import { useEffect, useMemo, useState } from "react";

import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { coursesAPI, getApiErrorMessage, usersAPI } from "@/lib/api";
import type { Membership } from "@/lib/auth";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, ShieldHalf } from "lucide-react";

interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  is_platform_admin: boolean;
  is_active: boolean;
  is_verified: boolean;
}

type PolicyType = "none" | "isu_6_digits" | "email_domain" | "custom_text_validator";

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [filters, setFilters] = useState<{
    username: string;
    isPlatformAdmin: "all" | "true" | "false";
    isActive: "all" | "true" | "false";
    isVerified: "all" | "true" | "false";
  }>({
    username: "",
    isPlatformAdmin: "all",
    isActive: "all",
    isVerified: "all",
  });
  const [createUserForm, setCreateUserForm] = useState({
    username: "",
    full_name: "",
    password: "",
    is_platform_admin: false,
    is_active: true,
    is_verified: false,
  });
  const [courseForm, setCourseForm] = useState({
    slug: "",
    title: "",
    organization: "",
  });
  const [inviteCodes, setInviteCodes] = useState<Record<string, { teacher?: string; student?: string }>>({});
  const [policyDrafts, setPolicyDrafts] = useState<
    Record<string, { rule_type: PolicyType; rule_config: string }>
  >({});
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const filterParams = useMemo(() => {
    return {
      username: filters.username.trim() || undefined,
      isPlatformAdmin:
        filters.isPlatformAdmin === "all" ? undefined : filters.isPlatformAdmin === "true",
      isActive: filters.isActive === "all" ? undefined : filters.isActive === "true",
      isVerified: filters.isVerified === "all" ? undefined : filters.isVerified === "true",
    };
  }, [filters]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await usersAPI.list(filterParams);
      setUsers(response.data.items);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось загрузить пользователей"));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await coursesAPI.list();
      setMemberships(response.data);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось загрузить курсы"));
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleToggle = async (user: AdminUser, field: "is_active" | "is_verified") => {
    try {
      const next = { [field]: !user[field] };
      await usersAPI.update(user.id, next);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...next } : item)));
      toast.success("Пользователь обновлен");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить пользователя"));
    }
  };

  const handlePlatformAdmin = async (user: AdminUser, value: boolean) => {
    try {
      await usersAPI.update(user.id, { is_platform_admin: value });
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? { ...item, is_platform_admin: value } : item))
      );
      toast.success("Права администратора обновлены");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить права администратора"));
    }
  };

  const handleResetPassword = async (userId: string) => {
    const password = resetPasswords[userId]?.trim();
    if (!password) {
      toast.error("Введите новый пароль");
      return;
    }
    try {
      await usersAPI.update(userId, { password });
      setResetPasswords((prev) => ({ ...prev, [userId]: "" }));
      toast.success("Пароль обновлен");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить пароль"));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersAPI.create(createUserForm);
      toast.success("Пользователь создан");
      setCreateUserForm({
        username: "",
        full_name: "",
        password: "",
        is_platform_admin: false,
        is_active: true,
        is_verified: false,
      });
      fetchUsers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось создать пользователя"));
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await coursesAPI.create({
        slug: courseForm.slug.trim(),
        title: courseForm.title.trim(),
        organization: courseForm.organization.trim() || undefined,
      });
      toast.success("Курс создан");
      setCourseForm({ slug: "", title: "", organization: "" });
      fetchCourses();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось создать курс"));
    }
  };

  const handleRotateInvite = async (courseId: string, role: "teacher" | "student") => {
    try {
      const response = await coursesAPI.rotateInviteCode(courseId, { role });
      const inviteCode = response.data.invite_code as string;
      setInviteCodes((prev) => ({
        ...prev,
        [courseId]: {
          ...prev[courseId],
          [role]: inviteCode,
        },
      }));
      toast.success(`Invite-код для ${role === "teacher" ? "преподавателя" : "студента"} обновлен`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось ротировать invite-код"));
    }
  };

  const handleUpdatePolicy = async (courseId: string) => {
    const draft = policyDrafts[courseId] ?? { rule_type: "none" as PolicyType, rule_config: "{}" };
    let ruleConfig: Record<string, unknown> = {};

    try {
      ruleConfig = draft.rule_config.trim() ? JSON.parse(draft.rule_config) : {};
    } catch {
      toast.error("rule_config должен быть валидным JSON");
      return;
    }

    try {
      await coursesAPI.updateIdentityPolicy(courseId, {
        rule_type: draft.rule_type,
        rule_config: ruleConfig,
      });
      toast.success("Identity policy обновлена");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить identity policy"));
    }
  };

  const updatePolicyDraft = (courseId: string, patch: Partial<{ rule_type: PolicyType; rule_config: string }>) => {
    setPolicyDrafts((prev) => ({
      ...prev,
      [courseId]: {
        rule_type: prev[courseId]?.rule_type ?? "none",
        rule_config: prev[courseId]?.rule_config ?? "{}",
        ...patch,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Админ-панель</h1>
            <p className="text-muted-foreground">Пользователи, курсы и invite-политики</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUsers} disabled={loadingUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Пользователи
            </Button>
            <Button variant="outline" onClick={fetchCourses} disabled={loadingCourses}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Курсы
            </Button>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Фильтр пользователей</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="petrov_2026"
                value={filters.username}
                onChange={(event) => setFilters((prev) => ({ ...prev, username: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Platform Admin</Label>
              <Select
                value={filters.isPlatformAdmin}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, isPlatformAdmin: value as "all" | "true" | "false" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="true">Только админы</SelectItem>
                  <SelectItem value="false">Не админы</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Активность</Label>
              <Select
                value={filters.isActive}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, isActive: value as "all" | "true" | "false" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="true">Активные</SelectItem>
                  <SelectItem value="false">Заблокированные</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Верификация</Label>
              <Select
                value={filters.isVerified}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, isVerified: value as "all" | "true" | "false" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="true">Верифицированные</SelectItem>
                  <SelectItem value="false">Неверифицированные</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Создать пользователя</h2>
          <form className="grid md:grid-cols-3 gap-4" onSubmit={handleCreateUser}>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={createUserForm.username}
                onChange={(event) =>
                  setCreateUserForm((prev) => ({ ...prev, username: event.target.value }))
                }
                required
                minLength={3}
                maxLength={64}
                placeholder="petrov_2026"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ФИО</Label>
              <Input
                value={createUserForm.full_name}
                onChange={(event) =>
                  setCreateUserForm((prev) => ({ ...prev, full_name: event.target.value }))
                }
                required
                placeholder="Петр Петров"
              />
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <Input
                type="password"
                value={createUserForm.password}
                onChange={(event) =>
                  setCreateUserForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
                minLength={8}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createUserForm.is_platform_admin}
                onCheckedChange={(value) =>
                  setCreateUserForm((prev) => ({ ...prev, is_platform_admin: value }))
                }
              />
              <Label>Platform Admin</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createUserForm.is_active}
                onCheckedChange={(value) => setCreateUserForm((prev) => ({ ...prev, is_active: value }))}
              />
              <Label>Активен</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createUserForm.is_verified}
                onCheckedChange={(value) =>
                  setCreateUserForm((prev) => ({ ...prev, is_verified: value }))
                }
              />
              <Label>Верифицирован</Label>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Пользователи</h2>
          {loadingUsers ? (
            <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Пользователи не найдены</div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="p-4 border border-border/60">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{user.full_name}</h3>
                        <Badge variant={user.is_platform_admin ? "default" : "secondary"}>
                          {user.is_platform_admin ? "Platform Admin" : "User"}
                        </Badge>
                        {user.is_verified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ShieldHalf className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Platform Admin</Label>
                        <Switch
                          checked={user.is_platform_admin}
                          onCheckedChange={(value) => handlePlatformAdmin(user, value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Активен</Label>
                        <Switch checked={user.is_active} onCheckedChange={() => handleToggle(user, "is_active")} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Верифицирован</Label>
                        <Switch
                          checked={user.is_verified}
                          onCheckedChange={() => handleToggle(user, "is_verified")}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm">Новый пароль</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        value={resetPasswords[user.id] || ""}
                        onChange={(event) =>
                          setResetPasswords((prev) => ({ ...prev, [user.id]: event.target.value }))
                        }
                        placeholder="Введите новый пароль"
                      />
                      <Button variant="outline" onClick={() => handleResetPassword(user.id)}>
                        Сбросить
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Создать курс</h2>
          <form className="grid md:grid-cols-3 gap-4" onSubmit={handleCreateCourse}>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={courseForm.slug}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="itmo-chem-2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={courseForm.title}
                onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="ITMO Chemistry 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Организация</Label>
              <Input
                value={courseForm.organization}
                onChange={(event) =>
                  setCourseForm((prev) => ({ ...prev, organization: event.target.value }))
                }
                placeholder="ITMO"
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Создать курс</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Курсы и invite-политики</h2>
          {loadingCourses ? (
            <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
          ) : memberships.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Нет курсов. Создайте курс выше или присоединитесь по invite-коду.
            </div>
          ) : (
            <div className="space-y-4">
              {memberships.map((membership) => {
                const draft = policyDrafts[membership.course_id] ?? {
                  rule_type: "none" as PolicyType,
                  rule_config: "{}",
                };
                const codes = inviteCodes[membership.course_id];

                return (
                  <Card key={membership.course_id} className="p-4 border border-border/60 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">{membership.course_title}</p>
                        <p className="text-sm text-muted-foreground">
                          slug: {membership.course_slug} | roles: {membership.roles.join(", ")}
                        </p>
                      </div>
                      <Badge variant="secondary">{membership.status}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleRotateInvite(membership.course_id, "teacher")}
                      >
                        Rotate teacher invite
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRotateInvite(membership.course_id, "student")}
                      >
                        Rotate student invite
                      </Button>
                    </div>

                    {(codes?.teacher || codes?.student) && (
                      <div className="rounded border border-border/60 p-3 text-sm space-y-1">
                        {codes.teacher && <p>Teacher invite: {codes.teacher}</p>}
                        {codes.student && <p>Student invite: {codes.student}</p>}
                      </div>
                    )}

                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Policy type</Label>
                        <Select
                          value={draft.rule_type}
                          onValueChange={(value) =>
                            updatePolicyDraft(membership.course_id, { rule_type: value as PolicyType })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none</SelectItem>
                            <SelectItem value="isu_6_digits">isu_6_digits</SelectItem>
                            <SelectItem value="email_domain">email_domain</SelectItem>
                            <SelectItem value="custom_text_validator">custom_text_validator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <Label>rule_config (JSON)</Label>
                        <Textarea
                          value={draft.rule_config}
                          onChange={(event) =>
                            updatePolicyDraft(membership.course_id, { rule_config: event.target.value })
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                    <Button onClick={() => handleUpdatePolicy(membership.course_id)}>
                      Сохранить identity policy
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
