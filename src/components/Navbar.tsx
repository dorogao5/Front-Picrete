import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { BookOpen, Bot, Check, ChevronDown, Dumbbell, GraduationCap, LogOut, Settings, User, UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";
import { coursesAPI } from "@/lib/api";
import {
  getActiveCourseId,
  getCourseHomePath,
  getDefaultAppPath,
  getMemberships,
  getUser,
  isAdmin,
  isAuthenticated,
  logout,
  setActiveCourseId,
  setMemberships,
  type Membership,
} from "@/lib/auth";

const roleLabelForMembership = (membership: Membership): string => {
  if (membership.roles.includes("teacher")) return "Преподаватель";
  if (membership.roles.includes("student")) return "Студент";
  return "";
};

export const Navbar = () => {
  const navigate = useNavigate();
  const { courseId: routeCourseId } = useParams<{ courseId?: string }>();
  const isAuth = isAuthenticated();
  const user = getUser();
  const [memberships, setMembershipState] = useState(() =>
    getMemberships().filter((membership) => membership.status === "active"),
  );
  const activeCourseId = routeCourseId ?? getActiveCourseId();

  useEffect(() => {
    if (!isAuth) return;
    let cancelled = false;
    void coursesAPI
      .list()
      .then((response) => {
        if (cancelled) return;
        setMemberships(response.data);
        setMembershipState(response.data.filter((membership) => membership.status === "active"));
      })
      .catch(() => {
        // Navigation remains usable with the last stored session if refresh is temporarily unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth, routeCourseId]);

  useEffect(() => {
    if (routeCourseId && memberships.some((membership) => membership.course_id === routeCourseId)) {
      setActiveCourseId(routeCourseId);
    }
  }, [memberships, routeCourseId]);

  const getInitials = (fullName: string) => {
    const names = fullName.split(" ");
    if (names.length >= 2 && names[0] && names[1]) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const handleSwitchCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    navigate(getCourseHomePath(courseId));
  };

  const activeMembership = memberships.find((membership) => membership.course_id === activeCourseId) ?? null;

  const userRoleLabel = user?.is_platform_admin
    ? "Администратор платформы"
    : activeMembership
      ? roleLabelForMembership(activeMembership)
      : "";

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 max-w-full overflow-x-clip border-b bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto min-w-0 px-4 py-2.5 sm:px-6">
        <div className="flex min-h-10 w-full min-w-0 items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Link to="/" className="flex min-h-11 flex-shrink-0 items-center gap-2.5 sm:min-h-0">
              <img src={logo} alt="Picrete" className="h-8 w-8 flex-shrink-0" />
              <span className="hidden font-display text-xl font-semibold tracking-tight sm:inline">
                Picrete
              </span>
            </Link>

            {isAuth && memberships.length > 0 && (
              <>
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11 min-w-0 max-w-full gap-1.5 px-2 text-sm font-medium sm:h-9"
                    >
                      <GraduationCap className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <span className="min-w-0 max-w-44 truncate">
                        {activeMembership?.course_title ?? "Выбрать курс"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      Мои курсы
                    </DropdownMenuLabel>
                    {memberships.map((membership) => (
                      <DropdownMenuItem
                        key={membership.course_id}
                        onClick={() => handleSwitchCourse(membership.course_id)}
                        className="cursor-pointer"
                      >
                        <span className="flex w-4 justify-center">
                          {membership.course_id === activeCourseId && <Check className="h-4 w-4" />}
                        </span>
                        <span className="ml-1 min-w-0 flex-1">
                          <span className="block truncate">{membership.course_title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {roleLabelForMembership(membership)}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/join-course")} className="cursor-pointer">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Присоединиться к курсу
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {isAuth && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 gap-2 rounded-md px-1.5 sm:h-10 sm:px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-36 truncate text-sm font-medium md:inline">
                      {user.full_name}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">{user.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                    {userRoleLabel && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{userRoleLabel}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(getDefaultAppPath())} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Мои работы
                  </DropdownMenuItem>
                  {activeCourseId && (
                    <>
                      <DropdownMenuItem
                        onClick={() => navigate(`/c/${activeCourseId}/task-bank`)}
                        className="cursor-pointer"
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Банк задач
                      </DropdownMenuItem>
                      {(isAdmin() || activeMembership?.roles.includes("student")) && (
                        <DropdownMenuItem
                          onClick={() => navigate(`/c/${activeCourseId}/trainer`)}
                          className="cursor-pointer"
                        >
                          <Dumbbell className="mr-2 h-4 w-4" />
                          Тренажёры
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => navigate(`/c/${activeCourseId}/assistant`)}
                        className="cursor-pointer"
                      >
                        <Bot className="mr-2 h-4 w-4" />
                        Ассистент курса
                      </DropdownMenuItem>
                    </>
                  )}
                  {isAdmin() && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Администрирование
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/demo" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Демо
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                    Войти
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button variant="accent" size="sm" className="px-3 sm:px-4">
                    <span className="hidden sm:inline">Создать аккаунт</span>
                    <span className="sm:hidden">Старт</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
