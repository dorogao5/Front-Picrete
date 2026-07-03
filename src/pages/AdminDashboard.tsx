import { useEffect, useMemo, useState } from "react";
import { GraduationCap, KeyRound, RefreshCw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
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

interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  is_platform_admin: boolean;
  is_active: boolean;
}

type PolicyType = "none" | "isu_6_digits" | "email_domain" | "custom_text_validator";
type CourseRoleChoice = "teacher" | "student";

const NO_COURSE_VALUE = "__none__";

const AdminDashboard = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [filters, setFilters] = useState<{
    username: string;
    isPlatformAdmin: "all" | "true" | "false";
    isActive: "all" | "true" | "false";
  }>({
    username: "",
    isPlatformAdmin: "all",
    isActive: "all",
  });
  const [createUserForm, setCreateUserForm] = useState({
    username: "",
    full_name: "",
    password: "",
    is_platform_admin: false,
    is_active: true,
    course_id: NO_COURSE_VALUE,
    course_role: "teacher" as CourseRoleChoice,
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
  const [memberAssignments, setMemberAssignments] = useState<
    Record<string, { course_id: string; course_role: CourseRoleChoice }>
  >({});
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  const filterParams = useMemo(() => {
    return {
      username: filters.username.trim() || undefined,
      isPlatformAdmin:
        filters.isPlatformAdmin === "all" ? undefined : filters.isPlatformAdmin === "true",
      isActive: filters.isActive === "all" ? undefined : filters.isActive === "true",
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

  const handleToggle = async (user: AdminUser, field: "is_active") => {
    try {
      const next = { [field]: !user[field] };
      await usersAPI.update(user.id, next);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...next } : item)));
      toast.success("Пользователь обновлён");
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
      toast.success("Пароль обновлён");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить пароль"));
    }
  };

  const assignCourseRole = async (
    userId: string,
    courseId: string,
    role: CourseRoleChoice,
    successMessage = "Роль в курсе назначена"
  ) => {
    if (!courseId || courseId === NO_COURSE_VALUE) {
      toast.error("Выберите курс");
      return;
    }

    await coursesAPI.assignMember(courseId, { user_id: userId, role });
    toast.success(successMessage);
  };

  const handleAssignExistingUser = async (user: AdminUser) => {
    const assignment = memberAssignments[user.id] ?? {
      course_id: memberships[0]?.course_id ?? NO_COURSE_VALUE,
      course_role: "teacher" as CourseRoleChoice,
    };

    try {
      await assignCourseRole(
        user.id,
        assignment.course_id,
        assignment.course_role,
        `${assignment.course_role === "teacher" ? "Преподаватель" : "Студент"} назначен в курс`
      );
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось назначить роль в курсе"));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { course_id, course_role, ...userPayload } = createUserForm;
      const response = await usersAPI.create(userPayload);

      if (course_id !== NO_COURSE_VALUE) {
        await assignCourseRole(
          response.data.id,
          course_id,
          course_role,
          `Пользователь создан как ${course_role === "teacher" ? "преподаватель" : "студент"}`
        );
      } else {
        toast.success("Пользователь создан");
      }

      setCreateUserForm({
        username: "",
        full_name: "",
        password: "",
        is_platform_admin: false,
        is_active: true,
        course_id: NO_COURSE_VALUE,
        course_role: "teacher",
      });
      fetchUsers();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось создать пользователя или назначить роль"));
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
      toast.success(
        `Код приглашения для ${role === "teacher" ? "преподавателя" : "студента"} обновлён`
      );
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить код приглашения"));
    }
  };

  const handleUpdatePolicy = async (courseId: string) => {
    const draft = policyDrafts[courseId] ?? { rule_type: "none" as PolicyType, rule_config: "{}" };
    let ruleConfig: Record<string, unknown> = {};

    try {
      ruleConfig = draft.rule_config.trim() ? JSON.parse(draft.rule_config) : {};
    } catch {
      toast.error("Настройки правила должны быть валидным JSON");
      return;
    }

    try {
      await coursesAPI.updateIdentityPolicy(courseId, {
        rule_type: draft.rule_type,
        rule_config: ruleConfig,
      });
      toast.success("Политика идентификации обновлена");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось обновить политику идентификации"));
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(
      `Удалить пользователя @${user.username}? Он будет полностью удалён из базы вместе с записями об участии в курсах.`
    );
    if (!confirmed) return;

    setDeletingUserId(user.id);
    try {
      await usersAPI.delete(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setResetPasswords((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      toast.success("Пользователь удалён");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось удалить пользователя"));
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteCourse = async (membership: Membership) => {
    const confirmed = window.confirm(
      `Удалить курс «${membership.course_title}» (${membership.course_slug})? Курс и все связанные данные будут полностью удалены из базы.`
    );
    if (!confirmed) return;

    setDeletingCourseId(membership.course_id);
    try {
      await coursesAPI.delete(membership.course_id);
      setMemberships((prev) => prev.filter((item) => item.course_id !== membership.course_id));
      setInviteCodes((prev) => {
        const next = { ...prev };
        delete next[membership.course_id];
        return next;
      });
      setPolicyDrafts((prev) => {
        const next = { ...prev };
        delete next[membership.course_id];
        return next;
      });
      toast.success("Курс удалён");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Не удалось удалить курс"));
    } finally {
      setDeletingCourseId(null);
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
    <PageShell
      width="wide"
      title="Админ-панель"
      subtitle="Пользователи, курсы и коды приглашений"
      actions={
        <>
          <Button variant="outline" className="gap-1.5" onClick={fetchUsers} disabled={loadingUsers}>
            <RefreshCw className="h-4 w-4" />
            Обновить пользователей
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={fetchCourses} disabled={loadingCourses}>
            <RefreshCw className="h-4 w-4" />
            Обновить курсы
          </Button>
        </>
      }
    >
      <div className="space-y-10">
        <section>
          <h2 className="section-rule mb-4 text-xl font-semibold">Поиск пользователей</h2>
          <Card className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Логин</Label>
                <Input
                  placeholder="petrov_2026"
                  value={filters.username}
                  onChange={(event) => setFilters((prev) => ({ ...prev, username: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Права</Label>
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
                    <SelectItem value="false">Без прав админа</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
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
            </div>
          </Card>
        </section>

        <section>
          <h2 className="section-rule mb-4 text-xl font-semibold">Новый пользователь</h2>
          <Card className="p-6">
            <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateUser}>
              <div className="space-y-2">
                <Label>Логин</Label>
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
                  placeholder="Пётр Петров"
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
                <p className="text-xs text-muted-foreground">Минимум 8 символов</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={createUserForm.is_platform_admin}
                  onCheckedChange={(value) =>
                    setCreateUserForm((prev) => ({ ...prev, is_platform_admin: value }))
                  }
                />
                <Label>Админ платформы</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={createUserForm.is_active}
                  onCheckedChange={(value) => setCreateUserForm((prev) => ({ ...prev, is_active: value }))}
                />
                <Label>Активен</Label>
              </div>
              <div className="space-y-2">
                <Label>Курс</Label>
                <Select
                  value={createUserForm.course_id}
                  onValueChange={(value) =>
                    setCreateUserForm((prev) => ({ ...prev, course_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Без курса" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_COURSE_VALUE}>Без курса</SelectItem>
                    {memberships.map((membership) => (
                      <SelectItem key={membership.course_id} value={membership.course_id}>
                        {membership.course_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Роль в курсе</Label>
                <Select
                  value={createUserForm.course_role}
                  onValueChange={(value) =>
                    setCreateUserForm((prev) => ({ ...prev, course_role: value as CourseRoleChoice }))
                  }
                  disabled={createUserForm.course_id === NO_COURSE_VALUE}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Преподаватель</SelectItem>
                    <SelectItem value="student">Студент</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button type="submit" variant="accent">
                  Создать пользователя
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <section>
          <h2 className="section-rule mb-4 flex items-center gap-2 text-xl font-semibold">
            Пользователи
            {!loadingUsers && <Badge variant="muted">{users.length}</Badge>}
          </h2>
          {loadingUsers ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Загружаем пользователей...
            </Card>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Никого не нашли"
              description="Попробуйте изменить фильтры поиска или создайте пользователя выше."
            />
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{user.full_name}</h3>
                        {user.is_platform_admin ? (
                          <Badge variant="accent">Админ платформы</Badge>
                        ) : (
                          <Badge variant="muted">Пользователь</Badge>
                        )}
                        {!user.is_active && <Badge variant="destructive">Заблокирован</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Админ платформы</Label>
                        <Switch
                          checked={user.is_platform_admin}
                          onCheckedChange={(value) => handlePlatformAdmin(user, value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Активен</Label>
                        <Switch checked={user.is_active} onCheckedChange={() => handleToggle(user, "is_active")} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                    <div className="space-y-2">
                      <Label className="text-sm">Назначить в курс</Label>
                      <Select
                        value={memberAssignments[user.id]?.course_id ?? NO_COURSE_VALUE}
                        onValueChange={(value) =>
                          setMemberAssignments((prev) => ({
                            ...prev,
                            [user.id]: {
                              course_id: value,
                              course_role: prev[user.id]?.course_role ?? "teacher",
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите курс" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_COURSE_VALUE}>Выберите курс</SelectItem>
                          {memberships.map((membership) => (
                            <SelectItem key={membership.course_id} value={membership.course_id}>
                              {membership.course_title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Роль</Label>
                      <Select
                        value={memberAssignments[user.id]?.course_role ?? "teacher"}
                        onValueChange={(value) =>
                          setMemberAssignments((prev) => ({
                            ...prev,
                            [user.id]: {
                              course_id: prev[user.id]?.course_id ?? NO_COURSE_VALUE,
                              course_role: value as CourseRoleChoice,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">Преподаватель</SelectItem>
                          <SelectItem value="student">Студент</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleAssignExistingUser(user)}
                      disabled={!memberships.length}
                    >
                      Назначить
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
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
                    <Button
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteUser(user)}
                      disabled={deletingUserId === user.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingUserId === user.id ? "Удаляем..." : "Удалить пользователя"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="section-rule mb-4 text-xl font-semibold">Новый курс</h2>
          <Card className="p-6">
            <form className="grid gap-4 md:grid-cols-3" onSubmit={handleCreateCourse}>
              <div className="space-y-2">
                <Label>Идентификатор (slug)</Label>
                <Input
                  value={courseForm.slug}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, slug: event.target.value }))}
                  placeholder="itmo-chem-2026"
                  required
                />
                <p className="text-xs text-muted-foreground">Латиницей, попадёт в адрес курса</p>
              </div>
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={courseForm.title}
                  onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Химия ИТМО 2026"
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
                <Button type="submit" variant="accent">
                  Создать курс
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <section>
          <h2 className="section-rule mb-4 flex items-center gap-2 text-xl font-semibold">
            Курсы и приглашения
            {!loadingCourses && <Badge variant="muted">{memberships.length}</Badge>}
          </h2>
          {loadingCourses ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Загружаем курсы...
            </Card>
          ) : memberships.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Курсов пока нет"
              description="Создайте первый курс в форме выше или присоединитесь по коду приглашения."
            />
          ) : (
            <div className="space-y-4">
              {memberships.map((membership) => {
                const draft = policyDrafts[membership.course_id] ?? {
                  rule_type: "none" as PolicyType,
                  rule_config: "{}",
                };
                const codes = inviteCodes[membership.course_id];

                return (
                  <Card key={membership.course_id} className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{membership.course_title}</p>
                        <p className="text-sm text-muted-foreground">
                          {membership.course_slug} · роли: {membership.roles.join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {membership.status === "active" ? (
                          <Badge variant="success">Активен</Badge>
                        ) : (
                          <Badge variant="muted">{membership.status}</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCourse(membership)}
                          disabled={deletingCourseId === membership.course_id}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingCourseId === membership.course_id ? "Удаляем..." : "Удалить"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleRotateInvite(membership.course_id, "teacher")}
                      >
                        <KeyRound className="h-4 w-4" />
                        Новый код для преподавателя
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleRotateInvite(membership.course_id, "student")}
                      >
                        <KeyRound className="h-4 w-4" />
                        Новый код для студента
                      </Button>
                    </div>

                    {(codes?.teacher || codes?.student) && (
                      <div className="space-y-1 rounded-md border border-accent/25 bg-accent/5 p-3 text-sm">
                        {codes.teacher && (
                          <p>
                            Код преподавателя:{" "}
                            <span className="select-all font-mono font-semibold">{codes.teacher}</span>
                          </p>
                        )}
                        {codes.student && (
                          <p>
                            Код студента:{" "}
                            <span className="select-all font-mono font-semibold">{codes.student}</span>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid gap-3 border-t pt-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Правило идентификации</Label>
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
                            <SelectItem value="none">Без проверки</SelectItem>
                            <SelectItem value="isu_6_digits">Номер ИСУ (6 цифр)</SelectItem>
                            <SelectItem value="email_domain">Домен почты</SelectItem>
                            <SelectItem value="custom_text_validator">Свой валидатор</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Что студент указывает при входе по коду
                        </p>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Настройки правила (JSON)</Label>
                        <Textarea
                          className="font-mono text-sm"
                          value={draft.rule_config}
                          onChange={(event) =>
                            updatePolicyDraft(membership.course_id, { rule_config: event.target.value })
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => handleUpdatePolicy(membership.course_id)}>
                      Сохранить политику
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
};

export default AdminDashboard;
