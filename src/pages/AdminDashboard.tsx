import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Navbar } from "@/components/Navbar";
import { usersAPI } from "@/lib/api";
import { getAuthToken, isAdmin, logout } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, ShieldHalf } from "lucide-react";

type RoleOption = "admin" | "teacher" | "assistant" | "student";

interface AdminUser {
  id: string;
  isu: string;
  full_name: string;
  role: RoleOption;
  is_active: boolean;
  is_verified: boolean;
}

const roleLabels: Record<RoleOption, string> = {
  admin: "Админ",
  teacher: "Преподаватель",
  assistant: "Ассистент",
  student: "Студент",
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{
    isu: string;
    role: RoleOption | "all";
    is_active: "all" | "true" | "false";
    is_verified: "all" | "true" | "false";
  }>({
    isu: "",
    role: "all",
    is_active: "all",
    is_verified: "all",
  });
  const [createForm, setCreateForm] = useState({
    isu: "",
    full_name: "",
    password: "",
    role: "student" as RoleOption,
    is_active: true,
    is_verified: false,
  });
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  // Basic guard: require admin token & role
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !isAdmin()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const filterParams = useMemo(() => {
    return {
      isu: filters.isu.trim() || undefined,
      role: filters.role === "all" ? undefined : filters.role,
      is_active: filters.is_active === "all" ? undefined : filters.is_active === "true",
      is_verified: filters.is_verified === "all" ? undefined : filters.is_verified === "true",
    };
  }, [filters]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await usersAPI.list(filterParams);
      setUsers(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logout();
        return;
      }
      toast.error(error.response?.data?.detail || "Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterParams]);

  const handleToggle = async (user: AdminUser, field: "is_active" | "is_verified") => {
    try {
      const updated = { [field]: !user[field] };
      await usersAPI.update(user.id, updated);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u))
      );
      toast.success("Изменения сохранены");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Не удалось обновить пользователя");
    }
  };

  const handleRoleChange = async (user: AdminUser, role: RoleOption) => {
    try {
      await usersAPI.update(user.id, { role });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
      toast.success("Роль обновлена");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Не удалось обновить роль");
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
      toast.success("Пароль сброшен");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Не удалось сбросить пароль");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await usersAPI.create(createForm);
      toast.success("Пользователь создан");
      setCreateForm({
        isu: "",
        full_name: "",
        password: "",
        role: "student",
        is_active: true,
        is_verified: false,
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Не удалось создать пользователя");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Navbar />
      <div className="container mx-auto px-6 pt-24 pb-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Админ-панель</h1>
            <p className="text-muted-foreground">Управление пользователями и доступами</p>
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>
        </div>

        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold">Фильтр пользователей</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>ISU</Label>
              <Input
                placeholder="000000"
                value={filters.isu}
                onChange={(e) => setFilters((f) => ({ ...f, isu: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={filters.role}
                onValueChange={(value) => setFilters((f) => ({ ...f, role: value as RoleOption | "all" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                  <SelectItem value="teacher">Преподаватель</SelectItem>
                  <SelectItem value="assistant">Ассистент</SelectItem>
                  <SelectItem value="student">Студент</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Активен</Label>
              <Select
                value={filters.is_active}
                onValueChange={(value) => setFilters((f) => ({ ...f, is_active: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
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
                value={filters.is_verified}
                onValueChange={(value) => setFilters((f) => ({ ...f, is_verified: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все" />
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
          <form className="grid md:grid-cols-3 gap-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>ISU</Label>
              <Input
                required
                value={createForm.isu}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, isu: e.target.value.replace(/\D/g, "").slice(0, 6) }))
                }
                maxLength={6}
                placeholder="000000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>ФИО</Label>
              <Input
                required
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Фамилия Имя"
              />
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <Input
                required
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Пароль"
              />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm((f) => ({ ...f, role: value as RoleOption }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Студент</SelectItem>
                  <SelectItem value="assistant">Ассистент</SelectItem>
                  <SelectItem value="teacher">Преподаватель</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createForm.is_active}
                onCheckedChange={(val) => setCreateForm((f) => ({ ...f, is_active: val }))}
              />
              <Label className="cursor-pointer">Активен</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createForm.is_verified}
                onCheckedChange={(val) => setCreateForm((f) => ({ ...f, is_verified: val }))}
              />
              <Label className="cursor-pointer">Верифицирован</Label>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Создать</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Пользователи</h2>
            <div className="text-sm text-muted-foreground">
              Всего: {loading ? "..." : users.length}
            </div>
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Нет пользователей по выбранным фильтрам</div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="p-4 border border-border/60">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{user.full_name}</h3>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {roleLabels[user.role]}
                        </Badge>
                        {user.is_verified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <ShieldHalf className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">ISU: {user.isu}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Роль</Label>
                        <Select value={user.role} onValueChange={(val) => handleRoleChange(user, val as RoleOption)}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Админ</SelectItem>
                            <SelectItem value="teacher">Преподаватель</SelectItem>
                            <SelectItem value="assistant">Ассистент</SelectItem>
                            <SelectItem value="student">Студент</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Активен</Label>
                        <Switch
                          checked={user.is_active}
                          onCheckedChange={() => handleToggle(user, "is_active")}
                        />
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

                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Новый пароль</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="password"
                          value={resetPasswords[user.id] || ""}
                          onChange={(e) =>
                            setResetPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                          placeholder="Введите новый пароль"
                        />
                        <Button variant="outline" onClick={() => handleResetPassword(user.id)}>
                          Сбросить
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;

